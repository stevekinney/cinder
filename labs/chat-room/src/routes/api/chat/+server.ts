import { env } from '$env/dynamic/private';
import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { conversationSchema } from 'conversationalist/schemas';
import { createAnthropicProviderStream } from '@lostgradient/operative/anthropic';

import { requestContext, toolbox } from '$lib/toolbox';
import { createChatAgent, pumpChatRun, startChatRun, type ChatStreamFrame } from './chat-agent';

import type { AgentRun, EnhancedStreamingOptions } from '@lostgradient/operative';
import type { RequestHandler } from './$types';

const MODEL = 'claude-sonnet-5';
const MAX_TOKENS = 4096;

const requestSchema = z.object({ conversation: conversationSchema });

export const POST: RequestHandler = async ({ request }) => {
	let body: unknown;

	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON' }, { status: 400 });
	}

	const parsed = requestSchema.safeParse(body);

	if (!parsed.success) {
		return json({ error: 'Invalid request body' }, { status: 400 });
	}

	if (!env.ANTHROPIC_API_KEY) {
		return json({ error: 'ANTHROPIC_API_KEY is not configured' }, { status: 503 });
	}

	// Mark the newest message as a prompt-cache boundary before the run:
	// conversationalist lowers it to a `cache_control` breakpoint on that
	// message's last content block inside `toAnthropicMessages` — the same
	// adapter Operative's Anthropic provider calls internally when no
	// `assembler`/`contextBudget` is configured (confirmed by reading
	// `providers/anthropic.js`: with neither option set it hands
	// `conversation.current` straight to `toAnthropicMessages`, unchanged).
	// So each turn still caches the whole prompt prefix and the next turn's
	// request reads it back instead of re-processing the entire transcript.
	const conversation = parsed.data.conversation;
	const lastId = conversation.ids.at(-1);
	const lastMessage = lastId === undefined ? undefined : conversation.messages[lastId];
	const withCacheBoundary =
		lastId === undefined || lastMessage === undefined
			? conversation
			: {
					...conversation,
					messages: {
						...conversation.messages,
						[lastId]: { ...lastMessage, cacheBoundary: true }
					}
				};

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
			// leaves `request.signal` already aborted — `addEventListener('abort', …)`
			// below would never fire for a signal that fired before it was attached.
			// Without this check the run would still start (and still bill the
			// provider) for a response nothing will ever read.
			if (request.signal.aborted) {
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

			function enqueueFrame(frame: ChatStreamFrame): void {
				if (settled) return;
				controller.enqueue(encoder.encode(`${JSON.stringify(frame)}\n`));
			}

			// Request-local, never module-scoped: `withEnhancedStreaming` dispatches
			// on this target through plain `EventTarget.dispatchEvent`, and
			// `EventTarget` dispatch is broadcast — a module-scoped target would
			// deliver one request's text deltas to every other in-flight request.
			const eventTarget = new EventTarget() as unknown as NonNullable<
				EnhancedStreamingOptions['eventTarget']
			>;
			eventTarget.addEventListener('stream:text-delta', (event) => {
				enqueueFrame({ type: 'text', text: event.detail.content });
			});

			const agent = createChatAgent({
				generate: createAnthropicProviderStream({
					model: MODEL,
					maximumTokens: MAX_TOKENS,
					apiKey: env.ANTHROPIC_API_KEY,
					// The raw Anthropic SDK reads `ANTHROPIC_BASE_URL` from the
					// environment itself at construction time; Operative's provider does
					// not. `playwright.config.ts` points this at `streaming-fixture.ts`,
					// so omitting this forward would send every Playwright spec's
					// request to the real, billed Anthropic API instead of the fixture.
					baseURL: env.ANTHROPIC_BASE_URL
				}),
				toolbox,
				requestContext,
				eventTarget
			});

			// `activeRun` (not the outer, reassignable `run`) is what the async pump
			// below closes over: it is a `const`, so TypeScript keeps it narrowed to
			// `AgentRun` for the whole closure instead of widening back to
			// `AgentRun | undefined` the way a captured `let` would. `run` still gets
			// the same value, for `cancel()`/`onRequestAbort` to reach.
			const activeRun = startChatRun(agent, withCacheBoundary);
			run = activeRun;
			request.signal.addEventListener('abort', onRequestAbort);

			void (async () => {
				try {
					const envelope = await pumpChatRun(activeRun, enqueueFrame);

					if (settled) return;
					settled = true;

					// A user-initiated stop (`kind: 'abort'`) is not a failure — the
					// documented outcome of `cancel()`/`onRequestAbort`, which already
					// settled the stream. Calling `controller.error` here would turn a
					// normal stop into an error the user never caused, so both success
					// and a clean abort close the stream the same way; every other
					// failure becomes a stream error the client's adapter can surface.
					if (envelope.ok || envelope.error.kind === 'abort') {
						controller.close();
						return;
					}

					controller.error(new Error(envelope.error.message));
				} catch (cause) {
					if (!settled) {
						settled = true;
						controller.error(cause);
					}
				} finally {
					request.signal.removeEventListener('abort', onRequestAbort);
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
};
