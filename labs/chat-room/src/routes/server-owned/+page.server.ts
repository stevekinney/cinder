import { listConversations } from '$lib/server-owned-conversations';

import type { PageServerLoad } from './$types';

/**
 * Loaded on the SERVER, which is the whole point of the variant: the browser
 * receives a rendered list rather than a store to drive. The canonical
 * exemplar at `/` does the opposite, and keeping that contrast legible is
 * what this route family exists for.
 */
export const load: PageServerLoad = async () => {
	return { conversations: await listConversations() };
};
