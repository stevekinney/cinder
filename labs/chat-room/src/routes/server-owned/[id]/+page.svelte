<script lang="ts">
	import {
		Chat,
		createChatSessionController,
		decodeChatStreamEvents,
		getMessages,
		type ConversationHistory
	} from '@lostgradient/chat';
	import { resolve } from '$app/paths';
	import { onDestroy, untrack } from 'svelte';

	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Seeded from the server's copy ONCE, then kept in step as frames arrive.
	// The browser holds a MIRROR for rendering; the session store remains the
	// owner, and the endpoint writes the run's result back to it.
	//
	// `untrack` because the one-time read is the intent, not an oversight:
	// referencing a prop inside `$state` warns precisely because it usually
	// means someone expected reactivity. Here re-seeding from `data` would
	// discard everything streamed since the load.
	let conversation = $state<ConversationHistory>(untrack(() => data.conversation));
	let streaming = $state(false);

	const session = createChatSessionController({
		getConversation: () => $state.snapshot(conversation),
		setConversation: (next) => (conversation = next),
		transport: async ({ conversation: history, signal }) => {
			// ONE message, never a transcript. `/api/chat` sends the whole
			// history because the browser owns it there; here the server holds
			// it, and only the turn the user just typed has to cross — the
			// server cannot know it any other way.
			// The LAST message must be the user turn being sent. The session
			// controller also calls this transport to CONTINUE a run after a
			// tool result, and on that call the last message is a tool result,
			// not a user turn — sending the previous user text again would
			// duplicate it as a new turn.
			//
			// This route runs with an empty toolbox (see the stream endpoint's
			// note: approval belongs to CIN-445), so no continuation can occur
			// today. The guard is here so that stops being true loudly rather
			// than silently, if a toolbox is ever added without the approval
			// wiring that has to come with it.
			const messages = getMessages(history);
			const last = messages.at(-1);
			if (last?.role !== 'user' || typeof last.content !== 'string') {
				throw new Error(
					'The server-owned transport was called to continue a run. That path needs approval wiring (CIN-445) before a toolbox is enabled here.'
				);
			}
			const text = last.content;

			const response = await fetch(`/api/server-owned/conversations/${data.id}/stream`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ text }),
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

	// Leaving this page while a response is streaming destroys `<Chat>` but not
	// the controller behind it: without this the run keeps going, its frames
	// keep arriving for a component that is gone, and the provider request
	// stays open and billed. `dispose()` stops the active run and releases the
	// controller's own subscriptions.
	onDestroy(() => {
		session.dispose();
	});
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
