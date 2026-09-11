import { json } from '@sveltejs/kit';
import { z } from 'zod';

import { appendUserTurn, messageCountOf } from '$lib/server-owned-conversations';

import type { RequestHandler } from './$types';

const turnSchema = z.object({
	text: z.string().trim().min(1).max(4000)
});

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

	const session = await appendUserTurn(params.id, parsed.data.text);
	// `undefined` means the conversation is gone, which is a 404 — distinct
	// from a conversation that exists and happens to be empty. The service
	// keeps those apart precisely so this endpoint can.
	if (session === undefined) {
		return json({ error: 'No such conversation.' }, { status: 404 });
	}

	return json({ id: session.id, messageCount: messageCountOf(session) }, { status: 201 });
};
