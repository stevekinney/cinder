<script lang="ts">
	import {
		ChatNavigationRail,
		ChatSubSession,
		appendAssistantMessage,
		appendUserMessage,
		createConversation,
		getMessages,
		getMessageText
	} from '@lostgradient/chat';

	const child = appendAssistantMessage(
		appendUserMessage(createConversation({ id: 'child-session' }), 'Inspect the failing test'),
		'Running the focused reproduction now…'
	);
	const conversation = appendAssistantMessage(
		appendUserMessage(createConversation({ id: 'navigation-exercise' }), 'Show me the nested run'),
		'Here is the child session and the user-message navigation rail.'
	);
	const messages = getMessages(conversation);
	let selected = $state(-1);
	let viewport = $state<HTMLElement | null>(null);

	function navigate(index: number): void {
		selected = index;
		viewport
			?.querySelector<HTMLElement>(`#message-${messages[index]?.id}`)
			?.scrollIntoView({ behavior: 'smooth', block: 'center' });
	}
</script>

<div class="exercise-shell">
	<h1>Nested transcript and navigation</h1>
	<p>Use the rail buttons or press and drag across them. Hover a row for its markdown preview.</p>
	<div class="exercise-transcript">
		<ChatNavigationRail {messages} {viewport} onNavigate={navigate} />
		<div bind:this={viewport} class="exercise-chat-viewport" aria-label="Exercise transcript">
			{#each messages as message (message.id)}
				<article id={`message-${message.id}`} data-message-id={message.id}>
					<strong>{message.role}</strong>
					<p>{getMessageText(message)}</p>
					{#if message.role === 'assistant'}
						<ChatSubSession conversation={child} live />
					{/if}
				</article>
			{/each}
		</div>
	</div>
	<p aria-live="polite">Selected message: {selected < 0 ? 'none' : selected + 1}</p>
</div>

<style>
	.exercise-shell {
		max-inline-size: 48rem;
		margin: 0 auto;
		padding: 2rem;
	}
	.exercise-transcript {
		display: flex;
		gap: 1rem;
		block-size: 30rem;
	}
	.exercise-chat-viewport {
		flex: 1;
		overflow: auto;
		display: grid;
		gap: 1rem;
		align-content: start;
	}
	.exercise-chat-viewport article {
		padding: 1rem;
		border: 1px solid var(--cinder-border-muted);
		border-radius: var(--cinder-radius-md);
	}
</style>
