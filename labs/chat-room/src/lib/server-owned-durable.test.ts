import { afterEach, describe, expect, it } from 'bun:test';

import {
	EngineRetirementError,
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
		const runtime = serverOwnedRuntime();

		// Build A is held INSIDE `createRunEngine`, at its first storage read.
		// Probed rather than guessed: construction touches `get`, `scan`, and
		// `put`, in that order, so blocking the first `get` parks it with the
		// teardown already registered and no engine yet — the exact state this
		// race is about.
		//
		// The previous version of this test waited for disposal to finish and
		// then hoped A was still pending. It usually was, because
		// `createRunEngine` does real I/O while disposal is a few microtasks —
		// but "usually" meant the test could silently stop exercising the path.
		// Now nothing about it depends on relative speed.
		let release: () => void = () => {};
		const heldOpen = new Promise<void>((resolve) => {
			release = resolve;
		});
		const storage = runtime.storage as unknown as {
			get: (key: string) => Promise<Uint8Array | null>;
		};
		const realGet = storage.get.bind(runtime.storage);
		let parked = false;
		storage.get = async (key: string) => {
			if (!parked) {
				parked = true;
				await heldOpen;
			}
			return realGet(key);
		};

		const first = durableRuntime();

		// STARTED, not awaited. Disposal clears the runtime slot synchronously
		// and then parks in A's teardown, which now awaits the construction
		// held open above — so awaiting disposal here would deadlock against
		// the gate this test is holding. That the two wait on each other is the
		// fix working: disposal is not allowed to settle before the engine it
		// is disposing exists.
		const disposal = disposeServerOwnedRuntime();

		// The runtime slot is already cleared, so this builds against a fresh
		// runtime with its own unpatched storage — B is not affected by the
		// gate.
		const second = durableRuntime();

		// Only now does A's construction finish and discover it was disposed.
		// An unconditional `slot = undefined` there erases B's promise, and the
		// third request below finds an empty slot and constructs ANOTHER engine
		// over the same storage — two live engines, which is what memoising was
		// for.
		release();

		await expect(first).rejects.toBeInstanceOf(RuntimeDisposedDuringBuildError);
		await disposal;

		const third = await durableRuntime();
		expect(third).toBe(await second);
	});

	it('does not settle disposal until an in-flight engine build has shut down', async () => {
		const runtime = serverOwnedRuntime();

		// Construction held at its first storage read, as above.
		let release: () => void = () => {};
		const heldOpen = new Promise<void>((resolve) => {
			release = resolve;
		});
		const storage = runtime.storage as unknown as {
			get: (key: string) => Promise<Uint8Array | null>;
		};
		const realGet = storage.get.bind(runtime.storage);
		let parked = false;
		storage.get = async (key: string) => {
			if (!parked) {
				parked = true;
				await heldOpen;
			}
			return realGet(key);
		};

		const building = durableRuntime();
		const disposal = disposeServerOwnedRuntime();

		// Disposal must NOT have settled: the engine it is responsible for
		// stopping does not exist yet. Reading a nullable `engine` here used to
		// return immediately, and the signal handler exits as soon as disposal
		// resolves — so initialization and any checkpoint I/O underway were cut
		// off.
		let disposed = false;
		void disposal.then(() => {
			disposed = true;
		});
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(disposed).toBe(false);

		release();
		await building.catch(() => undefined);
		await disposal;
		expect(disposed).toBe(true);
	});

	it("unregisters a retired engine's teardown instead of leaving it in the list", async () => {
		// Vite re-evaluates this module on every edit, and each evaluation that
		// finds a stale memo retires its engine MANUALLY — `shutdown()` directly,
		// not through the teardown `build` registered. That teardown closes over
		// the engine, so leaving it registered keeps every retired engine
		// reachable from the runtime for the life of the process, and the eventual
		// disposal calls `shutdown()` on all of them again. An afternoon of edits
		// is an afternoon of accumulated dead engines.
		//
		// A reload is simulated by rewriting the memo's module stamp, which is
		// precisely what a re-evaluation changes — `MODULE_GENERATION` is a fresh
		// symbol per evaluation, and the slot lives on `globalThis` under a
		// `Symbol.for` key, so it outlives the module that wrote it.
		const slotKey = Symbol.for('cinder.chat-room.server-owned.durable');
		const host = globalThis as Record<symbol, { module: number } | undefined>;

		const first = await durableRuntime();

		let shutdowns = 0;
		const realShutdown = first.engine.shutdown.bind(first.engine);
		first.engine.shutdown = () => {
			shutdowns += 1;
			return realShutdown();
		};

		const slot = host[slotKey];
		expect(slot).toBeDefined();
		if (slot === undefined) return;
		slot.module = 0;

		// Retires the first engine and builds a replacement over the same runtime.
		const second = await durableRuntime();
		expect(second).not.toBe(first);
		expect(shutdowns).toBe(1);

		// The retired engine's teardown must be GONE from the list, so disposing
		// the runtime does not reach it again.
		await disposeServerOwnedRuntime();

		// Still one. Without the unregister this is 2 — and with N reloads it is
		// N redundant shutdowns plus N engines held alive until process exit.
		expect(shutdowns).toBe(1);
	});

	it('does not build alongside an engine that refused to stop, across chained reloads', async () => {
		// A memo's promise covers the whole retirement-and-build of the evaluation
		// that created it — not just construction. So a later evaluation awaiting
		// it cannot tell "the engine was never built" from "the previous engine
		// refused to die" unless it is told, and those want opposite handling.
		//
		// The reachable shape is OVERLAPPING reloads, and nothing weaker will do:
		// when reloads are sequential, the failing evaluation restores the stale
		// memo on its way out and the next one simply retries the same retirement.
		// It is only when a second evaluation has already replaced the slot token
		// that the first one's restore is declined — leaving the slot holding a
		// REJECTED chain promise, which a plain `.catch(() => undefined)` reads as
		// "nothing to retire". That builds a second engine over the same storage
		// beside one that is still running, which is the condition this memo
		// exists to prevent.
		const slotKey = Symbol.for('cinder.chat-room.server-owned.durable');
		const host = globalThis as Record<symbol, { module: number } | undefined>;
		const restamp = (): void => {
			// 0 is below any real generation, so the slot reads as built by an
			// OLDER evaluation — which is what a reload leaves behind.
			const slot = host[slotKey];
			if (slot !== undefined) slot.module = 0;
		};

		const first = await durableRuntime();

		// The stale engine will not stop, and is held open so the second reload
		// can overlap the first. A shutdown that hangs and then fails is exactly
		// what the retirement path is written for.
		let releaseShutdown: () => void = () => {};
		const shutdownGate = new Promise<void>((resolve) => {
			releaseShutdown = resolve;
		});
		first.engine.shutdown = async () => {
			await shutdownGate;
			throw new Error('this engine will not stop');
		};

		// Reload one, STARTED not awaited: it parks inside the failing shutdown
		// with its own token installed in the slot.
		restamp();
		const reloadOne = durableRuntime();
		await new Promise((resolve) => setTimeout(resolve, 0));

		// Reload two lands on top of it and replaces the token, which is what
		// makes reload one's restore decline.
		restamp();
		const reloadTwo = durableRuntime();

		// Handlers attached BEFORE the gate opens. Both reject, and a rejection
		// with nothing attached to it yet is an unhandled rejection that fails
		// the run on its own — asserting them one after the other leaves the
		// second unattended while the first is awaited.
		const oneSettled = reloadOne.then(
			() => 'resolved' as const,
			(cause: unknown) => cause
		);
		const twoSettled = reloadTwo.then(
			() => 'resolved' as const,
			(cause: unknown) => cause
		);

		releaseShutdown();

		expect(await oneSettled).toBeInstanceOf(EngineRetirementError);

		// The one that matters. Without the failure surviving the hand-off this
		// is `'resolved'` — a brand new engine running over the same storage as
		// `first`, which never stopped.
		expect(await twoSettled).toBeInstanceOf(EngineRetirementError);

		// Restored so `afterEach` can dispose without the poisoned shutdown.
		first.engine.shutdown = () => Promise.resolve(true);
	});

	it('recognises a retirement failure thrown by a PREVIOUS module evaluation', async () => {
		// The chained-reload test above cannot reach this: it restamps the memo
		// within one evaluation, so every error it produces comes from this
		// evaluation's `EngineRetirementError` class and `instanceof` happens to
		// work. Vite re-evaluating the module creates a NEW class object, and an
		// error from the previous one is not an instance of it — so `instanceof`
		// answers "no" at exactly the moment the answer matters, swallows the
		// failure, and builds a second engine beside one that would not stop.
		//
		// A foreign object carrying the same REGISTRY symbol is precisely what a
		// previous evaluation's error looks like from here: same tag, different
		// constructor. Nothing else reproduces constructor turnover in-process.
		const tag = Symbol.for('cinder.chat-room.server-owned.retirement-failure');
		const fromAnEarlierEvaluation = Object.assign(
			new Error('a stale durable engine could not be shut down'),
			{ [tag]: true }
		);

		const slotKey = Symbol.for('cinder.chat-room.server-owned.durable');
		const host = globalThis as Record<symbol, { module: number } | undefined>;
		const restamp = (): void => {
			// 0 is below any real generation, so the slot reads as built by an
			// OLDER evaluation — which is what a reload leaves behind.
			const slot = host[slotKey];
			if (slot !== undefined) slot.module = 0;
		};

		const first = await durableRuntime();

		let releaseShutdown: () => void = () => {};
		const shutdownGate = new Promise<void>((resolve) => {
			releaseShutdown = resolve;
		});
		first.engine.shutdown = async () => {
			await shutdownGate;
			throw fromAnEarlierEvaluation;
		};

		restamp();
		const reloadOne = durableRuntime();
		await new Promise((resolve) => setTimeout(resolve, 0));

		restamp();
		const reloadTwo = durableRuntime();

		const oneSettled = reloadOne.then(
			() => 'resolved' as const,
			(cause: unknown) => cause
		);
		const twoSettled = reloadTwo.then(
			() => 'resolved' as const,
			(cause: unknown) => cause
		);

		releaseShutdown();

		// Passed through UNWRAPPED, because it already carries the tag — there is
		// nothing to add by rewrapping an error that is already the right kind.
		expect(await oneSettled).toBe(fromAnEarlierEvaluation);

		// The one that discriminates. Under `instanceof`, the foreign error is
		// not recognised, the failure is swallowed, and this is `'resolved'` —
		// a second engine running beside one that never stopped.
		expect(await twoSettled).toBe(fromAnEarlierEvaluation);

		first.engine.shutdown = () => Promise.resolve(true);
	});

	it('does not let an OLDER evaluation retire the engine a newer one built', async () => {
		// The reverse of every other reload test here, and the direction they all
		// missed: an in-flight request still executing PRE-EDIT code reaches
		// `durableRuntime()` after the new evaluation has installed its slot.
		//
		// Under an identity check — "the slot's token is not mine" — that is
		// indistinguishable from finding a stale slot, so the old caller shut down
		// the engine the new evaluation had just built, rebuilt with its own
		// pre-edit workflow, and overwrote the slot. The edit silently rolled back
		// until some later request rolled it forward, shutting down a healthy
		// engine in each direction. Generations have to be COMPARED, not matched.
		const slotKey = Symbol.for('cinder.chat-room.server-owned.durable');
		const host = globalThis as Record<symbol, { module: number } | undefined>;

		const current = await durableRuntime();

		let shutdowns = 0;
		const realShutdown = current.engine.shutdown.bind(current.engine);
		current.engine.shutdown = () => {
			shutdowns += 1;
			return realShutdown();
		};

		// A very high ordinal stands in for "this slot was installed by an
		// evaluation NEWER than the caller about to run" — the caller here is this
		// module evaluation, whose generation is far below it.
		const slot = host[slotKey];
		expect(slot).toBeDefined();
		if (slot === undefined) return;
		slot.module = Number.MAX_SAFE_INTEGER;

		const served = await durableRuntime();

		// The SAME engine, handed back rather than replaced.
		expect(served).toBe(current);

		// And nothing was retired. Without the ordering check this is 1: a
		// healthy, current engine shut down by a request running old code.
		expect(shutdowns).toBe(0);

		slot.module = 0;
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
