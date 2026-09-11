/**
 * A stand-in for a deployed server, for `server-owned-runtime.test.ts`.
 *
 * Importing `server-owned-runtime.ts` registers the SIGTERM/SIGINT handlers.
 * The interval below stands in for the thing a real deployment has and a test
 * process does not: a handle keeping the event loop alive. Without it the
 * process would exit on its own once the module finished evaluating, and the
 * test could not tell a handler that terminates from one that merely returns.
 *
 * `HOST_LISTENER=1` installs a PERSISTENT listener for the same signals. That
 * is the condition re-raising the signal could not survive: the second delivery
 * reaches the host's listener, which suppresses Node's default exactly as this
 * module's own listener did, and the process stays alive one level further
 * down. Without this switch the test would only confirm the assumption that
 * nothing else is listening, rather than the property that the process
 * terminates either way.
 *
 * `BLOCK_TEARDOWN=1` holds that teardown open on stdin until the parent writes
 * — which, in the test that uses it, the parent never does.
 *
 * `TEARDOWN_MARKER=<path>` registers a teardown that writes that file. It is
 * what makes "disposes AND terminates" two claims rather than one: without it,
 * replacing the handler's cleanup with a bare `process.exit(143)` would leave
 * the tests green while checkpoint flushing was silently cut off again.
 *
 * A FILE rather than a line on stdout, because the marker has to survive the
 * exit that follows it immediately. Writes to a pipe can still be in flight
 * when `process.exit` runs; `writeFileSync` has completed by the time it
 * returns.
 *
 * The teardown AWAITS before writing, and that is not decoration. Written
 * synchronously, the marker would appear before `disposeServerOwnedRuntime()`
 * reached its first `await` — so a regression to
 * `void disposeServerOwnedRuntime(); process.exit(...)` would still produce
 * it, and the test would prove only that disposal STARTED. Crossing an await
 * first means the marker exists only if the handler actually waited for the
 * disposal to finish, which is what the engine's asynchronous shutdown and
 * checkpoint flushing depend on.
 *
 * `RELOAD_MARKER=<path>` stands in for Vite re-evaluating the module: it
 * replaces the process-global disposer reference the way a second evaluation
 * does, after the handlers are already registered. If the handlers dispatch
 * through that reference the replacement runs and writes the file; if they
 * closed over the first evaluation's function, nothing does.
 *
 * Run as a child process, never imported by a route.
 */
import { writeFileSync } from 'node:fs';

import { serverOwnedRuntime } from './server-owned-runtime.ts';

if (process.env['HOST_LISTENER'] === '1') {
	for (const signal of ['SIGTERM', 'SIGINT'] as const) {
		// `on`, not `once`, and deliberately empty: a host that keeps its own
		// handler registered across deliveries is the realistic shape, and
		// suppressing the default is what any such handler does.
		//
		// Registered after the import rather than before it — ESM evaluates
		// imported modules first regardless, and the order does not matter:
		// what the property depends on is that BOTH listeners exist when the
		// signal arrives, not which was added first.
		process.on(signal, () => {});
	}
}

// Built so the signal handler has a runtime to dispose rather than an empty
// slot — the path a deployment actually takes.
const runtime = serverOwnedRuntime();

const marker = process.env['TEARDOWN_MARKER'];
if (marker !== undefined && marker !== '') {
	// `BLOCK_TEARDOWN=1` holds the teardown open until the PARENT says
	// otherwise — it waits on stdin, and the parent simply never writes.
	//
	// A barrier rather than a delay. The first version of this used
	// `SLOW_TEARDOWN=2000` to widen the window a second signal could land in,
	// which is a wait threshold added to make a race reproducible — exactly the
	// padding this repository forbids, and a rule I had been applying to other
	// people's code in the same review. A barrier is also STRICTER: the
	// assertion becomes "it exited while the teardown was still blocked", which
	// no amount of waiting could satisfy by accident.
	const blockTeardown = process.env['BLOCK_TEARDOWN'] === '1';

	runtime.onDispose(async () => {
		// Announced at the START of the teardown, so a test wanting to deliver a
		// second signal DURING disposal can wait for this rather than guess at a
		// delay.
		console.log('disposing');

		if (blockTeardown) {
			// Never resolves in the test that sets this: the parent holds the
			// barrier closed and asserts the process dies anyway.
			await new Promise<void>((resolve) => {
				process.stdin.once('data', () => resolve());
				process.stdin.resume();
			});
		} else {
			// A macrotask, not a microtask: `process.exit` runs after the current
			// microtask checkpoint, so a bare `await Promise.resolve()` could
			// still resolve before an unawaited disposal was cut off. A timer
			// cannot.
			await new Promise((resolve) => setTimeout(resolve, 0));
		}

		writeFileSync(marker, 'disposed');
	});
}

const reloadMarker = process.env['RELOAD_MARKER'];
if (reloadMarker !== undefined && reloadMarker !== '') {
	// What a second module evaluation does: `globalThis` survives the reload,
	// so the slot is still populated and simply gets overwritten with the new
	// evaluation's implementation. The handlers registered by the FIRST
	// evaluation are the ones installed on `process` — `SIGNALS_SLOT` stops the
	// second evaluation from adding its own.
	const slot = Symbol.for('cinder.chat-room.server-owned.disposer');
	const host = globalThis as Record<symbol, unknown>;
	const previous = host[slot] as (options?: { drain?: boolean }) => Promise<{ failures: number }>;

	host[slot] = async (options?: { drain?: boolean }) => {
		// Synchronous, and BEFORE delegating: this marker is about which
		// function the handler reached, not about disposal completing, and the
		// process exits as soon as the delegate settles.
		writeFileSync(reloadMarker, 'reloaded');
		return previous(options);
	};
}

const keepAlive = setInterval(() => {}, 1000);

// The parent waits for this before signalling, so the handlers are registered
// by the time the signal arrives.
console.log('ready');

// Referenced so nothing can conclude the interval is unused and remove it.
void keepAlive;
