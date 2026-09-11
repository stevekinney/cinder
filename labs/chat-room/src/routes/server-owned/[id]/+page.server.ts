import { error } from '@sveltejs/kit';

import { loadConversation } from '$lib/server-owned-conversations';

import type { PageServerLoad } from './$types';

/**
 * The transcript comes from the SERVER, not from anything the browser kept.
 * That is the whole distinction this variant exists to show: a reload renders
 * history because the session store has it.
 */
export const load: PageServerLoad = async ({ params }) => {
	const session = await loadConversation(params.id);
	if (session === undefined) {
		error(404, 'No such conversation.');
	}

	return {
		id: session.id,
		title: typeof session.metadata?.title === 'string' ? session.metadata.title : 'Untitled',
		conversation: session.conversationHistory
	};
};
