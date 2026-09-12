import { writeSync } from 'node:fs';

import { createSessionStore } from '@lostgradient/operative';
import type { SessionStore } from '@lostgradient/operative';
import type { Storage } from '@lostgradient/weft/storage/interface';
import { textValueStore } from '@lostgradient/weft/storage/text-value-store';
import type { ConditionalTextValueStore } from '@lostgradient/weft/storage/text-value-store';

import { serverOwnedStorage } from '$lib/server-owned-storage';
import type { Durability } from '$lib/server-owned-storage';

/**
 * The server-owned variant's process-wide runtime: one storage, one
 * text-value store over it, and one `SessionStore` over that.
 *
 * Every Operative session API takes a `ConditionalTextValueStore`, so this
 * composition is the entry point rather than a convenience — `MemoryStorage`
 * → `textValueStore` → `createSessionStore` is the shortest path from Weft's
 * storage primitives to Operative's session surface.
 *
 * In-memory BY DEFAULT: this is a lab demonstrating the server-owned shape,
 * not a deployment. `serverOwnedStorage()` swaps in SQLite on disk when
 * `CHAT_ROOM_SERVER_OWNED_DATABASE` names a file, which is what makes the
 * recovery question answerable across a restart — with nothing surviving the
 * process there is no run to re-attach to and no stranded run to report.
 *
 * The swap really was one line, which is what the earlier version of this
 * paragraph promised and CIN-445 collected on. It is a line in ONE file
 * because this field is typed `Storage` rather than `MemoryStorage`; see the
 * note on it below.
 */
export type ServerOwnedRuntime = {
	/**
	 * Weft's `Storage` interface, NOT `MemoryStorage`.
	 *
	 * The docblock below says swapping the implementation is the only change a
	 * durable backing store needs, and pinning this field to the concrete class
	 * would have made that false — every consumer would have been typed against
	 * `MemoryStorage` and a swap would have meant widening them all first. The
	 * interface is what `createRunEngine` takes, so nothing downstream needs the
	 * narrower type.
	 */
	readonly storage: Storage;
	readonly store: ConditionalTextValueStore;
	readonly sessions: SessionStore;
	/**
	 * Whether this runtime's storage survives the process.
	 *
	 * Carried on the runtime rather than re-read from the environment wherever
	 * it is needed: the runtime is built once and memoised on `globalThis`, so
	 * a later read of a changed variable would describe a storage this process
	 * is not using.
	 */
	readonly durability: Durability;
	/** Aborted before any runtime teardown begins, including durable engine drain. */
	readonly shutdownSignal: AbortSignal;
	/**
	 * Registers a teardown to run when the runtime is disposed. Anything that
	 * outlives a single request — a subscription, a durable run, a provider
	 * connection — registers here so disposal is exhaustive by construction
	 * rather than by someone remembering to add a line.
	 *
	 * Returns an UNREGISTER function, because registration often happens before
	 * the thing being torn down exists. A caller that registers a teardown and
	 * then fails to construct its resource would otherwise leave a dead closure
	 * in the list forever — and the durable engine's memo deliberately lets a
	 * request retry a transient construction failure, so "forever" compounds:
	 * one dead callback per failed attempt, every one of them running at
	 * shutdown.
	 */
	readonly onDispose: (teardown: () => void | Promise<void>) => () => void;
};

/**
 * Keyed on `globalThis` rather than held in a module-level `let`.
 *
 * Vite replaces the module object on every hot update, so a module-scoped
 * singleton is re-created per edit while the previous store, its sessions,
 * and anything subscribed to them stay alive and unreachable. Across a
 * working session that is an unbounded leak, and it is invisible — the app
 * keeps working, just against a store that silently lost its history.
 *
 * `Symbol.for` rather than a string key so the slot cannot collide with an
 * unrelated global, and survives the module identity change that HMR causes.
 */
const RUNTIME_SLOT = Symbol.for('cinder.chat-room.server-owned.runtime');
const DISPOSAL_SLOT = Symbol.for('cinder.chat-room.server-owned.disposal');
const TERMINATING_SLOT = Symbol.for('cinder.chat-room.server-owned.terminating');

type RuntimeHost = typeof globalThis & {
	[RUNTIME_SLOT]?: StoredRuntime;
	/**
	 * The disposal currently in flight, so overlapping callers await it rather
	 * than each concluding there is nothing to do.
	 *
	 * Without this, the second of two disposals returns immediately — the first
	 * clears the runtime slot before running any teardown — and with two signal
	 * handlers registered that is a live sequence: SIGTERM starts an
	 * asynchronous engine shutdown, SIGINT arrives before it settles, finds an
	 * empty slot, and reaches `process.exit` while the first disposal is still
	 * awaiting a checkpoint flush. The exit wins, and the flush is lost.
	 */
	[DISPOSAL_SLOT]?: Promise<{ failures: number }> | undefined;
	/**
	 * Set once a TERMINATING disposal starts, and lifted only by a non-draining
	 * disposal — which means "tear down and carry on" rather than "stop".
	 *
	 * This is what makes draining provably finite. The previous version capped
	 * the drain at three generations, which broke the promise `drain` makes —
	 * a request creating a replacement during each pass leaves the last one
	 * undisposed, and the signal handler exits the moment the loop ends. A cap
	 * cannot fix that, because the loop only terminates by giving up.
	 *
	 * Refusing new runtimes ends it instead: after the pass that disposes the
	 * final generation, nothing can create another.
	 */
	[TERMINATING_SLOT]?: true | undefined;
};

type RuntimeTeardown = () => void | Promise<void>;

type StoredRuntime = {
	runtime: Omit<ServerOwnedRuntime, 'shutdownSignal'> & {
		readonly shutdownSignal?: AbortSignal;
	};
	shutdownController?: AbortController;
	teardowns: RuntimeTeardown[];
};

type HeldRuntime = {
	runtime: ServerOwnedRuntime;
	shutdownController: AbortController;
	teardowns: RuntimeTeardown[];
};

function isCurrentRuntimeSlot(held: StoredRuntime): held is HeldRuntime {
	return (
		held.shutdownController !== undefined &&
		held.runtime.shutdownSignal === held.shutdownController.signal
	);
}

/**
 * Process-stable marker for "the runtime is going away".
 *
 * Same reasoning as `RETIREMENT_FAILURE`, and carried here because the same
 * mistake was made twice: a module re-evaluation creates a NEW class object, so
 * an error thrown by one evaluation is not `instanceof` another's. With HMR
 * that is not hypothetical — an older evaluation can be handed a newer
 * evaluation's rejected promise, and an `instanceof` check on it answers "no"
 * and turns a shutdown into a generic 500.
 */
export const SHUTDOWN_FAILURE = Symbol.for('cinder.chat-room.server-owned.shutdown-failure');

/**
 * Thrown by `serverOwnedRuntime()` once termination has begun.
 *
 * A request arriving during shutdown gets an error rather than a runtime that
 * is about to be torn down underneath it. That is the honest outcome: the
 * alternative is a run whose engine is stopped mid-flight, which the client
 * sees as a truncated stream with no explanation.
 */
export class RuntimeTerminatingError extends Error {
	readonly [SHUTDOWN_FAILURE] = true;

	override readonly name = 'RuntimeTerminatingError';

	constructor() {
		super('The server-owned runtime is shutting down and is not accepting new work.');
	}
}

function createRuntime(): HeldRuntime {
	const { storage, durability, release } = serverOwnedStorage();
	const store = textValueStore(storage);
	const sessions = createSessionStore(store);
	const teardowns: Array<() => void | Promise<void>> = [];
	const shutdownController = new AbortController();

	// Registered FIRST, which — because teardowns run in reverse registration
	// order — makes it run LAST, after the durable engine that writes through
	// this storage has shut down. Closing the database out from under a running
	// engine would be the opposite of a clean disposal.
	//
	// `release`, NOT `storage[Symbol.dispose]`. The in-memory adapter's dispose
	// clears its contents, so calling it here would delete every session and
	// checkpoint on the way out — the destructive shutdown the test below
	// pins against, and which a first attempt at this reintroduced.
	// `serverOwnedStorage` knows which adapter it built and hands back a
	// release that is a no-op for the one with nothing to release.
	//
	// Without it, every dispose-and-recreate cycle — which is what an HMR edit
	// does — left the previous SQLite connection and its WAL open while opening
	// another to the same file.
	teardowns.push(release);

	return {
		runtime: {
			storage,
			store,
			sessions,
			durability,
			shutdownSignal: shutdownController.signal,
			onDispose: (teardown) => {
				teardowns.push(teardown);
				return () => {
					const index = teardowns.indexOf(teardown);
					if (index !== -1) teardowns.splice(index, 1);
				};
			}
		},
		teardowns,
		shutdownController
	};
}

function currentRuntimeSlot(held: StoredRuntime): HeldRuntime {
	if (isCurrentRuntimeSlot(held)) return held;

	const shutdownController = held.shutdownController ?? new AbortController();
	Object.defineProperty(held.runtime, 'shutdownSignal', {
		configurable: true,
		enumerable: true,
		value: shutdownController.signal,
		writable: true
	});

	return {
		runtime: held.runtime as ServerOwnedRuntime,
		teardowns: held.teardowns,
		shutdownController
	};
}

/**
 * The process's server-owned runtime, created on first use.
 */
export function serverOwnedRuntime(): ServerOwnedRuntime {
	const host = globalThis as RuntimeHost;
	// Refused rather than built. See `TERMINATING_SLOT`: admitting one more
	// runtime here is what made the drain unable to finish.
	if (host[TERMINATING_SLOT] === true) throw new RuntimeTerminatingError();
	const held = host[RUNTIME_SLOT];
	if (held === undefined) {
		const created = createRuntime();
		host[RUNTIME_SLOT] = created;
		return created.runtime;
	}

	const current = currentRuntimeSlot(held);
	host[RUNTIME_SLOT] = current;
	return current.runtime;
}

/**
 * Tears the runtime down and forgets it, so the next call to
 * `serverOwnedRuntime()` builds a fresh one.
 *
 * Teardowns run in REVERSE registration order, because a teardown registered
 * later may DEPEND on something registered earlier still being intact: a
 * durable engine registered after the session store it writes through has to
 * stop before anything that store depends on is torn down. Reverse order gives
 * that for free without every caller reasoning about it.
 *
 * Not because the store is cleared — it is not. `runDisposal` deliberately
 * leaves storage alone so a graceful shutdown cannot erase persistent sessions
 * or checkpoints, and a test pins that. An earlier version of this paragraph
 * justified the ordering by a deletion that was removed on purpose.
 *
 * Each teardown is awaited and isolated: one that throws is reported and the
 * rest still run, because a half-disposed runtime is the failure this
 * function exists to prevent.
 */
export async function disposeServerOwnedRuntime(
	options: {
		/**
		 * Also dispose any runtime built WHILE this disposal was running.
		 *
		 * For termination only, which is why it is opt-in rather than the
		 * default. During shutdown an in-flight request can reach
		 * `serverOwnedRuntime()` after the slot is cleared and before the
		 * teardowns finish, build a replacement, and start a durable engine on
		 * it — and the signal handler exits as soon as the disposal it started
		 * resolves, cutting that engine off with no teardown and no checkpoint
		 * flush.
		 *
		 * Draining LATCHES termination: `serverOwnedRuntime()` refuses with
		 * `RuntimeTerminatingError` for the rest of the process, and the drain
		 * runs until the slot is empty rather than for a fixed number of passes.
		 * That is what makes it finite — after the pass disposing the last
		 * generation admitted before the latch, nothing can create another.
		 *
		 * An earlier version let requests keep building replacements and capped
		 * the drain at three passes instead. That could not work: a loop whose
		 * exit condition is "nothing new appeared" cannot be fixed by giving up
		 * after N tries, and the generation left undisposed was cut off by the
		 * exit anyway.
		 *
		 * Off by default because the same function is how the specs reset: there,
		 * a runtime built after disposal is the NEXT test's, and refusing it
		 * would fail the thing the caller just asked for. A non-draining
		 * disposal also LIFTS the latch, since it means "tear down and carry
		 * on". The difference is whether the process intends to keep running,
		 * which only the caller knows.
		 */
		drain?: boolean;
	} = {}
): Promise<{ failures: number }> {
	const host = globalThis as RuntimeHost;

	// The latch is decided FIRST, above every early return below — including the
	// in-flight join. Both directions were wrong before, in opposite ways:
	//
	//   * A terminating call that JOINED an in-flight ordinary disposal never
	//     reached `drainDisposal`, which was the only place that set the latch.
	//     The joined disposal had already cleared the runtime slot, so a request
	//     could still build a replacement and the signal handler would exit
	//     without disposing it.
	//   * An ordinary call arriving while a drain was in flight LIFTED the
	//     latch, re-admitting runtimes in the middle of the shutdown that had
	//     just closed the door.
	//
	// Set unconditionally when draining; lifted only when nothing is in flight,
	// which is exactly the specs' reset — a plain disposal with no shutdown
	// underway means "tear down and carry on". A plain disposal that joins a
	// drain leaves the latch alone and gets the drain's result.
	//
	// It also has to run when there is no runtime to dispose, which is the
	// ordinary case for a spec's `afterEach`. Placing it lower was an earlier
	// attempt and did nothing: disposal returns early when nothing is held, so
	// the latch survived into the next test and four unrelated suites went red.
	if (options.drain === true) {
		host[TERMINATING_SLOT] = true;
	} else if (host[DISPOSAL_SLOT] === undefined) {
		host[TERMINATING_SLOT] = undefined;
	}

	// An overlapping caller joins the disposal already running instead of
	// returning a vacuous success. Read before the slot check below, because by
	// then the first caller has already cleared the runtime and a second one
	// would otherwise see "nothing to dispose" and carry on — which, from a
	// signal handler, means exiting the process out from under it.
	const inFlight = host[DISPOSAL_SLOT];
	if (inFlight !== undefined) {
		const joined = await inFlight;
		if (options.drain !== true) return joined;

		// A TERMINATING call that joined an ORDINARY disposal is not finished.
		// The latch above stops further replacements, but one may already exist:
		// the ordinary disposal cleared the runtime slot, a request built a
		// replacement, and then this call arrived. `runDisposal` never looks at
		// that replacement, so returning here would let the signal handler exit
		// the moment the joined promise settled — cutting the replacement's
		// engine off with no teardown and no checkpoint flush.
		//
		// Bounded: the latch is set, so at most the one generation admitted
		// before it can be waiting here.
		const remaining = host[RUNTIME_SLOT];
		if (remaining === undefined) {
			// EMPTY IS NOT THE SAME AS FINISHED. Two terminating calls can join
			// one ordinary disposal and both resume when it settles; the first
			// starts the drain, which clears the runtime slot synchronously,
			// and this one then finds nothing. Returning here would resolve it
			// while that replacement's teardown is still running — and a signal
			// handler awaiting THIS promise exits mid-teardown, cutting off the
			// checkpoint flush the drain exists to protect.
			//
			// So join the follow-on drain rather than reporting success on the
			// strength of an empty slot.
			const followOn = host[DISPOSAL_SLOT];
			if (followOn === undefined) return joined;

			const drained = await followOn;
			return { failures: joined.failures + drained.failures };
		}

		// PUBLISHED before anything can await it, so the sibling above finds it.
		// `drainDisposal` runs its synchronous prefix — through `runDisposal`'s
		// `RUNTIME_SLOT = undefined` — and returns a promise without yielding,
		// so these two lines are one atomic step as far as other continuations
		// are concerned. The ordinary disposal has already cleared this slot in
		// its own `finally` by the time any joiner resumes, so nothing is being
		// overwritten. An await between them would reopen the hole.
		const drain = drainDisposal(host, remaining);
		host[DISPOSAL_SLOT] = drain;
		try {
			const drained = await drain;
			return { failures: joined.failures + drained.failures };
		} finally {
			// Identity-checked, like every other slot release here: clearing
			// unconditionally would erase a successor's promise.
			if (host[DISPOSAL_SLOT] === drain) host[DISPOSAL_SLOT] = undefined;
		}
	}

	const held = host[RUNTIME_SLOT];
	if (held === undefined) return { failures: 0 };

	const disposal = options.drain === true ? drainDisposal(host, held) : runDisposal(host, held);
	host[DISPOSAL_SLOT] = disposal;
	try {
		return await disposal;
	} finally {
		host[DISPOSAL_SLOT] = undefined;
	}
}

/**
 * Disposes the held runtime, and then any GENERATION created while it drained.
 *
 * The window is real and the signal handler makes it consequential: disposal
 * clears the runtime slot before running teardowns, so an in-flight request
 * reaching `serverOwnedRuntime()` in between builds a replacement — and can
 * start a durable engine on it. The handler awaits only the disposal it
 * started and then calls `process.exit`, so that replacement engine is cut off
 * with no teardown and no checkpoint flush.
 *
 * What the drain covers is the generation admitted BEFORE the latch. Once
 * termination has latched, `serverOwnedRuntime()` does not hand out a
 * replacement at all — it throws `RuntimeTerminatingError`, and a teardown that
 * reaches for one has that counted as a teardown failure like any other. So
 * this is not "let requests keep building runtimes and dispose those too": it
 * is refusal from the latch onward, and a finite drain of whatever slipped in
 * before it.
 *
 * That is the reverse of how this paragraph originally read. Serving late
 * requests was the first design, and it could not terminate — each served
 * request could produce another generation, so the loop had no exit condition
 * that did not amount to giving up.
 *
 * FINITE by the latch, not by a pass count. `serverOwnedRuntime()` refuses once
 * termination begins, so after the pass that disposes the last generation
 * admitted before the latch, nothing can create another and the loop ends
 * because the slot is empty.
 *
 * An earlier version bounded it at three passes, which is what this comment
 * used to describe. That could not work: a loop whose exit condition is
 * "nothing new appeared" cannot be fixed by giving up after N tries, and the
 * generation it left undisposed was cut off by the exit anyway.
 */
async function drainDisposal(
	host: RuntimeHost,
	held: StoredRuntime
): Promise<{ failures: number }> {
	// The latch is already set by `disposeServerOwnedRuntime`, before any early
	// return, so that a terminating call which JOINS an in-flight disposal
	// latches too. Reasserted here rather than assumed, because this function's
	// termination argument depends on it: nothing can be admitted while the
	// loop runs, so each pass disposes one generation and the slot is empty
	// within one pass of the last request that got in.
	//
	// An earlier version capped this at three passes instead, which could not
	// work — a loop that ends by giving up leaves the final runtime undisposed,
	// and the signal handler exits the moment it returns.
	host[TERMINATING_SLOT] = true;

	let failures = 0;
	let generation: StoredRuntime | undefined = host[RUNTIME_SLOT] ?? held;

	while (generation !== undefined) {
		failures += (await runDisposal(host, generation)).failures;
		// A replacement built by a request that got in before the latch, during
		// the pass above. `undefined` is the ordinary case.
		generation = host[RUNTIME_SLOT];
	}

	return { failures };
}

async function runDisposal(host: RuntimeHost, held: StoredRuntime): Promise<{ failures: number }> {
	const current = currentRuntimeSlot(held);

	// Cleared BEFORE the teardowns run, so a teardown cannot reach the
	// half-disposed runtime it is in the middle of tearing down.
	//
	// What it gets INSTEAD depends on why disposal is happening. An ordinary
	// disposal — the specs' reset — hands it a fresh runtime. A terminating one
	// refuses, because admitting a new generation is what stopped the drain
	// finishing; the teardown sees `RuntimeTerminatingError`, which disposal
	// isolates and counts like any other teardown failure.
	host[RUNTIME_SLOT] = undefined;
	// Abort request-scoped waits after the slot is closed and before the first
	// teardown. This also covers replacement generations started by a
	// terminating caller that joined an ordinary disposal.
	current.shutdownController.abort();

	let failures = 0;
	for (const teardown of [...current.teardowns].reverse()) {
		try {
			await teardown();
		} catch (cause) {
			failures += 1;

			// REPORTED, not just counted. This module's contract says a
			// throwing teardown is isolated AND reported, and only the first
			// half was true: the count told an operator that something failed
			// to shut down without saying what or why, which for a rejected
			// `engine.shutdown()` means losing the storage or engine error that
			// is the entire diagnostic.
			//
			// `writeSync` rather than `console.error`, for the same reason
			// `reportBeforeExit` uses it: this runs during a terminating
			// disposal, and a pipe write can still be in flight when
			// `process.exit` runs. Isolation is unchanged — the loop continues,
			// so a failing teardown cannot strand the ones after it.
			reportBeforeExit(
				`[server-owned] A teardown rejected during disposal: ${describeCause(cause)}`
			);
		}
	}

	// The storage is NOT cleared here, and that is deliberate.
	//
	// It used to be, which was harmless only because the storage is
	// `MemoryStorage` and dies with the process anyway. This module's own
	// documentation says swapping that for a persistent Weft `Storage` is the
	// single change a durable backing store needs — and under that swap, every
	// SIGTERM would have deleted every session and every checkpoint
	// immediately before exiting. A graceful restart would have been the most
	// destructive thing the process could do, and the claim that the swap is
	// the only step would have been false.
	//
	// Disposal's job is to STOP things: run the teardowns, let the engine
	// finish its writes. Deleting data is a test-fixture concern, and the
	// suites that need a clean slate get one for free — disposal clears the
	// runtime slot, so the next `serverOwnedRuntime()` builds a new storage
	// rather than reusing the old one's contents.
	return { failures };
}

// NO `import.meta.hot.dispose` hook here, deliberately, and the reason was
// measured rather than assumed.
//
// Vite does not hot-accept server modules: editing one logs
// `(ssr) page reload` and re-evaluates it on the next request. A dispose hook
// therefore never fires in this setup — verified by creating a conversation,
// editing this file, and finding the conversation still listed afterwards.
//
// It would also be the wrong behaviour if it did fire: disposing on every
// edit would clear the store mid-session, so a developer would lose their
// conversations each time they touched a file. The `globalThis` slot above is
// what actually prevents the leak, by surviving the module replacement that
// would otherwise strand a store.
//
// Explicit disposal remains available — `disposeServerOwnedRuntime()` is what
// the specs use, and what a process teardown would call.

/**
 * Tear the runtime down when the process is asked to stop.
 *
 * Without this nothing in production ever calls `disposeServerOwnedRuntime()`:
 * the durable engine's `shutdown()` teardown is registered but only the specs
 * reach it, so a deployed server would hold the engine open through SIGTERM
 * and rely on the process being killed. That works, and it means an orderly
 * shutdown never happens — in-flight checkpoint writes are cut off rather than
 * finished.
 *
 * Registered once per process, guarded on `globalThis` for the same reason the
 * runtime is: Vite re-evaluates server modules on edit, and a module-scoped
 * guard would add another pair of listeners on every reload until Node warns
 * about a leak.
 *
 * The process is TERMINATED afterwards, and that half is not optional. Adding a
 * SIGTERM listener REPLACES Node's default behaviour for that signal, which is
 * to terminate — so a handler that only starts a cleanup and returns leaves
 * the process running. With an HTTP server still holding the event loop open,
 * the first version of this made shutdown strictly worse than having no
 * handler at all: an orchestrator's SIGTERM would be absorbed and the process
 * would sit until the SIGKILL that follows it.
 *
 * Terminating EXPLICITLY rather than re-raising the signal, which was the
 * first attempt and rested on an assumption this module has no right to make.
 * Re-raising works only if nothing else is listening: `process.once` has
 * removed this listener, so a second delivery finds none and Node's default
 * runs. But a host with its own PERSISTENT listener for the same signal
 * receives that second delivery too, and suppresses the default exactly as
 * this module did — leaving the process alive after all, for the same reason
 * and one level further down.
 *
 * So this takes ownership instead of hoping. Registering a signal handler at
 * import already claims responsibility for that signal; the only coherent
 * positions are to own termination or to register nothing at all, and
 * "register a handler that does not terminate" is the bug this replaced.
 *
 * 128 + the signal's number is the status a shell reports for a process killed
 * by that signal, so nothing about the exit code is invented — it is the value
 * the default behaviour would have produced.
 *
 * The cost, stated rather than hidden: any other listener's still-in-flight
 * async cleanup is cut off at the exit. Those listeners have already RUN — the
 * first delivery reached every one of them — so what is lost is work that had
 * not finished. A host that needs more than that should remove these handlers
 * and drive `disposeServerOwnedRuntime()` from its own lifecycle, which is the
 * right shape for a deployment and is not available to this lab.
 */
const SIGNALS_SLOT = Symbol.for('cinder.chat-room.server-owned.signals');
const HANDLER_SLOT = Symbol.for('cinder.chat-room.server-owned.signal-handler');
const LISTENERS_SLOT = Symbol.for('cinder.chat-room.server-owned.signal-listeners');

/**
 * Dispatch protocol version for the installed listeners.
 *
 * Bump this whenever the listener's CONTRACT with the module changes — which
 * slot it reads, what it passes, what it expects back. It is not a version of
 * the handler's behaviour: that is refreshed through `HANDLER_SLOT` on every
 * evaluation and needs no bump.
 *
 * Why it has to exist: `SIGNALS_SLOT` makes registration idempotent, which is
 * right, but it also means listeners installed by an OLDER evaluation survive
 * forever. Those listeners read whatever slot that version knew about — and
 * when this module moved from a disposer slot to a handler slot, they went on
 * reading a slot nothing writes any more. The new implementation was
 * unreachable until a full restart, which is precisely the staleness the
 * indirection was built to prevent, reintroduced at the upgrade boundary.
 */
const LISTENER_PROTOCOL = 2;

type TerminationHandler = (signal: 'SIGTERM' | 'SIGINT', forced: boolean) => void;

type InstalledListeners = {
	protocol: number;
	entries: ReadonlyArray<readonly ['SIGTERM' | 'SIGINT', NodeJS.SignalsListener]>;
};

type SignalHost = typeof globalThis & {
	[SIGNALS_SLOT]?: true | undefined;
	[HANDLER_SLOT]?: TerminationHandler;
	[LISTENERS_SLOT]?: InstalledListeners;
};

/** The status a shell reports for a process killed by each signal. */
const TERMINATION_STATUS = { SIGTERM: 143, SIGINT: 130 } as const;

/**
 * Writes a diagnostic that survives the `process.exit` immediately after it.
 *
 * `console.error` to a PIPE is asynchronous — a container or a supervisor
 * capturing stderr gets a pipe, not a terminal — so the write can still be in
 * flight when the process is killed, and the one message saying a checkpoint
 * flush failed is exactly the one that disappears. This module's own signal
 * fixture already records that hazard for its marker file; the same applies
 * here.
 *
 * `writeSync` has completed by the time it returns. Falling back to
 * `console.error` for a runtime without it costs nothing and keeps this from
 * being the thing that throws during shutdown.
 */
function reportBeforeExit(message: string): void {
	try {
		writeSync(2, `${message}\n`);
	} catch {
		console.error(message);
	}
}

/**
 * Renders a thrown value for a SERVER-SIDE log line.
 *
 * Name and message only, and no stack: this goes to stderr during shutdown,
 * where the useful content is which error it was, and a multi-line stack
 * interleaved with other teardowns' output is harder to read rather than
 * easier. Nothing here reaches a client — that boundary is the route's
 * responsibility, and this deliberately produces a string so a caller cannot
 * accidentally forward a live error object across it.
 */
function describeCause(cause: unknown): string {
	// NO-THROW, and this is not defensive decoration. It is called from inside
	// the catch that provides disposal's isolation guarantee, so if formatting
	// throws it escapes `runDisposal` and skips every REMAINING teardown —
	// turning one failed teardown into a shutdown that abandons the rest,
	// which is the exact failure the isolation exists to prevent.
	//
	// A value can make it throw without being exotic: `String(cause)` runs a
	// user `toString`, and a rejection carrying `{ toString() { throw … } }` is
	// enough. Anything reached here has already failed once; it does not get a
	// second chance to take the shutdown with it.
	try {
		if (cause instanceof Error) {
			return cause.name === 'Error' ? cause.message : `${cause.name}: ${cause.message}`;
		}
		return typeof cause === 'string' ? cause : String(cause);
	} catch {
		// The type is still worth reporting even when the value will not
		// describe itself — it distinguishes "an object that would not
		// stringify" from "nothing was thrown".
		return `a ${typeof cause} that could not be described`;
	}
}

const signalHost = globalThis as SignalHost;

/**
 * The WHOLE signal implementation, refreshed on every module evaluation.
 *
 * An earlier version refreshed only `disposeServerOwnedRuntime` through a
 * disposer slot, which fixed half the problem and left a subtler half behind:
 * the listener installed by the first evaluation still closed over
 * THAT evaluation's reporting — `reportBeforeExit`, the failure-count message,
 * the `catch` wording, the exit status table. So an edit to how a failed
 * checkpoint flush is surfaced would load, look active, and never run, which is
 * exactly the class of bug that indirection was added to close. That slot is
 * gone; one reference now carries everything.
 *
 * Everything that could be edited now lives behind one reference. The listener
 * is a two-line dispatch that has no reason to change again.
 */
function handleTerminationSignal(signal: 'SIGTERM' | 'SIGINT', forced: boolean): void {
	if (forced) {
		// Asked twice. Give up on the orderly shutdown rather than ignoring the
		// signal — whoever sent it a second time is telling us they are done
		// waiting.
		process.exit(TERMINATION_STATUS[signal]);
	}

	// `finally`, so a teardown that REJECTS still terminates. Disposal already
	// isolates and counts each failing teardown, so a rejection here would be
	// something outside that loop — and "cleanup failed" is not a reason to
	// ignore a termination signal.
	//
	// Deliberately no watchdog timer. A disposal that never settles would hang,
	// and the honest fix for that is whatever is hanging, not a timer that
	// hides it.
	//
	// `drain`, because this one is terminating: a request that builds a
	// replacement runtime while the teardowns run would otherwise be cut off by
	// the exit below.
	void disposeServerOwnedRuntime({ drain: true })
		.then(({ failures }) => {
			// REPORTED, not discarded. `runDisposal` converts a rejecting
			// teardown into a resolved count, so without this a failed
			// checkpoint flush exits exactly like a clean shutdown — and the one
			// moment an operator needs to know the engine did not finish writing
			// is the moment the process disappears. Each individual cause is
			// reported by `runDisposal` as it happens; this is the summary.
			if (failures > 0) {
				reportBeforeExit(`server-owned runtime: ${failures} teardown(s) failed during shutdown`);
			}
		})
		.catch((cause: unknown) => {
			// Disposal itself throwing is outside the per-teardown isolation, so
			// it has nowhere else to be seen.
			reportBeforeExit(
				`server-owned runtime: disposal failed during shutdown: ${describeCause(cause)}`
			);
		})
		.finally(() => {
			process.exit(TERMINATION_STATUS[signal]);
		});
}

// REFRESHED every evaluation; the listeners below read it at fire time.
signalHost[HANDLER_SLOT] = handleTerminationSignal;

// An older evaluation's listeners are REMOVED when they speak a different
// protocol, rather than left installed beside the new ones. Leaving both would
// run two shutdowns and two `process.exit` calls for one signal; leaving only
// the old ones — which is what happened before this existed — makes every
// later edit to shutdown unreachable until a restart.
//
// ONE UPGRADE THIS CANNOT MIGRATE, stated rather than papered over: an
// evaluation that predates this registry set `SIGNALS_SLOT` without recording
// its listeners, so hot-updating from such a version leaves `LISTENERS_SLOT`
// undefined and there is nothing to remove them by. `removeAllListeners` is
// not an acceptable substitute — a host may have installed its own SIGTERM
// handler (see `HOST_LISTENER` in the signal fixture), and tearing that off
// would be a far worse bug than the staleness being fixed. Taking listeners we
// did not install is not ours to do.
//
// The consequence is bounded: that old listener still disposes, through its own
// closed-over implementation, so shutdown is not broken — only stale. One
// dev-server restart clears it, and from this protocol forward the migration
// works without one.
//
// A restart is required only when crossing THIS boundary, because from here on
// every evaluation records what it installed.
const installed = signalHost[LISTENERS_SLOT];
if (
	installed !== undefined &&
	installed.protocol !== LISTENER_PROTOCOL &&
	typeof process !== 'undefined'
) {
	for (const [signal, listener] of installed.entries) process.off(signal, listener);
	signalHost[LISTENERS_SLOT] = undefined;
	signalHost[SIGNALS_SLOT] = undefined;
}

if (signalHost[SIGNALS_SLOT] !== true && typeof process !== 'undefined') {
	signalHost[SIGNALS_SLOT] = true;

	/**
	 * Whether a shutdown is already running, so a REPEATED signal is a
	 * deliberate decision rather than an accident.
	 *
	 * `process.once` removed the listener after the first delivery, so a second
	 * SIGINT — two impatient Ctrl-Cs while the engine is flushing — took Node's
	 * default path and killed the process mid-disposal. That is the same
	 * outcome a forced exit gives, but arrived at by the handler no longer
	 * being installed rather than by anyone deciding it, and it could not be
	 * tested or changed.
	 *
	 * `process.on` keeps a handler installed, and the second delivery is now an
	 * explicit forced exit: the conventional "press it again to stop waiting".
	 *
	 * Held HERE rather than inside the handler, because it belongs to the
	 * process's shutdown rather than to any one module evaluation's copy of the
	 * logic.
	 */
	let terminating = false;

	const entries: Array<readonly ['SIGTERM' | 'SIGINT', NodeJS.SignalsListener]> = [];

	for (const signal of ['SIGTERM', 'SIGINT'] as const) {
		const listener: NodeJS.SignalsListener = () => {
			const forced = terminating;
			terminating = true;

			// Read at FIRE time, so a reloaded module's implementation is the
			// one that runs — reporting included, not just disposal.
			const handle = (globalThis as SignalHost)[HANDLER_SLOT] ?? handleTerminationSignal;
			handle(signal, forced);
		};

		process.on(signal, listener);
		entries.push([signal, listener]);
	}

	// RECORDED, so a future evaluation whose protocol differs can take these
	// back off. Without the references there is no way to replace them, which
	// is the position the previous version was in.
	signalHost[LISTENERS_SLOT] = { protocol: LISTENER_PROTOCOL, entries };
}
