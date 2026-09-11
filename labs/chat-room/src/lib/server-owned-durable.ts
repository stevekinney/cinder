import {
	createCheckpointStore,
	createRunEngine,
	createRunWorkflow
} from '@lostgradient/operative/durable';
import type { RunEngine } from '@lostgradient/operative/durable';

import { serverOwnedRuntime } from './server-owned-runtime.ts';
import type { ServerOwnedRuntime } from './server-owned-runtime.ts';

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

/**
 * The slot holds a TOKEN beside the promise, so a build can tell whether the
 * memo still refers to it.
 *
 * Without that, every `= undefined` in this module is an unconditional erase,
 * and a build that lost the disposal race erases its SUCCESSOR. The sequence
 * is three requests long and ends with the exact failure the memo exists to
 * prevent:
 *
 *   1. Build A starts and awaits `createRunEngine`.
 *   2. Disposal runs. A's teardown fires, finds no engine yet, clears the slot.
 *   3. A new request installs build B against the replacement runtime.
 *   4. A's construction finishes, sees it was disposed, and clears the slot —
 *      erasing B, which is neither disposed nor finished.
 *   5. The next request finds an empty slot and builds C. B and C are now two
 *      engines over one storage, each recovering the other's workflows.
 *
 * Comparing the token before clearing makes steps 4 and 5 no-ops: a build only
 * ever retracts its own memo.
 *
 * It also holds the RUNTIME the memo was built over, which the token alone
 * cannot stand in for. The token answers "is this still my memo?"; the runtime
 * answers "is this memo still about the runtime a caller is going to get?" —
 * and those come apart during disposal, because `disposeServerOwnedRuntime`
 * clears the runtime slot BEFORE running any teardown while this memo survives
 * until the durable teardown's `engine.shutdown()` resolves. In that window a
 * request would take a fresh `SessionStore` from a new runtime and an engine
 * and checkpoint store from the old one, which is then shut down and its
 * storage cleared out from under the request before it ever calls `run()`.
 */
type DurableSlot = {
	token: symbol;
	runtime: ServerOwnedRuntime;
	module: symbol;
	promise: Promise<DurableRuntime>;
};

/**
 * Identity of THIS evaluation of this module.
 *
 * `globalThis` is what keeps the engine alive across a Vite server reload —
 * that is the leak the slot was introduced to fix. But it works too well: the
 * runtime is unchanged too, so the identity check above is satisfied and every
 * call after an edit keeps returning the engine the PREVIOUS module instance
 * built. Changes to the workflow, the checkpoint wiring, or
 * `resolveWorkflowServices` appear to reload and stay inactive until the whole
 * dev server restarts, which is worse than not reloading at all: an experiment
 * silently exercises stale code.
 *
 * A fresh symbol per evaluation distinguishes the two cases. Same module, same
 * runtime — reuse. New module — stop the old engine and build one from the
 * code now on disk.
 */
const MODULE_GENERATION = Symbol('server-owned-durable-module');

type DurableHost = typeof globalThis & {
	[DURABLE_SLOT]?: DurableSlot | undefined;
};

/** Clears the memo only if it still holds THIS build's promise. */
function releaseSlot(token: symbol): void {
	const host = globalThis as DurableHost;
	if (host[DURABLE_SLOT]?.token === token) host[DURABLE_SLOT] = undefined;
}

export async function durableRuntime(): Promise<DurableRuntime> {
	const host = globalThis as DurableHost;
	// Read ONCE, and passed down, so this function and the build it starts
	// cannot end up describing two different runtimes.
	const runtime = serverOwnedRuntime();
	const held = host[DURABLE_SLOT];

	// Identity, not presence, on BOTH axes.
	//
	// Runtime: a memo whose runtime is not the one a caller will now be handed
	// belongs to a disposed generation — its engine is stopping and its storage
	// is going away. Returning it would pair a live session store with a dying
	// engine. Left alone rather than cleared: its own teardown still needs it,
	// and `releaseSlot` will find a different token and decline to erase the
	// replacement installed below.
	//
	// Module: an engine built by a previous evaluation of this file closes over
	// that evaluation's workflow and wiring. Reusing it makes an edit look
	// applied while the old code keeps running.
	if (held !== undefined && held.runtime === runtime && held.module === MODULE_GENERATION) {
		return held.promise;
	}

	// A memo from a previous module evaluation is STOPPED before its
	// replacement is built, not alongside it.
	//
	// The runtime is the same one, so the stale engine's `onDispose` teardown is
	// still registered and would eventually run — but "eventually" is process
	// exit, and until then it is live over the same storage as the new one. Two
	// engines over one store is the exact condition this memo exists to
	// prevent, so retiring it as a detached promise only narrows the window
	// rather than closing it: `shutdown()` is asynchronous, and the successor
	// would start inside it.
	//
	// A failed retirement is NOT swallowed. If the stale engine will not stop,
	// building its replacement is how one store ends up with two engines for
	// the life of the process — so the rejection propagates, the memo is
	// cleared by `durableRuntime`'s catch, and the next caller tries again
	// against whatever state exists then.
	const retire =
		held !== undefined && held.runtime === runtime
			? async (): Promise<void> => {
					// A build that never succeeded has no engine to stop, and its
					// own rejection was already delivered to whoever awaited it.
					const stale = await held.promise.catch(() => undefined);
					if (stale !== undefined) await stale.engine.shutdown();
				}
			: undefined;

	// A REJECTED promise must not be memoised. Without this, one transient
	// failure — a misconfigured store, a storage hiccup during the first
	// streamed turn — is cached forever: every later caller awaits the same
	// rejected promise and fails identically until the process restarts, with
	// nothing in the logs to suggest the cause was a single early error.
	//
	// Cleared on rejection and rethrown, so the next request rebuilds. The
	// in-flight promise is still shared, so concurrent callers continue to
	// await one build rather than racing several.
	const token = Symbol('server-owned-durable-build');

	// `build()` is called SYNCHRONOUSLY when there is nothing to retire, and
	// that is load-bearing rather than an optimisation: it runs to its first
	// await before returning, which is what registers the disposal teardown
	// before `durableRuntime()` hands back its promise. Chaining it behind a
	// resolved promise unconditionally pushes that registration onto a
	// microtask — and a `disposeServerOwnedRuntime()` called immediately after
	// would then snapshot a teardown list without it, which is the stranded
	// engine this module already fixed once. Two race tests caught the
	// regression.
	//
	// The retirement path does delay it, and cannot avoid doing so: the stale
	// engine has to stop before its replacement starts over the same storage.
	// That path only runs on a module re-evaluation, where the previous
	// generation's teardown is still registered against the same runtime, so a
	// disposal landing in the window still has something to drain.
	const promise =
		retire === undefined
			? build(token, runtime).catch((cause: unknown) => {
					releaseSlot(token);
					throw cause;
				})
			: (async (): Promise<DurableRuntime> => {
					try {
						await retire();
					} catch (cause) {
						// The stale memo is PUT BACK, not dropped. Clearing it
						// would leave the next caller with no `held` value, so it
						// would take the direct build path and start a second
						// engine over the same storage beside one that would not
						// stop — without ever retrying its retirement. Restoring
						// it means the next call tries to retire again, and keeps
						// failing visibly until something is done about it.
						if (host[DURABLE_SLOT]?.token === token) host[DURABLE_SLOT] = held;
						throw cause;
					}

					// REVALIDATED after the await. A process disposal can begin
					// while retirement is pending: `runDisposal` clears the
					// runtime slot and snapshots only the old teardown, so a
					// successor built here would register its teardown after that
					// snapshot, keep `race.disposed` false, and resolve into an
					// engine the exit never shuts down. `serverOwnedRuntime()`
					// also throws outright once termination has latched, which is
					// the same answer arrived at sooner.
					if (serverOwnedRuntime() !== runtime) {
						releaseSlot(token);
						throw new RuntimeDisposedDuringBuildError();
					}

					try {
						return await build(token, runtime);
					} catch (cause) {
						releaseSlot(token);
						throw cause;
					}
				})();
	host[DURABLE_SLOT] = { token, runtime, module: MODULE_GENERATION, promise };
	return promise;
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

async function build(token: symbol, runtime: ServerOwnedRuntime): Promise<DurableRuntime> {
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
	const race: { disposed: boolean } = { disposed: false };

	// The construction promise itself, so the teardown can AWAIT it rather than
	// look for an engine that does not exist yet.
	let construction: Promise<DurableRuntime> | undefined;

	const unregisterTeardown = runtime.onDispose(async () => {
		race.disposed = true;
		// The slot is cleared in `finally`. If `shutdown()` rejects, the memo
		// would otherwise still hold a promise for an engine that is gone, and
		// every later `durableRuntime()` would hand back that dead engine —
		// the runtime counts the failed teardown, so disposal itself already
		// reports the problem, but a stale memo turns one failure into every
		// subsequent request's failure.
		try {
			// AWAITS the in-flight construction. Reading a nullable `engine`
			// here returned immediately when disposal landed mid-build, so
			// `disposeServerOwnedRuntime()` resolved with the engine still
			// being created — and the signal handler exits as soon as that
			// resolves, cutting off the initialization and any checkpoint I/O
			// underway. Awaiting means disposal does not settle until the
			// engine exists and has been shut down.
			//
			// A rejected construction is nothing to shut down, and its own
			// error is already reported to the caller that asked for it.
			const built = await construction?.catch(() => undefined);
			await built?.engine.shutdown();
		} finally {
			releaseSlot(token);
		}
	});

	// Unregistered when construction FAILS. `onDispose` only appends, and the
	// memo above deliberately lets a later request retry a transient failure —
	// so without this, every failed attempt leaves another dead closure behind
	// and another callback for shutdown to run. Disposal that has already taken
	// ownership makes this a no-op: it snapshots the list before running it, so
	// the callback fires either way and removing it afterwards changes nothing.
	let built: DurableRuntime;
	try {
		construction = createRunEngine({
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
		built = await construction;
	} catch (cause) {
		unregisterTeardown();
		throw cause;
	}

	// Disposal won the race. SHUTDOWN IS THE TEARDOWN'S, not this branch's: it
	// awaits the same `construction` promise, so by the time disposal settles
	// the engine has been created and stopped. Doing it here as well would shut
	// the same engine down twice.
	if (race.disposed) {
		// Token-checked, so a request that arrived after the disposal keeps the
		// build it installed rather than having it erased by this one.
		releaseSlot(token);
		// Rejecting rather than returning a live engine over a disposed
		// runtime's storage: `durableRuntime()`'s catch clears the memo, so
		// the next caller builds against whichever runtime exists then.
		throw new RuntimeDisposedDuringBuildError();
	}

	return built;
}

/**
 * Forgets the memoised engine without disposing the runtime, for tests.
 *
 * Unconditional, unlike `releaseSlot`: a test asking to forget whatever is
 * held means exactly that, and has no token to compare against.
 */
export function forgetDurableRuntime(): void {
	(globalThis as DurableHost)[DURABLE_SLOT] = undefined;
}
