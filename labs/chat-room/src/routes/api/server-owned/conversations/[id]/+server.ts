import { json } from '@sveltejs/kit';
import { getMessages } from '@lostgradient/chat';

import { loadConversation, messageCountOf, titleOf } from '$lib/server-owned-conversations';
import { raise, unavailableDuringShutdown } from '$lib/server-owned-unavailable';

import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
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
		id: session.id,
		title: titleOf(session.metadata),
		messageCount: messageCountOf(session),
		messages: getMessages(session.conversationHistory).map((message) => ({
			id: message.id,
			role: message.role,
			content: message.content
		}))
	});
}
