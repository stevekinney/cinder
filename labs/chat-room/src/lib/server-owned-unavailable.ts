import { json } from '@sveltejs/kit';

import { RuntimeTerminatingError } from './server-owned-runtime.ts';

/**
 * Turns a shutdown into a 503 rather than an opaque 500.
 *
 * Every server-owned endpoint reaches `serverOwnedRuntime()` somewhere beneath
 * it, and that refuses with `RuntimeTerminatingError` once a terminating
 * disposal latches. Left alone it escapes the handler and SvelteKit renders a
 * generic 500 — which tells a client the server is broken when in fact it is
 * shutting down cleanly and the right response is "try again shortly".
 *
 * A shared helper rather than a `try`/`catch` in each route: the four handlers
 * would otherwise each decide a status and a sentence, and the first one
 * someone forgot would be indistinguishable from a real crash. It also keeps
 * the wording in one place, so it is a sentence rather than a stack trace.
 *
 * The error is NOT forwarded. The client gets a fixed sentence; the cause stays
 * server-side, where the signal handler already reports it.
 */
export function unavailableDuringShutdown(cause: unknown): Response | undefined {
	if (!(cause instanceof RuntimeTerminatingError)) return undefined;

	return json(
		{ error: 'The server is shutting down. Try again in a moment.' },
		{
			status: 503,
			// Conventional for a planned, brief unavailability, and it gives a
			// client something better than an immediate blind retry.
			headers: { 'retry-after': '5' }
		}
	);
}

/**
 * Rethrows, as an expression.
 *
 * `unavailableDuringShutdown(cause) ?? raise(cause)` reads as one decision —
 * "a shutdown becomes a 503, anything else is not ours to swallow" — where a
 * statement-form rethrow would need a second `if` and invite someone to return
 * a generic 500 body instead. Nothing else is caught here: a genuine failure
 * still reaches SvelteKit, which is where it belongs.
 */
export function raise(cause: unknown): never {
	throw cause;
}
