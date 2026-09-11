import { env } from '$env/dynamic/private';
import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { conversationSchema } from 'conversationalist/schemas';
import { createAnthropicProviderStream } from '@lostgradient/operative/anthropic';

import { requestContext, toolbox } from '$lib/toolbox';
import { chatRunResponse } from '$lib/chat-run-response';
import { createChatAgent, startChatRun } from './chat-agent';

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

	return chatRunResponse({
		signal: request.signal,
		start: (writer) =>
			startChatRun(
				createChatAgent({
					generate: createAnthropicProviderStream({
						model: MODEL,
						maximumTokens: MAX_TOKENS,
						apiKey: env.ANTHROPIC_API_KEY,
						// The raw Anthropic SDK reads `ANTHROPIC_BASE_URL` from the
						// environment itself at construction time; Operative's provider
						// does not. `playwright.config.ts` points this at
						// `streaming-fixture.ts`, so omitting this forward would send
						// every Playwright spec's request to the real, billed Anthropic
						// API instead of the fixture.
						baseURL: env.ANTHROPIC_BASE_URL
					}),
					toolbox,
					requestContext,
					writer
				}),
				withCacheBoundary
			)
	});
};
