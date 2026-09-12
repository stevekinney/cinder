import { json } from '@sveltejs/kit';

import { SHUTDOWN_FAILURE } from './server-owned-runtime.ts';

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
 * The error is NOT forwarded, and it is not logged either — an omission rather
 * than an oversight, which is worth stating because the two look identical in a
 * diff.
 *
 * Both errors this maps are constructed HERE, by this module, with fixed
 * messages and no cause: `RuntimeTerminatingError` means the latch is closed
 * and `RuntimeDisposedDuringBuildError` means disposal won a race. Neither
 * carries information a log line could add, and both occur once per request
 * during a shutdown that is already being reported by the signal handler — so
 * logging them would produce a burst of identical lines saying what the
 * shutdown message already said.
 *
 * The failures that DO carry a diagnostic — a rejected teardown, a disposal
 * that threw — are reported by the signal handler at the point they happen,
 * which is where the storage or engine error actually is.
 */
export function unavailableDuringShutdown(cause: unknown): Response | undefined {
	// BOTH shutdown rejections, not just the latch. A request that was already
	// awaiting `createRunEngine` when disposal began is rejected with
	// `RuntimeDisposedDuringBuildError` instead — a different error for a
	// different moment, but the same answer to the client: the server is going
	// away, try again. Recognising only the latch turned that race into the
	// generic 500 this helper exists to prevent.
	if (!isShutdown(cause)) return undefined;

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

/**
 * True for either rejection that means "the runtime is going away".
 *
 * Exported because SvelteKit PAGE loaders cannot use the `Response` above —
 * they signal status through `error()` so the framework renders an error page
 * rather than returning JSON to a navigation. Sharing the predicate rather than
 * the response keeps the two surfaces from drifting on WHICH errors count,
 * which is the part that would silently diverge.
 */
export function isShutdown(cause: unknown): boolean {
	// The TAG, not `instanceof`. A module re-evaluation creates new class
	// objects, and this predicate is reached with errors from a different
	// evaluation as a matter of course: an older evaluation is deliberately
	// handed a newer one's in-flight promise, so a rejection from that build
	// arrives here carrying the newer evaluation's constructor. `instanceof`
	// answers "no" and the route rethrows a shutdown as a generic 500.
	//
	// The retirement path was made process-stable for exactly this reason, and
	// this helper was written afterwards with `instanceof` anyway — the lesson
	// is at the symbol now, so the next error type gets it for free.
	return typeof cause === 'object' && cause !== null && SHUTDOWN_FAILURE in cause;
}
