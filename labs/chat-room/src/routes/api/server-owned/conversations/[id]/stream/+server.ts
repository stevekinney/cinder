import { env } from '$env/dynamic/private';
import { json } from '@sveltejs/kit';
import { createAnthropicProviderStream } from '@lostgradient/operative/anthropic';

import { chatRunResponse } from '$lib/chat-run-response';
import { loadConversation, persistRunResult } from '$lib/server-owned-conversations';
import { requestContext, toolbox } from '$lib/toolbox';
import { createChatAgent, startChatRun } from '../../../../chat/chat-agent';

import type { RequestHandler } from './$types';

const MODEL = 'claude-sonnet-5';
const MAX_TOKENS = 4096;

/**
 * Streams a turn for a SERVER-owned conversation.
 *
 * The wire is not re-specified here. `chatRunResponse` and `pumpChatRun` are
 * the same ones `/api/chat` uses, so both route families emit one NDJSON
 * vocabulary by construction rather than by two implementations agreeing —
 * which is what "the lab's wire contract" has to mean if it is to survive a
 * change to either side.
 *
 * What differs, and what makes this the server-owned variant: the browser
 * sends no transcript. The history comes from the session store, and the
 * run's result goes back to it when the run settles. A reload renders the
 * assistant's reply because the server kept it, not because the client
 * replayed it.
 */
export const POST: RequestHandler = async ({ params, request }) => {
	const session = await loadConversation(params.id);
	if (session === undefined) {
		return json({ error: 'No such conversation.' }, { status: 404 });
	}

	if (!env.ANTHROPIC_API_KEY) {
		return json({ error: 'ANTHROPIC_API_KEY is not configured' }, { status: 503 });
	}

	return chatRunResponse({
		signal: request.signal,
		start: (writer) => {
			const run = startChatRun(
				createChatAgent({
					generate: createAnthropicProviderStream({
						model: MODEL,
						maximumTokens: MAX_TOKENS,
						apiKey: env.ANTHROPIC_API_KEY,
						// As in `/api/chat`: Operative's provider does not read
						// `ANTHROPIC_BASE_URL` itself, so omitting this forward would
						// send every Playwright spec at the real, billed API instead
						// of the fixture.
						baseURL: env.ANTHROPIC_BASE_URL
					}),
					toolbox,
					requestContext,
					writer
				}),
				session.conversationHistory
			);

			// Persistence hangs off the SAME settled result the pump awaits —
			// `result()` caches, so this is a second reader of one outcome, not a
			// second run. Attaching it here rather than awaiting it in the handler
			// keeps the response streaming: the client sees frames as they are
			// produced, and the store is updated once the run is done.
			//
			// Failures are swallowed deliberately. The run's own outcome has
			// already reached the client as a terminal frame; throwing out of this
			// callback would surface as an unhandled rejection that no request is
			// waiting on, and would say nothing the client has not already been
			// told.
			void run
				.result()
				.then(async (result) => {
					await persistRunResult(params.id, result.conversation.current);
				})
				.catch(() => {
					// Nothing to do: the client already has the terminal frame.
				});

			return run;
		}
	});
};
