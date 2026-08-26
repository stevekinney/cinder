<script lang="ts">
	import {
		appendMessages,
		appendStreamingMessage,
		Chat,
		createConversationHistory,
		finalizeStreamingMessage,
		updateStreamingMessage,
		type ChatSubmitEvent,
		type ConversationHistory,
		type JSONValue,
		type Message,
		type StepInfo
	} from '@lostgradient/chat';

	/**
	 * A per-message override, keyed by message id, used to exercise the
	 * `messageReasoning`/`messageSteps`/`messageSuggestions` callback path.
	 * Messages NOT present here fall through to Chat's own
	 * `message.metadata['cinder:*']` fallback.
	 */
	type MessageOverride = {
		reasoning?: string;
		steps?: StepInfo[];
		suggestions?: string[];
	};

	type ScriptedTurn = {
		reply: string;
		/** Turn 0: demonstrates the `metadata['cinder:*']` fallback path. */
		metadata?: Record<string, JSONValue>;
		/** Turn 1: demonstrates the `messageReasoning`/`messageSteps`/`messageSuggestions` callback override path. */
		override?: MessageOverride;
	};

	const script: ScriptedTurn[] = [
		{
			reply:
				'Quantum entanglement is a phenomenon where two particles become correlated so that measuring one instantly tells you about the other, no matter the distance between them.',
			metadata: {
				'cinder:reasoning':
					'Recall the EPR paradox and Bell inequality, then simplify without the full quantum-mechanical formalism.',
				'cinder:steps': [
					{
						title: 'Recall physics',
						content: 'EPR paradox and Bell inequality basics.',
						status: 'done'
					},
					{ title: 'Simplify', content: 'Draft a plain-language explanation.', status: 'done' }
				] satisfies StepInfo[],
				'cinder:suggestions': ['Explain superposition', "What is Bell's theorem?"]
			}
		},
		{
			reply:
				'Superposition is the idea that a quantum system can exist in multiple states at once until it is measured, at which point it collapses to one outcome.',
			override: {
				reasoning:
					'Override reasoning: contrast superposition with entanglement using a coin-flip analogy.',
				steps: [
					{
						title: 'Contrast concepts',
						content: 'Compare entanglement with superposition.',
						status: 'done'
					}
				],
				suggestions: ['Explain wave-particle duality']
			}
		}
	];

	const fallbackReply = "Noted — is there anything else you'd like to explore?";
	const starterPrompts = ['Explain quantum entanglement', 'What is superposition?'];

	function delay(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	function countUserMessages(history: ConversationHistory): number {
		return Object.values(history.messages).filter((message) => message.role === 'user').length;
	}

	let chat: ReturnType<typeof Chat> | undefined;
	let conversation = $state<ConversationHistory>(
		createConversationHistory({ id: 'assistant-metadata-demo' })
	);
	let streaming = $state(false);
	let overrides = $state<Record<string, MessageOverride>>({});
	// The id of the assistant message that received `turn.metadata` (script
	// turn 0). Exposed via `metadata-mode-*` controls below so the e2e suite
	// can drive fallback/suppression/override precedence for that ONE message
	// without introducing a second scripted turn.
	let metadataDemoMessageId = $state<string | undefined>();
	// Plain `let`: read only inside `handleSuggestionSelect`, never reactively.
	// `Chat` does not clear a message's suggestion chips when one is selected —
	// the documented pattern (since chat 0.2.0) is consumer suppression via
	// `messageSuggestions` returning `[]` for that message, which requires
	// knowing which message the chips belonged to.
	let lastAssistantMessageId: string | undefined;

	function snapshot(): ConversationHistory {
		return $state.snapshot(conversation);
	}

	async function submit(content: string): Promise<void> {
		const text = content.trim();
		if (!text) return;

		const turnIndex = countUserMessages(conversation);
		conversation = appendMessages(conversation, { role: 'user', content: text });

		streaming = true;
		// Streaming is `true` but no placeholder message exists yet, so Chat
		// shows the "Thinking…" typing indicator (via `streamingStatus`)
		// instead of an empty message row.
		await delay(700);

		const { conversation: withPlaceholder, messageId } = appendStreamingMessage(
			snapshot(),
			'assistant'
		);
		conversation = withPlaceholder;
		chat?.beginStreaming(messageId);

		const turn = script[turnIndex];
		const replyText = turn?.reply ?? fallbackReply;
		if (turn?.override) {
			overrides = { ...overrides, [messageId]: turn.override };
		}
		if (turn?.metadata) {
			metadataDemoMessageId = messageId;
		}

		let buffer = '';
		const words = replyText.split(' ');
		for (const [index, word] of words.entries()) {
			const chunk = index === 0 ? word : ` ${word}`;
			buffer += chunk;
			conversation = updateStreamingMessage(snapshot(), messageId, buffer);
			chat?.pushToken(chunk);
			await delay(25);
		}

		conversation = finalizeStreamingMessage(
			snapshot(),
			messageId,
			turn?.metadata ? { metadata: turn.metadata } : undefined
		);
		chat?.endStreaming();
		streaming = false;
		lastAssistantMessageId = messageId;
	}

	function handleSubmit(event: ChatSubmitEvent): void {
		void submit(typeof event.message.content === 'string' ? event.message.content : '');
	}

	function handleSuggestionSelect(label: string): void {
		// Suppress the suggestion chips on the message the chip came from —
		// otherwise they persist under that message row indefinitely (Chat
		// itself does not clear them; see the comment on `lastAssistantMessageId`).
		if (lastAssistantMessageId) {
			overrides = {
				...overrides,
				[lastAssistantMessageId]: { ...overrides[lastAssistantMessageId], suggestions: [] }
			};
		}
		void submit(label);
	}

	// Drives the reasoning/steps/suggestions callback state for
	// `metadataDemoMessageId` through the three states the resolve* utilities
	// (@lostgradient/chat) document: no override (metadata fallback), an
	// empty override (the suppression sentinel — authoritative, does not fall
	// through to metadata), and a non-empty override (wins outright).
	function setMetadataFallback(): void {
		if (!metadataDemoMessageId) return;
		const next = { ...overrides };
		delete next[metadataDemoMessageId];
		overrides = next;
	}

	function setMetadataSuppressed(): void {
		if (!metadataDemoMessageId) return;
		overrides = {
			...overrides,
			[metadataDemoMessageId]: { reasoning: '', steps: [], suggestions: [] }
		};
	}

	function setMetadataOverridden(): void {
		if (!metadataDemoMessageId) return;
		overrides = {
			...overrides,
			[metadataDemoMessageId]: {
				reasoning: 'Callback override reasoning wins over cinder:reasoning metadata.',
				steps: [
					{
						title: 'Callback step',
						content: 'Supplied by messageSteps, not metadata.',
						status: 'done'
					}
				],
				suggestions: ['Callback override suggestion']
			}
		};
	}

	function messageReasoning(message: Message): string | undefined {
		return overrides[message.id]?.reasoning;
	}

	function messageSteps(message: Message): StepInfo[] | undefined {
		return overrides[message.id]?.steps;
	}

	function messageSuggestions(message: Message): string[] | undefined {
		return overrides[message.id]?.suggestions;
	}
</script>

<div style="height: 100dvh; display: flex; flex-direction: column;">
	<div style="display: flex; gap: 0.5rem; padding: 0.5rem 1rem; flex-shrink: 0;">
		<button
			type="button"
			data-testid="metadata-mode-fallback"
			disabled={!metadataDemoMessageId}
			onclick={setMetadataFallback}
		>
			Metadata fallback
		</button>
		<button
			type="button"
			data-testid="metadata-mode-suppress"
			disabled={!metadataDemoMessageId}
			onclick={setMetadataSuppressed}
		>
			Suppress overlays
		</button>
		<button
			type="button"
			data-testid="metadata-mode-override"
			disabled={!metadataDemoMessageId}
			onclick={setMetadataOverridden}
		>
			Override overlays
		</button>
	</div>
	<div style="flex: 1; min-height: 0;">
		<Chat
			bind:this={chat}
			id="assistant-metadata-exercise-chat"
			{conversation}
			{streaming}
			streamingStatus="Thinking…"
			emptyPrompts={starterPrompts}
			onsubmit={handleSubmit}
			{messageReasoning}
			{messageSteps}
			{messageSuggestions}
			onSuggestionSelect={handleSuggestionSelect}
		/>
	</div>
</div>
