import { describe, expect, it } from 'bun:test';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { disposeServerOwnedRuntime, serverOwnedRuntime } from './server-owned-runtime.ts';

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

	it('clears the storage it owned', async () => {
		await disposeServerOwnedRuntime();
		const runtime = serverOwnedRuntime();
		await runtime.store.set('conversation:1', 'a seeded value');
		expect(await runtime.store.get('conversation:1')).toBe('a seeded value');

		await disposeServerOwnedRuntime();

		// The same storage object, read after disposal: emptied rather than
		// merely dereferenced, so anything still holding a reference sees an
		// empty store instead of stale state.
		//
		// `null`, not `undefined` — that is the text-value store's absent
		// sentinel, measured rather than assumed. Asserting `toBeUndefined`
		// here failed against a store that was correctly cleared, which is
		// worth pinning so the next reader does not re-derive it.
		expect(await runtime.store.get('conversation:1')).toBeNull();
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
});
