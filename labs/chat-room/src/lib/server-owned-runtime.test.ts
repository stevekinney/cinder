import { beforeEach, describe, expect, it } from 'bun:test';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
	RuntimeTerminatingError,
	disposeServerOwnedRuntime,
	serverOwnedRuntime
} from './server-owned-runtime.ts';

/**
 * The server-owned variant's disposal contract.
 *
 * This is the executable half of the "initialization, disposal, and hot-module
 * replacement leave nothing orphaned" requirement — but note there is NO
 * `import.meta.hot.dispose` hook to exercise. Vite reloads server modules
 * rather than hot-accepting them, so such a hook never fires; the `globalThis`
 * slot surviving module replacement is what prevents the leak, and
 * `server-owned-runtime.ts` records the measurement behind that.
 *
 * What is pinned here is the disposal path itself, which the specs and a
 * process teardown both use: a runtime is reused rather than rebuilt, every
 * registered teardown runs, a throwing one does not strand the rest, and a
 * fresh runtime is built afterwards.
 */
/**
 * The terminating latch is process-global and deliberately STICKY — once a
 * terminating disposal starts, nothing may build a runtime again, which is the
 * whole point of it. That makes it leak between tests: any spec that sets it
 * refuses every `serverOwnedRuntime()` in every spec that runs after it, and
 * the failure surfaces in the later test rather than the one that armed it.
 *
 * An ordinary disposal with no in-flight disposal clears the latch, so this
 * hook is the reset. Without it, tests pass or fail by position in the file.
 */
beforeEach(async () => {
	await disposeServerOwnedRuntime();
});

describe('server-owned runtime', () => {
	it('returns one runtime per process rather than one per call', async () => {
		await disposeServerOwnedRuntime();
		const first = serverOwnedRuntime();
		const second = serverOwnedRuntime();

		// Identity, not equality: two stores holding equal data would still be
		// two stores, and the second one's history would be invisible to
		// anything holding the first.
		expect(second).toBe(first);
		expect(second.sessions).toBe(first.sessions);
		await disposeServerOwnedRuntime();
	});

	it('builds a fresh runtime after disposal', async () => {
		await disposeServerOwnedRuntime();
		const before = serverOwnedRuntime();
		await disposeServerOwnedRuntime();
		const after = serverOwnedRuntime();

		expect(after).not.toBe(before);
		await disposeServerOwnedRuntime();
	});

	it('runs teardowns in reverse registration order', async () => {
		await disposeServerOwnedRuntime();
		const runtime = serverOwnedRuntime();
		const order: string[] = [];
		runtime.onDispose(() => {
			order.push('store');
		});
		runtime.onDispose(() => {
			order.push('run');
		});

		await disposeServerOwnedRuntime();

		// Reverse, because a durable run registered after the store it writes
		// to has to stop before that store goes away. Registration order is
		// construction order; disposal is the inverse.
		expect(order).toEqual(['run', 'store']);
	});

	it('runs every teardown even when one throws, and reports the failure', async () => {
		await disposeServerOwnedRuntime();
		const runtime = serverOwnedRuntime();
		const completed: string[] = [];
		runtime.onDispose(() => {
			completed.push('first');
		});
		runtime.onDispose(() => {
			throw new Error('teardown exploded');
		});
		runtime.onDispose(() => {
			completed.push('third');
		});

		const { failures } = await disposeServerOwnedRuntime();

		// A half-disposed runtime is precisely the leak this guards against,
		// so one failing teardown must not strand the rest.
		expect(completed).toEqual(['third', 'first']);
		expect(failures).toBe(1);
	});

	it('awaits asynchronous teardowns before returning', async () => {
		await disposeServerOwnedRuntime();
		const runtime = serverOwnedRuntime();
		let settled = false;
		runtime.onDispose(async () => {
			await Promise.resolve();
			settled = true;
		});

		await disposeServerOwnedRuntime();

		// Without the await, disposal would resolve while a durable run was
		// still shutting down — reported clean, actually mid-flight.
		expect(settled).toBe(true);
	});

	it('leaves the data it owned alone, and hands the next runtime a fresh store', async () => {
		await disposeServerOwnedRuntime();
		const runtime = serverOwnedRuntime();
		await runtime.store.set('conversation:1', 'a seeded value');
		expect(await runtime.store.get('conversation:1')).toBe('a seeded value');

		await disposeServerOwnedRuntime();

		// NOT deleted. This test used to assert the opposite, and the inversion
		// is the point: disposal used to call `storage.clear()`, which is
		// harmless only because this is `MemoryStorage` and dies with the
		// process anyway. Under the persistent-storage swap this module
		// documents as the single change a durable backing store needs, every
		// SIGTERM would have deleted every session and checkpoint immediately
		// before exiting — a graceful restart as the most destructive thing the
		// process can do.
		//
		// Disposal STOPS things. Deleting data is a fixture concern.
		expect(await runtime.store.get('conversation:1')).toBe('a seeded value');

		// And isolation still comes for free, which is why nothing needed the
		// clear: disposal drops the runtime slot, so the next caller gets a new
		// storage rather than the previous one's contents.
		const next = serverOwnedRuntime();
		expect(next).not.toBe(runtime);
		expect(await next.store.get('conversation:1')).toBeNull();
	});

	it('is safe to dispose when nothing was ever created', async () => {
		await disposeServerOwnedRuntime();
		await expect(disposeServerOwnedRuntime()).resolves.toEqual({ failures: 0 });
	});
});

/**
 * SIGTERM still terminates the process.
 *
 * Registering a listener for a signal REPLACES Node's default behaviour for
 * it, which is to terminate. A handler that starts a cleanup and returns
 * therefore absorbs the signal: with anything holding the event loop open —
 * an HTTP server in a deployment, the interval in the fixture — the process
 * keeps running until whatever sent SIGTERM gives up and sends SIGKILL. That
 * is strictly worse than having registered no handler at all, and it is what
 * the first version of these handlers did.
 *
 * Driven in a CHILD process for the obvious reason: the property under test
 * is that a process dies, and this one has assertions left to run. No explicit
 * timeout — a child that never exits fails on the runner's own default, which
 * is the correct report rather than a number invented here.
 */
describe('overlapping disposal', () => {
	it('joins a disposal already in flight rather than reporting nothing to do', async () => {
		const runtime = serverOwnedRuntime();

		// A teardown that parks, standing in for the asynchronous engine shutdown
		// and checkpoint flush a real disposal awaits.
		let release: () => void = () => {};
		const parked = new Promise<void>((resolve) => {
			release = resolve;
		});
		let finished = false;
		runtime.onDispose(async () => {
			await parked;
			finished = true;
		});

		const first = disposeServerOwnedRuntime();
		const second = disposeServerOwnedRuntime();

		// The assertion that matters is about the SECOND caller alone: it must not
		// settle while the first disposal is still working. Awaiting both would
		// pass either way, since the first one finishes the teardown regardless —
		// which is exactly how the first version of this test managed to pass
		// against the unfixed code.
		let secondSettled = false;
		void second.then(() => {
			secondSettled = true;
		});

		// A macrotask, so every pending microtask has run. Without the memo the
		// second call returns `{ failures: 0 }` immediately — the first has already
		// cleared the runtime slot — and would have settled by now. From a signal
		// handler that is `process.exit` firing while the first teardown is still
		// awaiting a checkpoint flush.
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(secondSettled).toBe(false);
		expect(finished).toBe(false);

		release();
		await Promise.all([first, second]);
		expect(finished).toBe(true);
	});
});

it('refuses to build a runtime once a terminating disposal has started', async () => {
	const first = serverOwnedRuntime();

	// A teardown that reaches for a runtime, standing in for an in-flight
	// request landing after the slot is cleared and before the teardowns
	// finish. Under a TERMINATING disposal it is refused rather than served.
	let refusal: unknown;
	first.onDispose(() => {
		try {
			serverOwnedRuntime();
		} catch (cause) {
			refusal = cause;
			throw cause;
		}
	});

	const { failures } = await disposeServerOwnedRuntime({ drain: true });

	// Refused, and counted. The earlier version of this let the teardown build
	// a replacement and relied on a bounded drain to catch it — which could not
	// work: a loop that ends by giving up leaves the last generation
	// undisposed, and the signal handler exits the moment it returns.
	expect(refusal).toBeInstanceOf(RuntimeTerminatingError);
	expect(failures).toBe(1);

	// And nothing was left behind for the exit to cut off.
	expect(() => serverOwnedRuntime()).toThrow(RuntimeTerminatingError);
});

it('drains a replacement created while an ordinary disposal was still running', async () => {
	// The window: an ordinary disposal clears the runtime slot and parks in a
	// teardown; a request builds a replacement; THEN the signal arrives. The
	// terminating call finds a disposal already in flight and joins it — but
	// that promise is an ordinary disposal's, and it has never heard of the
	// replacement. Returning the moment it settles reports "shut down" while a
	// live runtime sits in the slot, and the signal handler exits on top of it.
	const first = serverOwnedRuntime();

	let release: () => void = () => {};
	const heldOpen = new Promise<void>((resolve) => {
		release = resolve;
	});
	first.onDispose(() => heldOpen);

	// ORDINARY: no drain, so no latch — which is what leaves the door open for
	// the replacement below.
	const ordinary = disposeServerOwnedRuntime();

	// The slot is cleared synchronously, so this is a genuinely new runtime,
	// admitted before any latch is set.
	const replacement = serverOwnedRuntime();
	expect(replacement).not.toBe(first);

	let replacementDisposed = false;
	replacement.onDispose(() => {
		replacementDisposed = true;
	});

	// The signal lands here. Started, not awaited: it is about to join
	// `ordinary`, which is parked on the gate this test still holds.
	const terminating = disposeServerOwnedRuntime({ drain: true });

	release();
	await ordinary;
	await terminating;

	// Without the drain-after-join, this is false: the terminating call
	// returned `ordinary`'s result and the replacement was never touched.
	expect(replacementDisposed).toBe(true);

	// And the latch still holds afterwards, so nothing refilled the slot on
	// the way out.
	expect(() => serverOwnedRuntime()).toThrow(RuntimeTerminatingError);
});

describe('process signals', () => {
	/** Spawns the fixture and waits until it reports its handlers registered. */
	async function readyFixture(environment: Record<string, string>) {
		const child = Bun.spawn(['bun', join(import.meta.dir, 'server-owned-signal-fixture.ts')], {
			stdout: 'pipe',
			stderr: 'pipe',
			env: { ...process.env, ...environment }
		});

		// Signalled only once the fixture says so, so this cannot race module
		// evaluation.
		const reader = child.stdout.getReader();
		const decoder = new TextDecoder();
		let announced = '';
		while (!announced.includes('ready')) {
			const { value, done } = await reader.read();
			if (done) break;
			announced += decoder.decode(value, { stream: true });
		}
		expect(announced).toContain('ready');
		return { child, reader };
	}

	it('a repeated signal forces the exit instead of being ignored', async () => {
		// `process.once` removed the listener after the first delivery, so a
		// second SIGINT took Node's default path and killed the process
		// mid-disposal. Same outcome as a forced exit, but arrived at by the
		// handler no longer being installed — untestable, and impossible to
		// change without noticing it first.
		//
		// A slow teardown widens the window so the second signal genuinely
		// lands during disposal rather than after it.
		const directory = mkdtempSync(join(tmpdir(), 'server-owned-signal-'));
		const marker = join(directory, 'disposed');

		try {
			// WITH a host listener, which is what makes this test able to tell
			// the two implementations apart. Without one they are
			// indistinguishable by outcome: under `process.once` the second
			// delivery finds no listener and Node's default terminates, which
			// looks exactly like a deliberate forced exit.
			//
			// Add a host listener and they diverge. `once`: our handler is gone,
			// the host's no-op absorbs the second signal, the default is
			// suppressed, and the process waits out the whole teardown. `on`:
			// our handler is still installed and forces the exit. Verified both
			// ways — this fails against `once`.
			const { child, reader } = await readyFixture({
				TEARDOWN_MARKER: marker,
				BLOCK_TEARDOWN: '1',
				HOST_LISTENER: '1'
			});

			child.kill('SIGTERM');

			// The second signal is sent once the fixture ANNOUNCES that disposal
			// has started, not after a guessed delay — signals delivered in the
			// same tick can be coalesced, and the first attempt at this test
			// sent both back to back and saw only one handled.
			let announced = '';
			const decoder = new TextDecoder();
			while (!announced.includes('disposing')) {
				const { value, done } = await reader.read();
				if (done) break;
				announced += decoder.decode(value, { stream: true });
			}
			expect(announced).toContain('disposing');

			child.kill('SIGTERM');

			for (;;) {
				const { done } = await reader.read();
				if (done) break;
			}
			await child.exited;

			// TERMINATED while the teardown was still BLOCKED. The barrier never
			// opens — the parent holds it closed — so the only way this process
			// can exit is the second signal forcing it. No delay is involved,
			// and no amount of waiting could satisfy this by accident.
			const terminated = child.signalCode === 'SIGTERM' || child.exitCode === 143;
			expect(terminated).toBe(true);

			// And the teardown did NOT complete, which is what "forced" means
			// here — the marker is written at the end of it, past the barrier.
			expect(existsSync(marker)).toBe(false);
		} finally {
			rmSync(directory, { recursive: true, force: true });
		}
	});

	// Both cases, because the second is the one the first cannot speak for.
	for (const [label, environment] of [
		['as the only signal listener', {}],
		["alongside a host's own persistent listener", { HOST_LISTENER: '1' }]
	] as const) {
		it(`disposes and then terminates the process ${label}`, async () => {
			// The marker is what makes this two claims rather than one. Asserting
			// termination alone would stay green if the handler's cleanup were
			// replaced by a bare `process.exit(143)` — and cutting off the disposal
			// is the regression these handlers exist to prevent.
			const directory = mkdtempSync(join(tmpdir(), 'server-owned-signal-'));
			const marker = join(directory, 'disposed');

			try {
				const { child, reader } = await readyFixture({ ...environment, TEARDOWN_MARKER: marker });

				expect(existsSync(marker)).toBe(false);

				child.kill('SIGTERM');

				// Drained to EOF rather than polled: the stream closes when the
				// process does, so this waits on the exit without a timer.
				for (;;) {
					const { done } = await reader.read();
					if (done) break;
				}
				await child.exited;

				// DISPOSED: a teardown registered on the runtime actually ran.
				expect(existsSync(marker)).toBe(true);

				// AND TERMINATED, the way a signal terminates: either the runtime
				// reports the signal directly, or it surfaces as the conventional
				// 128 + 15 status. Never a clean 0, which would mean something
				// invented a success it had no basis for.
				const terminated = child.signalCode === 'SIGTERM' || child.exitCode === 143;
				expect(terminated).toBe(true);
			} finally {
				rmSync(directory, { recursive: true, force: true });
			}
		});
	}

	it("runs the reloaded module's disposer rather than the one it registered with", async () => {
		// Vite re-evaluates server modules on edit while `globalThis` survives, so
		// the registration guard correctly declines to add a second pair of
		// listeners — and the pair already on `process` belongs to the FIRST
		// evaluation. Closing over `disposeServerOwnedRuntime` directly would make
		// those listeners permanent: every later edit to draining, teardown
		// ordering, or failure reporting would load and appear active while Ctrl-C
		// still ran the shutdown path from before the edit. The symptom only shows
		// at exit, which is the worst place to discover you have been measuring
		// code that is no longer on disk.
		const directory = mkdtempSync(join(tmpdir(), 'server-owned-reload-'));
		const reloaded = join(directory, 'reloaded');
		const marker = join(directory, 'disposed');

		try {
			const { child, reader } = await readyFixture({
				RELOAD_MARKER: reloaded,
				TEARDOWN_MARKER: marker
			});

			child.kill('SIGTERM');

			for (;;) {
				const { done } = await reader.read();
				if (done) break;
			}
			await child.exited;

			// The handler reached the CURRENT implementation, not the one that was
			// in scope when it was registered.
			expect(existsSync(reloaded)).toBe(true);

			// And it still disposed: the indirection replaced how the handler finds
			// the disposer, not what the disposer does.
			expect(existsSync(marker)).toBe(true);
		} finally {
			rmSync(directory, { recursive: true, force: true });
		}
	});
});
