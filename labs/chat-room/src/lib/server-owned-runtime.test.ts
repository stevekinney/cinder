import { describe, expect, it } from 'bun:test';

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
