import { error } from '@sveltejs/kit';

import { loadConversation, titleOf } from '$lib/server-owned-conversations';
import { isShutdown } from '$lib/server-owned-unavailable';

import type { PageServerLoad } from './$types';

/**
 * The transcript comes from the SERVER, not from anything the browser kept.
 * That is the whole distinction this variant exists to show: a reload renders
 * history because the session store has it.
 */
export const load: PageServerLoad = async ({ params }) => {
	// Guarded for the same reason as the list loader: `loadConversation`
	// reaches the runtime, so a navigation during shutdown would render a
	// generic 500 rather than the 503 every other surface reports.
	let session;
	try {
		session = await loadConversation(params.id);
	} catch (cause) {
		if (isShutdown(cause)) error(503, 'The server is shutting down. Try again in a moment.');
		throw cause;
	}

	if (session === undefined) {
		error(404, 'No such conversation.');
	}

	return {
		id: session.id,
		title: titleOf(session.metadata),
		conversation: session.conversationHistory
	};
};
