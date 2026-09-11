/**
 * A stand-in for a deployed server, for `server-owned-runtime.test.ts`.
 *
 * Importing `server-owned-runtime.ts` registers the SIGTERM/SIGINT handlers.
 * The interval below stands in for the thing a real deployment has and a test
 * process does not: a handle keeping the event loop alive. Without it the
 * process would exit on its own once the module finished evaluating, and the
 * test could not tell a handler that terminates from one that merely returns.
 *
 * Run as a child process, never imported by a route.
 */
import { serverOwnedRuntime } from './server-owned-runtime.ts';

// Built so the signal handler has a runtime to dispose rather than an empty
// slot — the path a deployment actually takes.
serverOwnedRuntime();

const keepAlive = setInterval(() => {}, 1000);

// The parent waits for this before signalling, so the handlers are registered
// by the time the signal arrives.
console.log('ready');

// Referenced so nothing can conclude the interval is unused and remove it.
void keepAlive;
