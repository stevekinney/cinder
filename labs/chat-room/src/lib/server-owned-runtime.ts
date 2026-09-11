import { createSessionStore } from '@lostgradient/operative';
import type { SessionStore } from '@lostgradient/operative';
import { MemoryStorage } from '@lostgradient/weft/storage/memory';
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
	readonly storage: MemoryStorage;
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

type RuntimeHost = typeof globalThis & {
	[RUNTIME_SLOT]?: { runtime: ServerOwnedRuntime; teardowns: Array<() => void | Promise<void>> };
};

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
export async function disposeServerOwnedRuntime(): Promise<{ failures: number }> {
	const host = globalThis as RuntimeHost;
	const held = host[RUNTIME_SLOT];
	if (held === undefined) return { failures: 0 };

	// Cleared BEFORE the teardowns run: a teardown that reaches for the
	// runtime gets a fresh one rather than the half-disposed one it is in the
	// middle of tearing down.
	host[RUNTIME_SLOT] = undefined;

	let failures = 0;
	for (const teardown of [...held.teardowns].reverse()) {
		try {
			await teardown();
		} catch {
			failures += 1;
		}
	}
	await held.runtime.storage.clear();
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

type SignalHost = typeof globalThis & { [SIGNALS_SLOT]?: true };

/** The status a shell reports for a process killed by each signal. */
const TERMINATION_STATUS = { SIGTERM: 143, SIGINT: 130 } as const;

const signalHost = globalThis as SignalHost;
if (signalHost[SIGNALS_SLOT] !== true && typeof process !== 'undefined') {
	signalHost[SIGNALS_SLOT] = true;
	for (const signal of ['SIGTERM', 'SIGINT'] as const) {
		process.once(signal, () => {
			// `finally`, so a teardown that REJECTS still terminates. Disposal
			// already isolates and counts each failing teardown, so a rejection
			// here would be something outside that loop — and "cleanup failed"
			// is not a reason to ignore a termination signal.
			//
			// Deliberately no watchdog timer. A disposal that never settles
			// would hang, and the honest fix for that is whatever is hanging,
			// not a timer that hides it.
			void disposeServerOwnedRuntime().finally(() => {
				process.exit(TERMINATION_STATUS[signal]);
			});
		});
	}
}
