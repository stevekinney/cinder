import { json } from '@sveltejs/kit';
import { z } from 'zod';

import { createConversation, listConversations } from '$lib/server-owned-conversations';

import type { RequestHandler } from './$types';

/**
 * Titles are bounded at the boundary that owns the contract, not left for the
 * store to reject later: an unbounded title would be persisted, listed, and
 * rendered before anything complained, and the failure would surface as a
 * layout problem rather than a validation one.
 */
const createSchema = z.object({
	title: z.string().trim().min(1).max(120)
});

export const GET: RequestHandler = async () => {
	return json({ conversations: await listConversations() });
};

export const POST: RequestHandler = async ({ request }) => {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Request body must be JSON.' }, { status: 400 });
	}

	const parsed = createSchema.safeParse(body);
	if (!parsed.success) {
		// The reason, not the exception: `parsed.error` carries the submitted
		// value, and this response is rendered in a browser.
		return json({ error: 'A title between 1 and 120 characters is required.' }, { status: 400 });
	}

	return json({ conversation: await createConversation(parsed.data.title) }, { status: 201 });
};
