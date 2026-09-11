import { afterEach, describe, expect, it } from 'bun:test';

import {
	RuntimeDisposedDuringBuildError,
	durableRuntime,
	forgetDurableRuntime
} from './server-owned-durable.ts';
import { disposeServerOwnedRuntime, serverOwnedRuntime } from './server-owned-runtime.ts';

/**
 * The durable engine holds the process open until `shutdown()`, so every test
 * here disposes — including on the failure path, via `afterEach`. A test that
 * throws before its cleanup would otherwise hang the whole `bun test` run
 * rather than fail it, which is the worst possible way to learn this.
 */
afterEach(async () => {
	await disposeServerOwnedRuntime();
	forgetDurableRuntime();
});

describe('server-owned durable runtime', () => {
	it('resolves to an engine and a checkpoint store', async () => {
		const built = await durableRuntime();

		expect(typeof built.engine.shutdown).toBe('function');
		expect(typeof built.engine.start).toBe('function');
		expect(built.checkpointStore).toBeDefined();
	});

	it('builds one engine for concurrent callers', async () => {
		// Both requested before either resolves. Memoising the settled value
		// instead of the in-flight promise would let both find "not built
		// yet" and build an engine each — two engines over one storage, each
		// recovering the other's workflows.
		const [first, second] = await Promise.all([durableRuntime(), durableRuntime()]);

		expect(second).toBe(first);
		expect(second.engine).toBe(first.engine);
	});

	it('shuts the engine down when the runtime is disposed', async () => {
		const built = await durableRuntime();
		let shutdownCalls = 0;
		const realShutdown = built.engine.shutdown.bind(built.engine);
		built.engine.shutdown = () => {
			shutdownCalls += 1;
			return realShutdown();
		};

		await disposeServerOwnedRuntime();

		// The whole reason the engine registers a teardown: without it, the
		// process stays alive after everything else has been torn down.
		expect(shutdownCalls).toBe(1);
	});

	it('builds a fresh engine after disposal', async () => {
		const before = await durableRuntime();
		await disposeServerOwnedRuntime();
		const after = await durableRuntime();

		expect(after).not.toBe(before);
	});

	it('does not strand an engine when disposal lands mid-build', async () => {
		// DETERMINISTIC, not a timing gamble. `build()` runs synchronously up
		// to its first `await`, and the teardown is registered before that
		// await — so by the time `durableRuntime()` has returned its promise,
		// the teardown is already in the list `disposeServerOwnedRuntime` is
		// about to snapshot. Nothing here depends on how long the engine takes
		// to construct.
		const pending = durableRuntime();
		await disposeServerOwnedRuntime();

		// Registering the teardown AFTER construction instead — which is what
		// this file was written against — makes this line fail rather than
		// throw: the snapshot misses the teardown, the build resolves happily,
		// and the engine it returns is registered against a runtime that has
		// already been disposed and can never be disposed again. It runs, holds
		// the process open, and nothing holds a reference to it.
		await expect(pending).rejects.toBeInstanceOf(RuntimeDisposedDuringBuildError);

		// And the memo is clear, so the next caller gets an engine over the
		// runtime that exists NOW rather than the storage that was just torn
		// down.
		const after = await durableRuntime();
		expect(typeof after.engine.shutdown).toBe('function');

		// That the stranded engine was actually shut down has no direct
		// assertion — it is unreachable by construction, which is the whole
		// defect. The observable is this suite terminating: an engine left
		// running keeps the `bun test` process alive, so a regression here
		// shows up as a run that never exits.
	});

	it('does not let a disposed build erase the one that replaced it', async () => {
		// The follow-on defect, and the reason every clear in that module is
		// token-checked rather than unconditional. Three requests:
		const first = durableRuntime();
		await disposeServerOwnedRuntime();

		// ...a second one arrives after the disposal and installs its own build
		// against the replacement runtime...
		const second = durableRuntime();

		// ...and only then does the first build's construction finish and
		// discover it was disposed. An unconditional `slot = undefined` there
		// erases the second build's promise, and the third request below finds
		// an empty slot and constructs ANOTHER engine over the same storage —
		// two live engines, which is exactly what memoising was for.
		await first.catch(() => undefined);

		const third = await durableRuntime();
		expect(third).toBe(await second);

		// The ordering this depends on — the first build still pending when the
		// second is installed — is environmental rather than structural:
		// `createRunEngine` does real I/O while disposal is a few microtasks.
		// Confirmed by running this against the unconditional-clear version,
		// where it fails. If that ordering ever inverted, this would go quiet
		// rather than flaky: it cannot produce a false failure, only stop
		// exercising the path.
	});

	it('does not hand out an engine belonging to a runtime being disposed', async () => {
		const before = await durableRuntime();

		// A teardown registered AFTER the durable one, so reverse order runs it
		// FIRST — the window this test is about. By the time it fires, the
		// runtime slot has already been cleared (disposal clears it before
		// running anything) while the durable memo is still set, because the
		// durable teardown has not reached its `engine.shutdown()` yet.
		//
		// A request landing here takes a fresh `SessionStore` from the new
		// runtime. Handing it the memoised engine would pair that store with an
		// engine about to stop, over storage about to be cleared.
		let during: { engine: unknown } | undefined;
		let sawFreshRuntime = false;
		serverOwnedRuntime().onDispose(async () => {
			sawFreshRuntime = serverOwnedRuntime() !== undefined;
			during = await durableRuntime();
		});

		await disposeServerOwnedRuntime();

		expect(sawFreshRuntime).toBe(true);
		// A DIFFERENT engine: the memo was rejected because its runtime was not
		// the one that call would have been given. Returning `before` here is
		// the defect — and is what an identity-free `if (held !== undefined)`
		// does.
		expect(during).toBeDefined();
		expect(during).not.toBe(before);
	});
});
