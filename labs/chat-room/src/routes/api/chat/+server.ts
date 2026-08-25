import { ANTHROPIC_API_KEY } from '$env/static/private';
import { json } from '@sveltejs/kit';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { toAnthropicMessagesForSdk } from 'conversationalist/adapters/anthropic';
import { conversationSchema } from 'conversationalist/schemas';
import { parseAnthropicToolCalls, toAnthropicTools } from 'armorer/adapters/anthropic';

import { toolbox } from '$lib/toolbox';

import type { ContentBlock } from '@anthropic-ai/sdk/resources/messages';
import type { RequestHandler } from './$types';

const MODEL = 'claude-sonnet-5';
const MAX_TOKENS = 4096;

const requestSchema = z.object({ conversation: conversationSchema });

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

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

	// Mark the newest message as a prompt-cache boundary before conversion:
	// conversationalist lowers it to a `cache_control` breakpoint on that
	// message's last content block, so each turn caches the whole prompt
	// prefix and the next turn's request reads it back instead of
	// re-processing the entire transcript.
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

	const { system, messages } = toAnthropicMessagesForSdk(withCacheBoundary);

	const anthropicStream = anthropic.messages.stream({
		model: MODEL,
		max_tokens: MAX_TOKENS,
		...(system ? { system } : {}),
		messages,
		tools: toAnthropicTools(toolbox)
	});

	const encoder = new TextEncoder();

	// `end` can fire after `error` (or after the consumer cancels the stream),
	// and a ReadableStreamDefaultController throws if closed/errored twice —
	// an uncaught throw here happens inside an event-emitter callback, outside
	// SvelteKit's request handling, and crashes the whole process. `settled`
	// makes every controller interaction below a one-shot.
	let settled = false;

	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			const blocks: ContentBlock[] = [];

			function enqueueEvent(event: unknown) {
				if (settled) return;
				controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
			}

			anthropicStream.on('text', (text) => enqueueEvent({ type: 'text', text }));
			anthropicStream.on('contentBlock', (block) => {
				blocks.push(block);
				// Surface each tool call the moment its block completes rather
				// than after the whole message ends — the client renders the
				// tool-call row while later blocks are still streaming.
				for (const toolCall of parseAnthropicToolCalls([block])) {
					enqueueEvent({ type: 'tool_call', ...toolCall });
				}
			});
			anthropicStream.on('end', () => {
				void (async () => {
					try {
						const toolCalls = parseAnthropicToolCalls(blocks);

						if (toolCalls.length > 0) {
							const results = await toolbox.execute(toolCalls);

							for (const result of results) {
								enqueueEvent({
									type: 'tool_result',
									callId: result.callId,
									outcome: result.outcome,
									content: result.content,
									...(result.error ? { error: result.error } : {}),
									...(result.action ? { action: result.action } : {}),
									...(result.pendingApproval ? { pendingApproval: result.pendingApproval } : {})
								});
							}
						}
					} catch (cause) {
						if (!settled) {
							settled = true;
							controller.error(cause);
						}
						return;
					}

					if (!settled) {
						settled = true;
						controller.close();
					}
				})();
			});
			anthropicStream.on('error', (error) => {
				if (settled) return;
				settled = true;
				controller.error(error);
			});
			// A user pressing "stop generating" CRASHED THE SERVER without this, and
			// the mechanism is deliberate on the SDK's side rather than incidental.
			// `MessageStream._emit` does this when it emits `abort`:
			//
			//   if (!catchingPromiseCreated && !listeners?.length) Promise.reject(error);
			//
			// — an intentional unhandled rejection to make a silently-dropped stream
			// loud. We register `on('error')` but registered no `abort` listener, and
			// `catchingPromiseCreated` is only set by awaiting `done()`/`finalMessage()`,
			// which this route never does because it forwards events as they arrive.
			// So the client aborting reached `cancel()` → `anthropicStream.abort()` →
			// `_emit('abort')` → `Promise.reject` with nothing attached, and Node took
			// the process down mid-request.
			//
			// Registering the listener is the whole fix: its presence satisfies
			// `!listeners?.length` and the SDK stops synthesising the rejection.
			//
			// The body is a no-op on purpose. An abort here is not a failure — it is
			// the documented outcome of `cancel()`, which already set `settled`, and
			// the partial text the client kept is the behaviour `+page.svelte` intends.
			// Calling `controller.error` would turn a normal stop into an error the
			// user never caused. This is the same one-shot hazard the `settled`
			// comment above describes, in its second form: there, a double controller
			// call; here, an event with no listener.
			anthropicStream.on('abort', () => {
				settled = true;
			});
		},
		cancel() {
			settled = true;
			anthropicStream.abort();
		}
	});

	return new Response(stream, {
		headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8' }
	});
};
