import { error } from '@sveltejs/kit';

import { listConversations } from '$lib/server-owned-conversations';
import { isShutdown } from '$lib/server-owned-unavailable';

import type { PageServerLoad } from './$types';

/**
 * Loaded on the SERVER, which is the whole point of the variant: the browser
 * receives a rendered list rather than a store to drive. The canonical
 * exemplar at `/` does the opposite, and keeping that contrast legible is
 * what this route family exists for.
 */
export const load: PageServerLoad = async () => {
	// GUARDED like the JSON endpoints. `listConversations` reaches
	// `serverOwnedRuntime()`, which refuses once termination latches, and a
	// navigation arriving then would otherwise render SvelteKit's generic 500
	// error page — the landing page claiming the server is broken while it is
	// shutting down cleanly. `error(503)` renders the same shutdown state the
	// API returns, so the two surfaces agree.
	try {
		return { conversations: await listConversations() };
	} catch (cause) {
		if (isShutdown(cause)) error(503, 'The server is shutting down. Try again in a moment.');
		throw cause;
	}
};
