<script lang="ts">
	import {
		appendAssistantMessage,
		appendUserMessage,
		Chat,
		createConversationHistory,
		deriveAttachmentKind,
		MessageAttachments,
		serializeChatAttachments,
		type AttachmentKind,
		type ChatAttachment,
		type ChatSubmitEvent,
		type ConversationHistory,
		type ImageContent,
		type MultiModalContent,
		type SerializedChatAttachment,
		type TextContent
	} from '@lostgradient/chat';

	type AttachmentEvent = { seq: number } & (
		| {
				type: 'add';
				id: string;
				name: string;
				kind: AttachmentKind;
				status: ChatAttachment['status'];
		  }
		| { type: 'remove'; id: string; name: string; kind: AttachmentKind }
		| { type: 'failure'; name: string; kind: AttachmentKind; reason: string }
	);

	let conversation = $state<ConversationHistory>(
		createConversationHistory({ id: 'attachments-exercise' })
	);
	let events = $state<AttachmentEvent[]>([]);
	let eventSeq = 0;
	// Exercise 3: the exact `SerializedChatAttachment[]` produced by the most
	// recent `serializeChatAttachments` call, rendered as JSON so the e2e test
	// can assert its shape structurally rather than just "something exists".
	let lastSerializedAttachments = $state<SerializedChatAttachment[]>([]);

	// Every image part across the transcript, gathered for the standalone
	// `MessageAttachments` gallery below. Chat already renders images inline in
	// each message on its own; this exercises `MessageAttachments` directly,
	// driven by real `ImageContent` parts produced from submitted attachments.
	const allImages = $derived(
		Object.values(conversation.messages).flatMap((message): MultiModalContent[] =>
			Array.isArray(message.content)
				? message.content.filter((part): part is ImageContent => part.type === 'image')
				: []
		)
	);

	function handleAttachmentAdd(attachment: ChatAttachment): void {
		eventSeq += 1;
		events = [
			...events,
			{
				seq: eventSeq,
				type: 'add',
				id: attachment.id,
				name: attachment.file.name,
				kind: attachment.kind,
				status: attachment.status
			}
		];
	}

	function handleAttachmentRemove(attachment: ChatAttachment): void {
		eventSeq += 1;
		events = [
			...events,
			{
				seq: eventSeq,
				type: 'remove',
				id: attachment.id,
				name: attachment.file.name,
				kind: attachment.kind
			}
		];
	}

	// `onattachmentfailure` only receives the raw `File`, not a `ChatAttachment`
	// (validation failed before one was built) — `deriveAttachmentKind` is what
	// recovers the kind the attachment would have had.
	function handleAttachmentFailure(file: File, reason: string): void {
		eventSeq += 1;
		events = [
			...events,
			{
				seq: eventSeq,
				type: 'failure',
				name: file.name,
				kind: deriveAttachmentKind(file.type),
				reason
			}
		];
	}

	// Deterministic stand-in for a backend: serializes attachments (exercising
	// `serializeChatAttachments`), folds any images into the user message's
	// multimodal content as `ImageContent` parts, and echoes a summary back as
	// the assistant reply. No network call.
	async function handleSubmit(event: ChatSubmitEvent): Promise<void> {
		const { message, attachments } = event;

		if (attachments.length === 0) {
			conversation = appendUserMessage(conversation, message.content);
		} else {
			const textValue = typeof message.content === 'string' ? message.content : '';
			const serialized = await serializeChatAttachments(attachments);
			lastSerializedAttachments = serialized;
			const textPart: TextContent = { type: 'text', text: textValue };
			const imageParts: ImageContent[] = serialized
				.filter((attachment) => attachment.kind === 'image')
				.map((attachment) => ({
					type: 'image',
					url: `data:${attachment.mimeType};base64,${attachment.content}`,
					mimeType: attachment.mimeType,
					text: attachment.name
				}));
			const content: MultiModalContent[] = [textPart, ...imageParts];
			conversation = appendUserMessage(conversation, content);
		}

		const summary =
			attachments.length === 0
				? 'No attachments received.'
				: `Received ${attachments.length} attachment(s): ${attachments
						.map((attachment) => `${attachment.file.name} (${attachment.kind})`)
						.join(', ')}.`;
		conversation = appendAssistantMessage(conversation, summary);
	}
</script>

<div style="height: 100dvh; display: flex;">
	<div style="flex: 1; min-height: 0; display: flex; flex-direction: column;">
		<Chat
			id="chatroom-attachments-chat"
			{conversation}
			onsubmit={handleSubmit}
			onattachmentadd={handleAttachmentAdd}
			onattachmentremove={handleAttachmentRemove}
			onattachmentfailure={handleAttachmentFailure}
		/>
	</div>
	<aside
		style="width: 22rem; flex-shrink: 0; border-left: 1px solid var(--cinder-border); overflow-y: auto; padding: 1rem;"
	>
		<h2>Attachment events</h2>
		<ul data-testid="attachment-events">
			{#each events as event (event.seq)}
				<li data-event-type={event.type}>
					{#if event.type === 'add'}
						added: {event.name} ({event.kind}, {event.status})
					{:else if event.type === 'remove'}
						removed: {event.name} ({event.kind})
					{:else}
						failed: {event.name} ({event.kind}) &mdash; {event.reason}
					{/if}
				</li>
			{/each}
		</ul>

		<h2>Image gallery (MessageAttachments)</h2>
		<div data-testid="attachment-gallery">
			<MessageAttachments images={allImages} />
		</div>

		<h2>serializeChatAttachments output</h2>
		<pre data-testid="attachment-serialized-json" style="white-space: pre-wrap;">{JSON.stringify(
				lastSerializedAttachments
			)}</pre>
	</aside>
</div>
