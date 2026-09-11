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
	 */
	readonly onDispose: (teardown: () => void | Promise<void>) => void;
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
