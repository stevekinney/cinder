import { writeSync } from 'node:fs';

import { createSessionStore } from '@lostgradient/operative';
import type { SessionStore } from '@lostgradient/operative';
import { MemoryStorage } from '@lostgradient/weft/storage/memory';
import type { Storage } from '@lostgradient/weft/storage/interface';
import { textValueStore } from '@lostgradient/weft/storage/text-value-store';
import type { ConditionalTextValueStore } from '@lostgradient/weft/storage/text-value-store';

/**
 * The server-owned variant's process-wide runtime: one storage, one
 * text-value store over it, and one `SessionStore` over that.
 *
 * Every Operative session API takes a `ConditionalTextValueStore`, so this
 * composition is the entry point rather than a convenience — `MemoryStorage`
 * → `textValueStore` → `createSessionStore` is the shortest path from Weft's
 * storage primitives to Operative's session surface.
 *
 * In-memory on purpose: this is a lab demonstrating the server-owned shape,
 * not a deployment. Swapping `MemoryStorage` for any other Weft `Storage` is
 * the only change a durable backing store would need, which is itself part of
 * what the variant is meant to show.
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
	[RUNTIME_SLOT]?: { runtime: ServerOwnedRuntime; teardowns: Array<() => void | Promise<void>> };
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

/**
 * Thrown by `serverOwnedRuntime()` once termination has begun.
 *
 * A request arriving during shutdown gets an error rather than a runtime that
 * is about to be torn down underneath it. That is the honest outcome: the
 * alternative is a run whose engine is stopped mid-flight, which the client
 * sees as a truncated stream with no explanation.
 */
export class RuntimeTerminatingError extends Error {
	override readonly name = 'RuntimeTerminatingError';

	constructor() {
		super('The server-owned runtime is shutting down and is not accepting new work.');
	}
}

function createRuntime(): {
	runtime: ServerOwnedRuntime;
	teardowns: Array<() => void | Promise<void>>;
} {
	const storage = new MemoryStorage();
	const store = textValueStore(storage);
	const sessions = createSessionStore(store);
	const teardowns: Array<() => void | Promise<void>> = [];

	return {
		runtime: {
			storage,
			store,
			sessions,
			onDispose: (teardown) => {
				teardowns.push(teardown);
				return () => {
					const index = teardowns.indexOf(teardown);
					if (index !== -1) teardowns.splice(index, 1);
				};
			}
		},
		teardowns
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
	host[RUNTIME_SLOT] ??= createRuntime();
	return host[RUNTIME_SLOT].runtime;
}

/**
 * Tears the runtime down and forgets it, so the next call to
 * `serverOwnedRuntime()` builds a fresh one.
 *
 * Teardowns run in REVERSE registration order — a durable run registered
 * after the store it writes to must stop before that store is cleared, and
 * reverse order gives that for free without every caller reasoning about it.
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
		if (remaining === undefined) return joined;

		const drained = await drainDisposal(host, remaining);
		return { failures: joined.failures + drained.failures };
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
 * Draining rather than blocking: a request that is mid-flight needs a runtime,
 * and refusing it would turn a shutdown into an error the client sees. Letting
 * it build one and then disposing that too is the same guarantee without the
 * failure.
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
	held: { runtime: ServerOwnedRuntime; teardowns: Array<() => void | Promise<void>> }
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
	let generation:
		| { runtime: ServerOwnedRuntime; teardowns: Array<() => void | Promise<void>> }
		| undefined = host[RUNTIME_SLOT] ?? held;

	while (generation !== undefined) {
		failures += (await runDisposal(host, generation)).failures;
		// A replacement built by a request that got in before the latch, during
		// the pass above. `undefined` is the ordinary case.
		generation = host[RUNTIME_SLOT];
	}

	return { failures };
}

async function runDisposal(
	host: RuntimeHost,
	held: { runtime: ServerOwnedRuntime; teardowns: Array<() => void | Promise<void>> }
): Promise<{ failures: number }> {
	// Cleared BEFORE the teardowns run, so a teardown cannot reach the
	// half-disposed runtime it is in the middle of tearing down.
	//
	// What it gets INSTEAD depends on why disposal is happening. An ordinary
	// disposal — the specs' reset — hands it a fresh runtime. A terminating one
	// refuses, because admitting a new generation is what stopped the drain
	// finishing; the teardown sees `RuntimeTerminatingError`, which disposal
	// isolates and counts like any other teardown failure.
	host[RUNTIME_SLOT] = undefined;

	let failures = 0;
	for (const teardown of [...held.teardowns].reverse()) {
		try {
			await teardown();
		} catch {
			failures += 1;
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
const DISPOSER_SLOT = Symbol.for('cinder.chat-room.server-owned.disposer');

type Disposer = (options?: { drain?: boolean }) => Promise<{ failures: number }>;

type SignalHost = typeof globalThis & {
	[SIGNALS_SLOT]?: true;
	[DISPOSER_SLOT]?: Disposer;
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

const signalHost = globalThis as SignalHost;

// REFRESHED on every module evaluation, and the listeners below dispatch
// through it rather than closing over a function directly.
//
// Vite re-evaluates this module on edit while `globalThis` survives, so the
// `SIGNALS_SLOT` guard correctly skips re-registering — but the listeners
// installed by the FIRST evaluation keep calling that evaluation's
// `disposeServerOwnedRuntime`. Changes to draining, teardown ordering, or
// failure reporting then appear loaded while Ctrl-C still runs the old
// shutdown path, which makes a lifecycle experiment measure code that is no
// longer on disk — and can silently reintroduce a teardown bug that was just
// fixed. The same shape as the durable memo surviving a reload, in the one
// place where the symptom only appears at shutdown.
signalHost[DISPOSER_SLOT] = disposeServerOwnedRuntime;

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
	 * The difference from before is that it is a choice, with a name, that a
	 * test can hold.
	 */
	let terminating = false;

	for (const signal of ['SIGTERM', 'SIGINT'] as const) {
		process.on(signal, () => {
			if (terminating) {
				// Asked twice. Give up on the orderly shutdown rather than
				// ignoring the signal — whoever sent it a second time is
				// telling us they are done waiting.
				process.exit(TERMINATION_STATUS[signal]);
			}
			terminating = true;
			// `finally`, so a teardown that REJECTS still terminates. Disposal
			// already isolates and counts each failing teardown, so a rejection
			// here would be something outside that loop — and "cleanup failed"
			// is not a reason to ignore a termination signal.
			//
			// Deliberately no watchdog timer. A disposal that never settles
			// would hang, and the honest fix for that is whatever is hanging,
			// not a timer that hides it.
			// Read at FIRE time, so a reloaded module's implementation is the one
			// that runs. See `DISPOSER_SLOT` above.
			const dispose = (globalThis as SignalHost)[DISPOSER_SLOT] ?? disposeServerOwnedRuntime;

			// `drain`, because this one is terminating: a request that builds a
			// replacement runtime while the teardowns run would otherwise be cut
			// off by the exit below.
			void dispose({ drain: true })
				.then(({ failures }) => {
					// REPORTED, not discarded. `runDisposal` converts a rejecting
					// teardown into a resolved count, so without this a failed
					// checkpoint flush exits exactly like a clean shutdown — and
					// the one moment an operator needs to know the engine did not
					// finish writing is the moment the process disappears.
					if (failures > 0) {
						reportBeforeExit(
							`server-owned runtime: ${failures} teardown(s) failed during shutdown`
						);
					}
				})
				.catch((cause: unknown) => {
					// Disposal itself throwing is outside the per-teardown
					// isolation, so it has nowhere else to be seen.
					reportBeforeExit(
						`server-owned runtime: disposal failed during shutdown: ${
							cause instanceof Error ? cause.message : String(cause)
						}`
					);
				})
				.finally(() => {
					process.exit(TERMINATION_STATUS[signal]);
				});
		});
	}
}
