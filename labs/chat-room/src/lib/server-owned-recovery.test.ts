import { describe, expect, it } from 'bun:test';
import { SessionRecoverEvent } from '@lostgradient/operative';
import type { AgentRun, SessionHandle } from '@lostgradient/operative';

import { classifyRecovery, describeRecoveryError } from './server-owned-recovery.ts';

/**
 * A handle that dispatches the real `SessionRecoverEvent` during `recover()`.
 *
 * Operative's own event class, not a hand-rolled stand-in: the whole point of
 * this module is reading a field off that event, so a fake event with the same
 * field name would test the fake rather than the contract. Constructing the
 * published class means a rename upstream fails this suite instead of passing
 * against a shape that no longer exists.
 *
 * It also caught the constructor being POSITIONAL rather than an options bag,
 * which a hand-rolled event would have hidden completely.
 */
function handleThatRecovers(options: {
	returns: AgentRun | null;
	failures?: readonly { runId: string; error: unknown }[];
	throws?: unknown;
}): SessionHandle & { listenerCount: () => number } {
	const emitter = new EventTarget();
	let listeners = 0;
	const add = emitter.addEventListener.bind(emitter);
	const remove = emitter.removeEventListener.bind(emitter);

	const handle = {
		id: 'session-under-test',
		emitter: Object.assign(emitter, {
			addEventListener: (...args: Parameters<typeof add>) => {
				listeners += 1;
				add(...args);
			},
			removeEventListener: (...args: Parameters<typeof remove>) => {
				listeners -= 1;
				remove(...args);
			}
		}),
		recover: async () => {
			// Dispatched DURING the call, which is what makes listener ordering
			// load-bearing rather than incidental.
			// POSITIONAL — `(sessionId, runId, failures)`, not an options bag.
			// Passing an object puts it in `sessionId` and leaves `failures` at
			// its `[]` default, so the classifier reports every orphan as
			// "nothing to resume": the benign answer, silently. This test caught
			// exactly that, and only because it asserts the FAILURE branch — a
			// suite that checked the happy path would have shipped it.
			emitter.dispatchEvent(
				new SessionRecoverEvent(
					'session-under-test',
					'session-under-test:1',
					options.failures ?? []
				)
			);
			if (options.throws !== undefined) throw options.throws;
			return options.returns;
		},
		listenerCount: () => listeners
	};

	return handle as unknown as SessionHandle & { listenerCount: () => number };
}

describe('classifyRecovery', () => {
	it('reports a live re-attach as recovered', async () => {
		const run = { id: 'run-1' } as unknown as AgentRun;
		const outcome = await classifyRecovery(handleThatRecovers({ returns: run }));

		expect(outcome.kind).toBe('recovered');
		if (outcome.kind !== 'recovered') return;
		expect(outcome.run).toBe(run);
	});

	it('distinguishes "nothing to resume" from "attempted and failed"', async () => {
		// Both return `null` from `recover()`. The ONLY thing separating a healthy
		// idle session from a run whose work is gone is the emitter's `failures`
		// array — which is the entire reason this module exists rather than
		// callers reading the return value.
		const benign = await classifyRecovery(handleThatRecovers({ returns: null }));
		expect(benign.kind).toBe('nothing-to-resume');

		const failed = await classifyRecovery(
			handleThatRecovers({
				returns: null,
				failures: [{ runId: 'session:3', error: new Error('no workflow services available') }]
			})
		);
		expect(failed.kind).toBe('orphaned');
		if (failed.kind !== 'orphaned') return;
		expect(failed.failures).toEqual([
			{ runId: 'session:3', reason: 'no workflow services available' }
		]);
	});

	it('carries no live error object into the outcome', async () => {
		// The credential boundary again: whatever the engine threw stays
		// server-side, and the outcome carries a sentence. A string by
		// construction means a route cannot forward the cause by accident.
		const failed = await classifyRecovery(
			handleThatRecovers({
				returns: null,
				failures: [{ runId: 'r', error: new Error('postgres://user:hunter2@host/db unreachable') }]
			})
		);

		expect(failed.kind).toBe('orphaned');
		if (failed.kind !== 'orphaned') return;

		// ENUMERATED, not serialized. `JSON.stringify(new Error(...))` produces
		// `{}` — an `Error` has no enumerable own properties — so a classifier
		// that kept the live error in an extra field would pass a
		// `not.toContain('stack')` assertion while carrying the whole cause. That
		// is what the first version of this test did.
		//
		// Checking the KEYS is what makes the claim falsifiable: the shape is
		// exactly the two fields, and anything smuggled alongside them fails
		// here.
		const [failure] = failed.failures;
		expect(Object.keys(failure ?? {}).sort()).toEqual(['reason', 'runId']);
		for (const value of Object.values(failure ?? {})) {
			expect(typeof value).toBe('string');
		}
		expect(failure?.reason).toContain('unreachable');
	});

	it('removes its listener even when recover() throws', async () => {
		// The handle outlives this call. A listener left attached to a
		// long-lived emitter accumulates one per attempt, and each one closes
		// over a dead classification.
		const handle = handleThatRecovers({ returns: null, throws: new Error('engine exploded') });

		await expect(classifyRecovery(handle)).rejects.toThrow('engine exploded');
		expect(handle.listenerCount()).toBe(0);
	});
});

describe('describeRecoveryError', () => {
	it('renders a value that refuses to describe itself', () => {
		// Runs while classifying a failure, so it must not turn one failure into
		// two — the same hazard `describeCause` has in the runtime module.
		const hostile = {
			toString() {
				throw new Error('nope');
			}
		};

		expect(describeRecoveryError(hostile)).toBe('a object that could not be described');
		expect(describeRecoveryError(new TypeError('bad'))).toBe('TypeError: bad');
		expect(describeRecoveryError(new Error('plain'))).toBe('plain');
		expect(describeRecoveryError('already a string')).toBe('already a string');
	});
});
