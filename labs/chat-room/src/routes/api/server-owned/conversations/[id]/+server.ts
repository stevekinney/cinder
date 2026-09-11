import { json } from '@sveltejs/kit';
import { getMessages } from '@lostgradient/chat';

import { loadConversation, messageCountOf, titleOf } from '$lib/server-owned-conversations';

import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	const session = await loadConversation(params.id);
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
};
