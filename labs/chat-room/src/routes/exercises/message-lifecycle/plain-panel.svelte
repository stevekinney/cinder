<script lang="ts">
	import {
		appendMessages,
		Chat,
		clearMessageDeliveryStatus,
		type ChatStopGeneratingEvent,
		type ChatSubmitEvent,
		type ConversationHistory
	} from '@lostgradient/chat';
	import { replaceMessage, seedConversation, streamReply } from './message-lifecycle-shared';

	// Instance B: plain onsubmit / onretry / onedit / onstopgenerating — no
	// `adapter` prop at all — proves Chat works purely off callback props.

	let conversationB = $state<ConversationHistory>(seedConversation('message-lifecycle-plain'));
	let streamingB = $state(false);
	let errorB = $state<string | null>(null);
	let logB = $state<string[]>([]);
	let stopRequestedB = false;

	function snapshotB(): ConversationHistory {
		return $state.snapshot(conversationB);
	}

	function logEntry(entry: string): void {
		logB = [...logB, entry];
	}

	function handleSubmitB(event: ChatSubmitEvent): void {
		errorB = null;
		logEntry('onsubmit');
		conversationB = appendMessages(conversationB, event.message);
		stopRequestedB = false;
		void streamReply({
			getSnapshot: snapshotB,
			setConversation: (next) => (conversationB = next),
			setStreaming: (value) => (streamingB = value),
			shouldStop: () => stopRequestedB,
			log: logEntry
		});
	}

	function handleRetryB(messageId: string): void {
		logEntry(`onretry:${messageId}`);
		const target = conversationB.messages[messageId];
		if (!target) return;

		conversationB = clearMessageDeliveryStatus(
			replaceMessage(conversationB, messageId, {
				content: 'Retried via plain callback: the deterministic fact arrived on retry.'
			}),
			messageId
		);
	}

	function handleEditB(event: { messageId: string; content: string }): void {
		logEntry(`onedit:${event.messageId}:${event.content}`);
		conversationB = replaceMessage(conversationB, event.messageId, { content: event.content });
	}

	function handleStopGeneratingB(event: ChatStopGeneratingEvent): void {
		logEntry(`onstopgenerating:${event.messageId}`);
		stopRequestedB = true;
	}
</script>

<section style="flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 0.5rem;">
	<h2 style="margin: 0;">Callback-only (no adapter)</h2>
	<!-- Always rendered, never `{#if}`-gated. A live region has to exist in the
	     DOM before the content arrives: mounting one that already has text is not
	     reliably announced, which is the pattern Chat's own
	     `chat-status-announcer.svelte` documents and follows. Padding is applied
	     only when populated so an empty region takes no layout. -->
	<p role="alert" data-testid="plain-error" style="margin: 0; color: var(--cinder-danger);">
		{errorB ?? ''}
	</p>
	<div style="flex: 1; min-height: 0; display: flex; gap: 0.5rem;">
		<div style="flex: 2; min-height: 0; display: flex; flex-direction: column;">
			<Chat
				id="message-lifecycle-plain-chat"
				conversation={conversationB}
				streaming={streamingB}
				onsubmit={handleSubmitB}
				onretry={handleRetryB}
				onedit={handleEditB}
				onstopgenerating={handleStopGeneratingB}
			/>
		</div>
		<ul
			data-testid="plain-log"
			style="flex: 1; min-width: 0; overflow-y: auto; margin: 0; padding: 0.5rem; font-size: 0.75rem; list-style: none;"
		>
			{#each logB as entry, index (index)}
				<li>{entry}</li>
			{/each}
		</ul>
	</div>
</section>
