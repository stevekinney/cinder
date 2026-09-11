import { env } from '$env/dynamic/private';
import { json } from '@sveltejs/kit';
import { createSessionHandle } from '@lostgradient/operative';
import { createAnthropicProviderStream } from '@lostgradient/operative/anthropic';
import { z } from 'zod';

import { chatRunResponse } from '$lib/chat-run-response';
import { AGENT_NAME, loadConversation } from '$lib/server-owned-conversations';
import { durableRuntime } from '$lib/server-owned-durable';
import { serverOwnedRuntime } from '$lib/server-owned-runtime';
import { emptyToolbox, requestContext } from '$lib/toolbox';
import { createChatRunOptions } from '$lib/chat-agent';

import type { RequestHandler } from './$types';

const turnSchema = z.object({ text: z.string().trim().min(1).max(4000) });

const MODEL = 'claude-sonnet-5';
const MAX_TOKENS = 4096;

/**
 * Streams a turn for a SERVER-owned conversation.
 *
 * Through `createSessionHandle`, which is the seam that ties this variant's
 * three pieces together: it reads and writes the conversation through the
 * `SessionStore`, and takes the durable `engine` and `checkpointStore` so a
 * run is checkpointed as it goes. Hand-rolling load → append → run → save
 * around the store works, and was the first version of this file, but it
 * leaves the durable engine built and unused — and `handle.recover()` is
 * what <issue>CIN-445</issue> will need.
 *
 * The wire is not re-specified. `createChatRunOptions` is the same
 * definition `/api/chat`'s agent is built from, so both route families emit
 * one NDJSON vocabulary from one piece of plumbing rather than from two that
 * agree today.
 *
 * The browser sends ONE message, never a transcript: the history is the
 * store's, and only the turn just typed has to cross.
 */
export const POST: RequestHandler = async ({ params, request }) => {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Request body must be JSON.' }, { status: 400 });
	}

	const parsed = turnSchema.safeParse(body);
	if (!parsed.success) {
		return json({ error: 'A message between 1 and 4000 characters is required.' }, { status: 400 });
	}

	// Checked before the run rather than left to the handle: a missing
	// conversation is a 404, and discovering it inside a streaming response
	// would mean reporting it as a mid-stream failure instead.
	if ((await loadConversation(params.id)) === undefined) {
		return json({ error: 'No such conversation.' }, { status: 404 });
	}

	if (!env.ANTHROPIC_API_KEY) {
		return json({ error: 'ANTHROPIC_API_KEY is not configured' }, { status: 503 });
	}

	const { sessions } = serverOwnedRuntime();
	const durable = await durableRuntime();

	return chatRunResponse({
		signal: request.signal,
		start: (writer) =>
			createSessionHandle(params.id, {
				store: sessions,
				engine: durable.engine as never,
				checkpointStore: durable.checkpointStore as never,
				agentName: AGENT_NAME,
				runOptions: createChatRunOptions({
					generate: createAnthropicProviderStream({
						model: MODEL,
						maximumTokens: MAX_TOKENS,
						apiKey: env.ANTHROPIC_API_KEY,
						// As in `/api/chat`: Operative's provider does not read
						// `ANTHROPIC_BASE_URL` itself, so omitting this forward would
						// send every Playwright spec at the real, billed API.
						baseURL: env.ANTHROPIC_BASE_URL
					}),
					// EMPTY, deliberately, and this is a scope boundary rather
					// than an omission.
					//
					// `$lib/toolbox` contains `remember_note`, which is
					// approval-gated: a run that selects it parks with an
					// `action_required` result, and the session controller then
					// calls the transport again to continue. This route family
					// has no approval UI, so such a run would park with no way
					// to resolve it — and the continuation call would re-send
					// the same user turn as a NEW one, duplicating it.
					//
					// Operative-native approval is CIN-445's subject. Wiring
					// half of it here would ship a reachable dead end; wiring
					// none of it keeps the variant honest about what it
					// currently demonstrates, which is server-owned
					// persistence and streaming.
					toolbox: emptyToolbox,
					requestContext,
					writer
				})
			}).run(parsed.data.text)
	});
};
