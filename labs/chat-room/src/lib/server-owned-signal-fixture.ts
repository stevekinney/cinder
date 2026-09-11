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
	runtime.onDispose(() => {
		writeFileSync(marker, 'disposed');
	});
}

const keepAlive = setInterval(() => {}, 1000);

// The parent waits for this before signalling, so the handlers are registered
// by the time the signal arrives.
console.log('ready');

// Referenced so nothing can conclude the interval is unused and remove it.
void keepAlive;
