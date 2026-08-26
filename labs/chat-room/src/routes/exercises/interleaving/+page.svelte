<script lang="ts">
	import {
		appendAssistantMessage,
		appendMessages,
		appendStreamingMessage,
		appendUserMessage,
		cancelStreamingMessage,
		Chat,
		clearMessageDeliveryStatus,
		createConversationHistory,
		finalizeStreamingMessage,
		markMessageDeliveryFailed,
		updateStreamingMessage,
		type ChatAdapter,
		type ChatAdapterErrorEvent,
		type ConversationHistory,
		type Message
	} from '@lostgradient/chat';
	import { SvelteSet } from 'svelte/reactivity';

	// Drives streaming, editing, retrying, and stopping through the SAME
	// adapter and observes what Chat actually guards against versus what a
	// consumer has to guard for itself — the seams called out in the exercise
	// brief: shared internal state (the `conversation` snapshot) mutated from
	// overlapping async operations.

	const SEND_TOKENS = ['Sure, ', 'here ', 'is ', 'a ', 'deterministic ', 'reply.'];
	const RETRY_TOKENS = ['Retried ', 'reply: ', 'the ', 'quarterly ', 'numbers ', 'are ', 'in.'];
	const TOKEN_DELAY_MS = 150;

	function sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	function seedConversation(id: string): {
		conversation: ConversationHistory;
		retryTargetId: string;
	} {
		let conversation = createConversationHistory({ id });
		conversation = appendUserMessage(conversation, "What's the weather like today?");
		conversation = appendAssistantMessage(conversation, "It's sunny and 72 degrees.");
		conversation = appendUserMessage(conversation, 'Summarize the quarterly report.');
		conversation = appendAssistantMessage(conversation, 'This reply failed to send.');
		const retryTargetId = conversation.ids[conversation.ids.length - 1];
		if (!retryTargetId) throw new Error('Expected a seeded message id.');
		return { conversation: markMessageDeliveryFailed(conversation, retryTargetId), retryTargetId };
	}

	function replaceMessage(
		history: ConversationHistory,
		messageId: string,
		updates: Partial<Pick<Message, 'content' | 'metadata'>>
	): ConversationHistory {
		const existing = history.messages[messageId];
		if (!existing) return history;

		return {
			...history,
			messages: { ...history.messages, [messageId]: { ...existing, ...updates } },
			updatedAt: new Date().toISOString()
		};
	}

	const seed = seedConversation('interleaving-demo');
	let conversation = $state<ConversationHistory>(seed.conversation);
	const retryTargetId = seed.retryTargetId;

	// Plain `let`: only read via `chat?.retryMessage()` calls, never reactively.
	let chat: ReturnType<typeof Chat> | undefined;

	let log = $state<string[]>([]);
	let error = $state<string | null>(null);

	// Every stream (a send, or a retry) increments this on start and
	// decrements it on completion/cancellation, so `streaming` stays `true`
	// as long as ANY stream is active — including two overlapping retries of
	// the same message.
	let activeStreamCount = $state(0);
	const streaming = $derived(activeStreamCount > 0);

	// Ids for which `stopGenerating` has been requested. Checked by the
	// token-reveal loops between tokens.
	const stopRequestedIds = new SvelteSet<string>();

	function requestStop(messageId: string): void {
		stopRequestedIds.add(messageId);
	}

	function clearStopRequest(messageId: string): void {
		stopRequestedIds.delete(messageId);
	}

	function snapshot(): ConversationHistory {
		return $state.snapshot(conversation);
	}

	const adapter: ChatAdapter = {
		sendMessage: async (message) => {
			error = null;
			log = [...log, 'sendMessage'];
			conversation = appendMessages(conversation, message);

			const { conversation: withPlaceholder, messageId } = appendStreamingMessage(
				snapshot(),
				'assistant'
			);
			conversation = withPlaceholder;
			activeStreamCount += 1;

			try {
				let buffer = '';
				for (const token of SEND_TOKENS) {
					if (stopRequestedIds.has(messageId)) break;
					await sleep(TOKEN_DELAY_MS);
					if (stopRequestedIds.has(messageId)) break;

					buffer += token;
					conversation = updateStreamingMessage(snapshot(), messageId, buffer);
				}
				conversation = buffer
					? finalizeStreamingMessage(snapshot(), messageId)
					: cancelStreamingMessage(snapshot(), messageId);
			} finally {
				clearStopRequest(messageId);
				activeStreamCount -= 1;
			}
		},

		// Not blocked by an in-flight stream — Chat's `canEdit` derivation never
		// checks `streaming`, so this runs concurrently with any active
		// send/retry loop above. Both write into `conversation` through the
		// same read-current-snapshot-then-write pattern, so a write from one
		// never clobbers a write from the other: each reads the LATEST
		// snapshot at the moment it runs, not a stale closure.
		editMessage: async (event) => {
			log = [...log, `editMessage:${event.messageId}`];
			conversation = replaceMessage(conversation, event.messageId, { content: event.content });
		},

		// Chat's dispatcher single-flights `retryMessage` per message id: a
		// second dispatch for an id whose retry is still in flight — whether a
		// UI double-click or a programmatic `chat.retryMessage(id)` call (this
		// exercise's "Force retry again" button) — is swallowed before it
		// reaches this adapter command.
		retryMessage: async (messageId) => {
			log = [...log, `retryMessage:${messageId}`];
			const target = conversation.messages[messageId];
			if (!target) return;

			clearStopRequest(messageId);
			conversation = clearMessageDeliveryStatus(conversation, messageId);
			activeStreamCount += 1;

			try {
				let buffer = '';
				for (const token of RETRY_TOKENS) {
					if (stopRequestedIds.has(messageId)) break;
					await sleep(TOKEN_DELAY_MS);
					if (stopRequestedIds.has(messageId)) break;

					buffer += token;
					conversation = replaceMessage(conversation, messageId, { content: buffer });
				}
				if (stopRequestedIds.has(messageId) && buffer !== RETRY_TOKENS.join('')) {
					conversation = markMessageDeliveryFailed(conversation, messageId);
				}
			} finally {
				clearStopRequest(messageId);
				activeStreamCount -= 1;
			}
		},

		stopGenerating: async (messageId) => {
			log = [...log, `stopGenerating:${messageId}`];
			requestStop(messageId);
		}
	};

	function handleAdapterError(event: ChatAdapterErrorEvent): void {
		error = event.error instanceof Error ? event.error.message : 'Something went wrong.';
	}

	function forceRetryAgain(): void {
		// Routed through the component instance (not `adapter.retryMessage`
		// directly) so it hits Chat's dispatcher — the seam that single-flights
		// concurrent retries of the same message id.
		chat?.retryMessage(retryTargetId);
	}
</script>

<div
	style="height: 100dvh; display: flex; flex-direction: column; gap: 0.75rem; padding: 1rem; box-sizing: border-box;"
>
	<!-- Always rendered, never `{#if}`-gated. A live region has to exist in the
	     DOM before the content arrives: mounting one that already has text is not
	     reliably announced, which is the pattern Chat's own
	     `chat-status-announcer.svelte` documents and follows. -->
	<p role="alert" data-testid="interleaving-error" style="margin: 0; color: var(--cinder-danger);">
		{error ?? ''}
	</p>
	<div style="flex: 1; min-height: 0; display: flex; gap: 0.75rem;">
		<div style="flex: 2; min-height: 0; display: flex; flex-direction: column;">
			<Chat
				bind:this={chat}
				id="interleaving-chat"
				{conversation}
				{adapter}
				{streaming}
				onadaptererror={handleAdapterError}
			/>
		</div>
		<div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.5rem;">
			<button type="button" data-testid="force-retry-again" onclick={forceRetryAgain}>
				Force retry again (bypasses the UI's Retry button)
			</button>
			<ul
				data-testid="interleaving-log"
				style="flex: 1; overflow-y: auto; margin: 0; padding: 0.5rem; font-size: 0.75rem; list-style: none;"
			>
				{#each log as entry, index (index)}
					<li>{entry}</li>
				{/each}
			</ul>
		</div>
	</div>
</div>
