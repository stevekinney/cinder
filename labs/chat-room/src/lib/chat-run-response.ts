import { createChatStreamWriter, pumpChatRun } from '../routes/api/chat/chat-agent';

import type { ChatStreamWriter } from '../routes/api/chat/chat-agent';
import type { AgentRun } from '@lostgradient/operative';

/**
 * One NDJSON streaming response for one agent run, shared by every route
 * family that streams.
 *
 * Extracted rather than copied. What lives here is not glue: it is the
 * accumulated handling for a set of races that are individually easy to get
 * wrong and collectively invisible until production — a client that
 * disconnects before `start` runs, one that disconnects inside the window
 * where the provider request is opened but no abort listener is attached yet,
 * a terminal envelope arriving after cancellation, and a controller that
 * throws when closed twice. Every branch below records why it exists, several
 * of them because the alternative shipped first and failed.
 *
 * A second copy of this would drift from the first at the first fix that
 * landed in only one of them.
 */
export function chatRunResponse(options: {
	/** The request's abort signal. */
	signal: AbortSignal;
	/** Builds and starts the run, writing its frames to `writer`. */
	start: (writer: ChatStreamWriter) => AgentRun;
}): Response {
	const encoder = new TextEncoder();

	// A run's terminal envelope can arrive after the stream has already been
	// settled by cancellation (or, symmetrically, cancellation can race a
	// just-resolved envelope) — and a `ReadableStreamDefaultController` throws
	// if closed/errored twice. `settled` makes every controller interaction
	// below a one-shot, the same guarantee the pre-Operative loop needed for
	// the same reason.
	let settled = false;
	let run: AgentRun | undefined;

	// A user pressing "stop generating" must not crash the server. The
	// pre-Operative loop needed a dedicated Anthropic-SDK `'abort'` listener
	// because that SDK synthesizes an unhandled `Promise` rejection when a
	// stream is aborted with no attached listener — an intentional
	// "don't drop this silently" mechanism that took the whole process down
	// here, since nothing awaited it. Operative's abort path is different:
	// empirically (verified against the installed `0.7.0` package directly —
	// its own doc comment claims `result()` rejects on abort, which does not
	// match), `run.abort()` makes a pending `run.result()` RESOLVE with
	// `finishReason: 'aborted'` and a real `AgentRunError` on `.error`. The
	// equivalent hazard here is therefore an unawaited *rejection* only if
	// something else goes wrong — `pumpChatRun` routes its entire body
	// through one try/catch and always resolves rather than rejecting, and
	// the `finally` below always disposes the run — that pair is what keeps
	// any such failure from ever becoming an unhandled rejection.
	// Assigned once `start(controller)` runs, so `onRequestAbort` can reach the
	// controller it would otherwise have no reference to. It stays `undefined`
	// only in the window before `start`, and a signal that aborted in that
	// window is handled by the already-aborted guard inside `start` instead.
	let closeStream: (() => void) | undefined;

	function onRequestAbort(): void {
		if (settled) return;
		settled = true;
		run?.abort('request aborted');
		// Closing here is load-bearing, not belt-and-braces. Setting `settled`
		// is precisely what stops the async pump's terminal branch from running
		// (`if (settled) return;` sits ahead of its `controller.close()`), so
		// without this the stream would never reach a terminal state at all on a
		// request-signal abort — it would sit open for the rest of the process's
		// life. `cancel()` deliberately does NOT do this: there the consumer has
		// already torn the readable down, and closing a cancelled controller
		// throws.
		closeStream?.();
	}

	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			// A client that disconnects between the initial `fetch` and this point
			// leaves `options.signal` already aborted — `addEventListener('abort', …)`
			// below would never fire for a signal that fired before it was attached.
			// Without this check the run would still start (and still bill the
			// provider) for a response nothing will ever read.
			if (options.signal.aborted) {
				settled = true;
				controller.close();
				return;
			}

			closeStream = () => {
				// A terminal transition can still race: the consumer may cancel
				// between `settled = true` and this call. `close()` on an already
				// terminal controller throws, and this runs inside an event-listener
				// callback where a throw is unhandled, so it is swallowed — the
				// stream is ending either way.
				try {
					controller.close();
				} catch {
					// Already terminal; nothing to do.
				}
			};

			// Request-local, never module-scoped: the writer owns this response's
			// `sequence` counter, and `createChatAgent` builds a request-local
			// event target around it — a shared one would deliver one request's
			// frames to every other in-flight request.
			const writer = createChatStreamWriter((line) => {
				if (settled) return;
				// Same race `closeStream` guards: the consumer can cancel between the
				// `settled` check and this call, and `enqueue()` on an already
				// terminal controller throws. The throw would propagate out of the
				// pump and turn a normal cancellation into an error nobody caused,
				// so a late write is dropped — the stream is ending either way.
				try {
					controller.enqueue(encoder.encode(line));
				} catch {
					// Already terminal; the frame has nowhere to go.
				}
			});

			// Everything route-specific — provider, toolbox, conversation — is the
			// caller's. This helper owns only the stream's lifecycle, which is the
			// part that must not be written twice.
			const activeRun = options.start(writer);
			run = activeRun;
			options.signal.addEventListener('abort', onRequestAbort);

			// Close the gap between the already-aborted guard at the top of `start`
			// and the listener above. Everything in between — building the provider,
			// creating the agent, and `startChatRun` itself — takes real time, and
			// `startChatRun` is the call that opens a BILLED provider request. A
			// client that disconnects inside that window fires `abort` with nothing
			// listening yet, so without this re-check the event is simply lost: the
			// run keeps going and being billed, and the stream never reaches a
			// terminal state. `onRequestAbort` is a one-shot, so calling it directly
			// here is safe even if the listener also fires.
			//
			// It deliberately does NOT return. Returning would skip the pump below,
			// and with it the `finally` that removes this listener and disposes the
			// run — trading a lost abort for a leaked run and an unremoved
			// listener. Falling through instead costs nothing: the run is already
			// aborted, so `pumpChatRun` resolves immediately with an abort
			// envelope, `settled` short-circuits every controller interaction, and
			// the cleanup path runs exactly as it does for every other outcome.
			// It also keeps `run.result()` awaited, so a future Operative version
			// that rejects on abort — as its documentation describes — cannot
			// produce an unhandled rejection here.
			if (options.signal.aborted) onRequestAbort();

			void (async () => {
				try {
					// The envelope is no longer read here: `pumpChatRun` has already
					// written the terminal frame that carries it, and every
					// outcome now closes the stream the same way.
					await pumpChatRun(activeRun, writer);

					if (settled) return;
					settled = true;

					// Every settled run closes the stream cleanly, including a failed
					// one. `pumpChatRun` has already written the terminal frame —
					// `run.completed`, `run.aborted`, `run.tripwire`, or `run.error`
					// with its `{ kind, code, message, retryable? }` — and that frame
					// is the outcome. The body is complete; there is nothing left to
					// say by tearing the connection down.
					//
					// This used to call `controller.error(...)` after writing the
					// failure frame, because `session-controller.ts` had no reducer
					// for `run.*` and a rejecting reader was the only way a client
					// ever heard about a failure. That cure was worse than the
					// disease: erroring a `ReadableStream` serving as a `Response`
					// body destroys the connection, so the browser saw
					// `net::ERR_EMPTY_RESPONSE` and the carefully typed frame went
					// out with it — every provider failure arriving as "Failed to
					// fetch" with no kind, no code, and no retryability. The reducer
					// now reads those frames (CIN-438), which is what makes closing
					// cleanly the correct thing rather than a silent drop.
					controller.close();
				} catch (cause) {
					if (!settled) {
						settled = true;
						controller.error(cause);
					}
				} finally {
					options.signal.removeEventListener('abort', onRequestAbort);
					// Best-effort: disposal is cleanup, not the outcome. Letting it throw
					// here would replace whatever `envelope`/`cause` this `finally` is
					// unwinding from with a disposal error, masking the real failure.
					try {
						activeRun[Symbol.dispose]();
					} catch {
						// Nothing left to do with a disposal failure but swallow it — the
						// run is ending either way, and there is no controller-safe way to
						// surface a second error after the terminal transition above.
					}
				}
			})();
		},
		cancel() {
			settled = true;
			run?.abort('client cancelled');
		}
	});

	return new Response(stream, {
		headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8' }
	});
}
