import {
	createCheckpointStore,
	createRunEngine,
	createRunWorkflow
} from '@lostgradient/operative/durable';

import { serverOwnedRuntime } from './server-owned-runtime.ts';

/**
 * The durable half of the server-owned variant.
 *
 * Three things about `createRunEngine` are not obvious from its name and cost
 * time if rediscovered:
 *
 *   1. It is **asynchronous**. It returns a Promise, so a caller that forgets
 *      to await gets a thenable where an engine is expected — and the first
 *      symptom is a process that never exits, not a type error.
 *   2. It resolves to a **wrapper**, `{ engine, checkpointStore }`, not the
 *      engine itself.
 *   3. The engine it wraps **holds the process open** until `shutdown()`.
 *      Constructing one without registering that teardown keeps a dev server
 *      and every test process alive forever.
 *
 * `resolveWorkflowServices` is a field on the options bag, not an importable
 * symbol — the issue's own audit corrects this, and it is worth restating at
 * the call site because the mistake produces a build failure that names a
 * missing export rather than the real problem. It is not called during
 * construction; it runs when the engine reconstructs services for a workflow
 * it is recovering, which is the restart path this variant exists to show.
 */
export type DurableRuntime = {
	engine: { start: () => unknown; shutdown: () => unknown };
	checkpointStore: unknown;
};

/**
 * Memoised on the PROMISE, not on the resolved value.
 *
 * Two requests arriving together would both find "not built yet" if the guard
 * were the settled engine, and both would build one — two engines over one
 * storage, each recovering the other's workflows. Holding the in-flight
 * promise makes the second caller wait for the first caller's engine.
 */
let building: Promise<DurableRuntime> | undefined;

export async function durableRuntime(): Promise<DurableRuntime> {
	building ??= build();
	return building;
}

async function build(): Promise<DurableRuntime> {
	const runtime = serverOwnedRuntime();
	const checkpoints = createCheckpointStore(runtime.store);
	const runWorkflow = createRunWorkflow({ checkpoints } as never);

	const built = (await createRunEngine({
		storage: runtime.storage,
		runWorkflow,
		resolveWorkflowServices: () => ({ services: {} }) as never
	} as never)) as unknown as DurableRuntime;

	// Registered immediately, before anything can start a run on it. The
	// runtime disposes teardowns in reverse order, so an engine registered
	// after the store it writes to shuts down before that store is cleared.
	runtime.onDispose(async () => {
		await built.engine.shutdown();
		building = undefined;
	});

	return built;
}

/** Forgets the memoised engine without disposing the runtime, for tests. */
export function forgetDurableRuntime(): void {
	building = undefined;
}
