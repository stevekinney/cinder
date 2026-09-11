import {
	createCheckpointStore,
	createRunEngine,
	createRunWorkflow
} from '@lostgradient/operative/durable';
import type { RunEngine } from '@lostgradient/operative/durable';

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
 *
 * Operative's own `RunEngine`, rather than a hand-written structural stand-in.
 * A local shape would compile against whatever Operative happens to return
 * today and go on compiling after it changed — which is exactly the class of
 * break this variant is meant to catch early, since it is the first consumer
 * of the durable surface in this repository.
 */
export type DurableRuntime = RunEngine;

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
	// A REJECTED promise must not be memoised. Without this, one transient
	// failure — a misconfigured store, a storage hiccup during the first
	// streamed turn — is cached forever: every later caller awaits the same
	// rejected promise and fails identically until the process restarts, with
	// nothing in the logs to suggest the cause was a single early error.
	//
	// Cleared on rejection and rethrown, so the next request rebuilds. The
	// in-flight promise is still shared, so concurrent callers continue to
	// await one build rather than racing several.
	host[DURABLE_SLOT] ??= build().catch((cause: unknown) => {
		host[DURABLE_SLOT] = undefined;
		throw cause;
	});
	return host[DURABLE_SLOT];
}

/**
 * Thrown when the runtime is disposed while its engine is still being built.
 *
 * A named class rather than a bare `Error` because the caller this reaches is
 * a streaming endpoint: a turn that loses this race is a request arriving
 * during shutdown, not a bug in the turn, and a reader of that failure should
 * be able to tell the two apart.
 */
export class RuntimeDisposedDuringBuildError extends Error {
	override readonly name = 'RuntimeDisposedDuringBuildError';

	constructor() {
		super('The server-owned runtime was disposed while its durable engine was being built.');
	}
}

async function build(): Promise<DurableRuntime> {
	const runtime = serverOwnedRuntime();
	// POSITIONAL. `createRunWorkflow(checkpointStore, { version })` takes the
	// store as its first argument, not in an options bag. That used to be
	// stated here as a warning because the call was cast: `createRunWorkflow`
	// does not validate at runtime, so `createRunWorkflow({ checkpoints })`
	// returns a workflow whose activities close over an object with no
	// `saveConversation`, and the failure surfaces much later, mid-run, as
	// `e.saveConversation is not a function`. Now that the call is typed, that
	// mistake is a compile error — which is the point of removing the cast.
	const checkpoints = createCheckpointStore(runtime.store);
	const runWorkflow = createRunWorkflow(checkpoints);

	// Registered BEFORE `createRunEngine` is awaited, and that ordering is
	// load-bearing rather than tidy.
	//
	// `disposeServerOwnedRuntime` SNAPSHOTS the teardown list and clears the
	// runtime slot before running any of them. A disposal that lands while
	// this function is awaiting construction would therefore take a snapshot
	// that does not contain this callback, run to completion, and leave the
	// engine that finishes building afterwards registered against a runtime
	// nothing will ever dispose again — still running, still holding the
	// process open, and still memoised as this module's engine.
	//
	// Registering first closes that window: the teardown always runs, and this
	// cell tells it — and the tail of this function — which side of the race it
	// landed on. One object rather than two locals because the teardown closes
	// over it before either field has its final value, which is the whole
	// mechanism.
	const race: { engine?: DurableRuntime; disposed: boolean } = { disposed: false };

	runtime.onDispose(async () => {
		race.disposed = true;
		// The slot is cleared in `finally`. If `shutdown()` rejects, the memo
		// would otherwise still hold a promise for an engine that is gone, and
		// every later `durableRuntime()` would hand back that dead engine —
		// the runtime counts the failed teardown, so disposal itself already
		// reports the problem, but a stale memo turns one failure into every
		// subsequent request's failure.
		try {
			// `undefined` when disposal won the race: there is no engine yet,
			// and the tail of `build()` shuts down the one that arrives late.
			await race.engine?.engine.shutdown();
		} finally {
			(globalThis as DurableHost)[DURABLE_SLOT] = undefined;
		}
	});

	const built = await createRunEngine({
		storage: runtime.storage,
		runWorkflow,
		// The SAME checkpoint store the workflow writes through, injected
		// rather than left to the engine to build its own over `storage`.
		// `handle.recover()` reads a run's transcript through the store it is
		// given, so the two being the same object is what makes a recovered
		// run see what the workflow wrote. Both would be built over one
		// storage and would almost certainly agree — "almost certainly" being
		// the reason to pass it explicitly.
		checkpointStore: checkpoints,
		// `'unavailable'`, stated rather than stubbed, and it is the honest
		// answer rather than a placeholder. This resolver runs when the engine
		// resumes a workflow a PREVIOUS process left in flight, and is asked
		// to rebuild that run's non-serializable dependencies. Here those are
		// a provider bound to a request-scoped API key and a writer bound to
		// one HTTP response's `ReadableStream` controller — the response is
		// gone, so there is nothing to rebuild. Returning `'unavailable'`
		// fails just that recovered run; claiming `'available'` with empty
		// services would resume it into a run that writes nowhere.
		//
		// Moot today — the storage is in-memory, so nothing survives a
		// process to be recovered — and it stops being moot the moment the
		// storage is swapped, which is the substitution this lab exists to
		// make easy. Recovering usefully is CIN-445's subject.
		resolveWorkflowServices: () => ({
			status: 'unavailable',
			reason: 'The chat-room lab binds each run to one HTTP response, which cannot be rebuilt.'
		})
	});

	race.engine = built;

	// Disposal won the race. The teardown above already ran with nothing to
	// shut down, so this engine would otherwise be unreachable and immortal.
	if (race.disposed) {
		(globalThis as DurableHost)[DURABLE_SLOT] = undefined;
		await built.engine.shutdown();
		// Rejecting rather than returning a live engine over a disposed
		// runtime's storage: `durableRuntime()`'s catch clears the memo, so
		// the next caller builds against whichever runtime exists then.
		throw new RuntimeDisposedDuringBuildError();
	}

	return built;
}

/** Forgets the memoised engine without disposing the runtime, for tests. */
export function forgetDurableRuntime(): void {
	(globalThis as DurableHost)[DURABLE_SLOT] = undefined;
}
