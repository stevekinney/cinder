import { json } from '@sveltejs/kit';
import { getMessages } from '@lostgradient/chat';

import {
	loadConversation,
	messageCountOf,
	serverOwnedSnapshot
} from '$lib/server-owned-conversations';
import { raise, unavailableDuringShutdown } from '$lib/server-owned-unavailable';

import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, setHeaders }) => {
	setHeaders({ 'cache-control': 'no-store' });
	try {
		return await respond(params.id);
	} catch (cause) {
		return unavailableDuringShutdown(cause) ?? raise(cause);
	}
};

async function respond(id: string): Promise<Response> {
	const session = await loadConversation(id);
	if (session === undefined) {
		return json({ error: 'No such conversation.' }, { status: 404 });
	}

	return json({
		...serverOwnedSnapshot(session),
		messageCount: messageCountOf(session),
		messages: getMessages(session.conversationHistory).map((message) => ({
			id: message.id,
			role: message.role,
			content: message.content
		}))
	});
}
