<script lang="ts">
	import {
		Chat,
		createChatSessionController,
		decodeChatStreamEvents,
		type ConversationHistory
	} from '@lostgradient/chat';
	import { resolve } from '$app/paths';

	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Seeded from the server's copy, then kept in step as frames arrive. The
	// browser holds a MIRROR for rendering; the session store remains the
	// owner, and the endpoint writes the run's result back to it.
	let conversation = $state<ConversationHistory>(data.conversation);
	let streaming = $state(false);

	const session = createChatSessionController({
		getConversation: () => $state.snapshot(conversation),
		setConversation: (next) => (conversation = next),
		transport: async ({ signal }) => {
			// No transcript in the body. `/api/chat` sends one because the
			// browser owns it there; here the server reads it from the session,
			// which is what makes this variant noncanonical.
			const response = await fetch(`/api/server-owned/conversations/${data.id}/stream`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: '{}',
				signal
			});
			if (!response.ok || !response.body) throw new Error(await response.text());
			return decodeChatStreamEvents(response.body);
		},
		hooks: {
			onStreamingChange: (value) => (streaming = value)
		}
	});

	const adapter = session.adapter;
</script>

<main>
	<aside class="variant-banner" role="note" data-testid="server-owned-banner">
		<strong>Noncanonical variant.</strong> This conversation is owned by the
		<em>server</em>. Reloading re-reads it from the session store.
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
		<a href={resolve('/')}>The canonical exemplar</a> keeps its transcript in the browser.
	</aside>

	<h1 data-testid="server-owned-title">{data.title}</h1>

	<div data-testid="server-owned-chat" data-streaming={streaming}>
		<Chat id="server-owned-conversation" {conversation} {adapter} />
	</div>
</main>

<style>
	main {
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.variant-banner {
		border: 1px solid var(--cinder-color-warning-border, currentColor);
		border-radius: 0.5rem;
		padding: 0.75rem 1rem;
		background: var(--cinder-color-warning-bg, transparent);
	}
</style>
