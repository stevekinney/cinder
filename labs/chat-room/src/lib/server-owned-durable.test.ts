import { afterEach, describe, expect, it } from 'bun:test';

import { durableRuntime, forgetDurableRuntime } from './server-owned-durable.ts';
import { disposeServerOwnedRuntime } from './server-owned-runtime.ts';

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
});
