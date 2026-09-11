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
 * Memoised on the PROMISE, and held on `globalThis` rather than in a
 * module-level `let`.
 *
 * The promise, not the settled value: two requests arriving together would
 * both find "not built yet" if the guard were the resolved engine, and both
 * would build one — two engines over a single storage, each recovering the
 * other's workflows. Holding the in-flight promise makes the second caller
 * wait for the first caller's engine.
 *
 * `globalThis`, for the same reason the runtime's store is held there, and
 * the omission was a real leak until an HMR exercise found it. Vite
 * invalidates a server module on edit and re-evaluates it on the next
 * request — logged as `(ssr) page reload`, not a hot accept. A module-scoped
 * memo comes back `undefined` in the new module instance, so the next request
 * builds a SECOND engine while the first is still running and still holding
 * the process open. Each edit would add one, invisibly, for the life of the
 * dev server.
 */
const DURABLE_SLOT = Symbol.for('cinder.chat-room.server-owned.durable');

type DurableHost = typeof globalThis & {
	[DURABLE_SLOT]?: Promise<DurableRuntime> | undefined;
};

export async function durableRuntime(): Promise<DurableRuntime> {
	const host = globalThis as DurableHost;
	host[DURABLE_SLOT] ??= build();
	return host[DURABLE_SLOT];
}

async function build(): Promise<DurableRuntime> {
	const runtime = serverOwnedRuntime();
	const checkpoints = createCheckpointStore(runtime.store);
	// POSITIONAL. `createRunWorkflow(checkpointStore, { version })` takes the
	// store as its first argument, not in an options bag — and it does not
	// validate, so `createRunWorkflow({ checkpoints })` is accepted and returns
	// a workflow whose activities close over an object with no
	// `saveConversation`. The failure surfaces much later, mid-run, as
	// `e.saveConversation is not a function`, naming nothing that points back
	// to the call site.
	const runWorkflow = createRunWorkflow(checkpoints as never);

	const built = (await createRunEngine({
		storage: runtime.storage,
		runWorkflow,
		resolveWorkflowServices: () => ({ services: {} }) as never
	} as never)) as unknown as DurableRuntime;

	// Registered immediately, before anything can start a run on it. The
	// runtime disposes teardowns in reverse order, so an engine registered
	// after the store it writes to shuts down before that store is cleared.
	//
	// This fires on explicit disposal — tests, and process teardown — not on
	// edit. Vite reloads server modules rather than hot-accepting them, so the
	// slot above is what keeps one engine alive across an edit; without it the
	// shutdown registered here would never run for the stranded one, because
	// nothing would hold a reference to it.
	// The handle needs the store we built, not `built.checkpointStore`. Both
	// have the same shape, so this is not load-bearing today — it is recorded
	// because the two being interchangeable is an assumption, not a contract.
	built.checkpointStore = checkpoints as never;

	runtime.onDispose(async () => {
		// The slot is cleared in `finally`. If `shutdown()` rejects, the memo
		// would otherwise still hold a promise for an engine that is gone, and
		// every later `durableRuntime()` would hand back that dead engine —
		// the runtime counts the failed teardown, so disposal itself already
		// reports the problem, but a stale memo turns one failure into every
		// subsequent request's failure.
		try {
			await built.engine.shutdown();
		} finally {
			(globalThis as DurableHost)[DURABLE_SLOT] = undefined;
		}
	});

	return built;
}

/** Forgets the memoised engine without disposing the runtime, for tests. */
export function forgetDurableRuntime(): void {
	(globalThis as DurableHost)[DURABLE_SLOT] = undefined;
}
