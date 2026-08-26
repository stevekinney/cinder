<script lang="ts">
	import {
		appendAssistantMessage,
		appendUserMessage,
		Chat,
		clearMessageDeliveryStatus,
		createConversationHistory,
		markMessageDeliveryFailed,
		type ChatCapabilities,
		type ChatSubmitEvent,
		type ConversationHistory,
		type Message
	} from '@lostgradient/chat';

	// Seeds a transcript that exercises every capability at once: a user
	// message (editable), a completed assistant reply (copyable, and sharing
	// "deterministic" with the failed message below so search has two matches
	// to navigate between), and a FAILED assistant message (retryable —
	// `markMessageDeliveryFailed` stamps the delivery-status metadata
	// `ChatMessage` reads to show the retry affordance).
	function seedConversation(id: string): ConversationHistory {
		let conversation = createConversationHistory({ id });
		conversation = appendUserMessage(conversation, 'What is a deterministic chat exercise?');
		conversation = appendAssistantMessage(
			conversation,
			'A deterministic exercise never calls the network — every reply is scripted in-page.'
		);
		conversation = appendAssistantMessage(conversation, 'This reply failed to send.');
		const failedId = conversation.ids[conversation.ids.length - 1];
		if (!failedId) throw new Error('Expected a seeded message id.');
		return markMessageDeliveryFailed(conversation, failedId);
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

	let conversation = $state<ConversationHistory>(seedConversation('presentation-exercise'));

	// --- Presentation controls ------------------------------------------------

	let density = $state<'comfortable' | 'compact'>('comfortable');
	let variant = $state<'bubble' | 'flat'>('bubble');
	let surfaceMode = $state<'default' | 'transparent'>('default');

	// --- Capability flags -------------------------------------------------

	let attachmentsEnabled = $state(true);
	let searchEnabled = $state(true);
	let copyEnabled = $state(true);
	let editingEnabled = $state(true);
	let retryEnabled = $state(true);

	const capabilities = $derived<ChatCapabilities>({
		attachments: attachmentsEnabled,
		search: searchEnabled,
		copy: copyEnabled,
		editing: editingEnabled,
		retry: retryEnabled
	});

	function handleSubmit(event: ChatSubmitEvent): void {
		conversation = appendUserMessage(conversation, event.message.content);
		conversation = appendAssistantMessage(conversation, 'Deterministic echo reply.');
	}

	function handleRetry(messageId: string): void {
		const target = conversation.messages[messageId];
		if (!target) return;

		conversation = clearMessageDeliveryStatus(
			replaceMessage(conversation, messageId, { content: 'Retried reply: arrived on retry.' }),
			messageId
		);
	}

	function handleEdit(event: { messageId: string; content: string }): void {
		conversation = replaceMessage(conversation, event.messageId, { content: event.content });
	}
</script>

<div
	style="height: 100dvh; display: flex; flex-direction: column; gap: 1rem; padding: 1rem; box-sizing: border-box;"
>
	<section
		data-testid="presentation-controls"
		style="display: flex; flex-wrap: wrap; gap: 1.5rem; align-items: flex-start;"
	>
		<fieldset style="display: flex; flex-direction: column; gap: 0.25rem;">
			<legend>Density</legend>
			<label>
				<input type="radio" name="density" value="comfortable" bind:group={density} />
				Comfortable
			</label>
			<label>
				<input type="radio" name="density" value="compact" bind:group={density} />
				Compact
			</label>
		</fieldset>

		<fieldset style="display: flex; flex-direction: column; gap: 0.25rem;">
			<legend>Variant</legend>
			<label>
				<input type="radio" name="variant" value="bubble" bind:group={variant} />
				Bubble
			</label>
			<label>
				<input type="radio" name="variant" value="flat" bind:group={variant} />
				Flat
			</label>
		</fieldset>

		<fieldset style="display: flex; flex-direction: column; gap: 0.25rem;">
			<legend>Surface mode</legend>
			<label>
				<input type="radio" name="surface-mode" value="default" bind:group={surfaceMode} />
				Default
			</label>
			<label>
				<input type="radio" name="surface-mode" value="transparent" bind:group={surfaceMode} />
				Transparent
			</label>
		</fieldset>

		<fieldset
			data-testid="capabilities-editor"
			style="display: flex; flex-direction: column; gap: 0.25rem;"
		>
			<legend>Capabilities</legend>
			<label>
				<input
					type="checkbox"
					data-testid="capability-attachments"
					bind:checked={attachmentsEnabled}
				/>
				Attachments
			</label>
			<label>
				<input type="checkbox" data-testid="capability-search" bind:checked={searchEnabled} />
				Search
			</label>
			<label>
				<input type="checkbox" data-testid="capability-copy" bind:checked={copyEnabled} />
				Copy
			</label>
			<label>
				<input type="checkbox" data-testid="capability-editing" bind:checked={editingEnabled} />
				Editing
			</label>
			<label>
				<input type="checkbox" data-testid="capability-retry" bind:checked={retryEnabled} />
				Retry
			</label>
		</fieldset>
	</section>

	<div style="flex: 1; min-height: 0;">
		<Chat
			id="presentation-chat"
			{conversation}
			{density}
			{variant}
			{surfaceMode}
			{capabilities}
			onsubmit={handleSubmit}
			onretry={handleRetry}
			onedit={handleEdit}
		/>
	</div>
</div>
