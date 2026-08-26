<script lang="ts">
	import {
		Chat,
		ChatDateSeparator,
		ChatInput,
		ChatMessage,
		ConversationExportActions,
		MessageContent,
		ToolCallGroup,
		appendAssistantMessage,
		appendMessages,
		appendUserMessage,
		createConversationHistory,
		formatMessageAsMarkdown,
		getMessageRoleLabel,
		getMessageText,
		messagesToMarkdown,
		type ConversationHistory,
		type Message,
		type MessageInput,
		type ToolCallPair
	} from '@lostgradient/chat';

	// -------------------------------------------------------------------------
	// Seeded conversation shared by the utility-function output, the
	// ConversationExportActions demo, and the full Chat instance below (used
	// to exercise the imperative methods). Includes one user/assistant pair
	// and one tool-call/tool-result pair so every utility has non-trivial
	// input to run against, plus enough padding messages that the full Chat
	// instance overflows its viewport (scrollToBottom/scrollToTop are no-ops
	// on a transcript that already fits).
	// -------------------------------------------------------------------------
	function buildSeededConversation(): ConversationHistory {
		let history = createConversationHistory({ id: 'utilities-demo' });
		history = appendUserMessage(history, 'What is the weather in **Portland**?');
		history = appendAssistantMessage(
			history,
			'Let me check that for you. Here is what I found:\n\n- Sky: overcast\n- Temp: 54°F'
		);
		history = appendMessages(history, {
			role: 'tool-call',
			content: '',
			toolCall: { id: 'call-1', name: 'get_weather', arguments: { city: 'Portland' } }
		});
		history = appendMessages(history, {
			role: 'tool-result',
			content: '',
			toolResult: {
				callId: 'call-1',
				outcome: 'success',
				content: { tempF: 54, sky: 'overcast' }
			}
		});

		for (let index = 0; index < 20; index += 1) {
			history = appendMessages(history, {
				role: index % 2 === 0 ? 'user' : 'assistant',
				content: `Padding message ${index + 1} — enough text to give this row real height so the transcript overflows the viewport.`
			});
		}

		return history;
	}

	let conversation = $state<ConversationHistory>(buildSeededConversation());
	const messages = $derived(conversation.ids.map((id) => conversation.messages[id]));

	// --- ConversationExportActions -------------------------------------------
	let exportStatus = $state('');

	// --- Full Chat + imperative methods ---------------------------------------
	let chat: ReturnType<typeof Chat> | undefined;
	let announceText = $state('');
	let atBottom = $state(true);
	let composerSnapshot = $state('');

	function handleAnnounce(): void {
		announceText = 'Announcement: imperative announce() probe fired.';
		chat?.announce(announceText, 'polite');
	}

	function handleAnnounceAssertive(): void {
		chat?.announce('Assertive announcement: imperative announce() probe fired.', 'assertive');
	}

	function refreshComposerSnapshot(): void {
		composerSnapshot = chat?.getComposerValue() ?? '';
	}

	function handleClearInput(): void {
		chat?.clearInput();
		refreshComposerSnapshot();
	}

	// --- Standalone building blocks, composed without the Chat shell ----------
	const standaloneDate = new Date('2024-03-14T00:00:00Z');
	const formatDateForTest = (date: Date): string => date.toISOString().slice(0, 10);

	const standaloneUserMessage: Message = {
		id: 'standalone-user-1',
		role: 'user',
		content: 'Standalone ChatMessage, rendered with no Chat container around it.',
		position: 0,
		createdAt: standaloneDate.toISOString(),
		metadata: {},
		hidden: false
	};

	const standaloneAssistantMessage: Message = {
		id: 'standalone-assistant-1',
		role: 'assistant',
		content:
			'The reply came back **without** a Chat shell, driven by a bare ChatMessage component.',
		position: 1,
		createdAt: standaloneDate.toISOString(),
		metadata: {},
		hidden: false
	};

	const standaloneMarkdown =
		'**Bold**, _italic_, and a `code span` rendered by bare MessageContent.';

	const standaloneToolPair: ToolCallPair = {
		call: { id: 'standalone-call-1', name: 'lookup_order', arguments: { orderId: 'A100' } },
		result: { callId: 'standalone-call-1', outcome: 'success', content: { status: 'shipped' } }
	};
	let standaloneToolExpanded = $state(false);

	let standaloneComposerValue = $state('');
	let lastStandaloneSubmission = $state<MessageInput | null>(null);
	function handleStandaloneSubmit(message: MessageInput): void {
		lastStandaloneSubmission = message;
	}
</script>

<div style="padding: 1rem; display: flex; flex-direction: column; gap: 2rem; max-width: 60rem;">
	<section>
		<h2>Utility functions against a seeded conversation</h2>
		<ul style="list-style: none; padding: 0; display: flex; flex-direction: column; gap: 0.75rem;">
			{#each messages as message (message.id)}
				<li data-testid="utilities-message-row" data-message-id={message.id}>
					<strong data-testid="utilities-role-label">{getMessageRoleLabel(message)}</strong>
					<pre
						data-testid="utilities-format-as-markdown"
						style="white-space: pre-wrap; margin: 0.25rem 0;">{formatMessageAsMarkdown(
							message
						)}</pre>
					<pre
						data-testid="utilities-get-message-text"
						style="white-space: pre-wrap; margin: 0.25rem 0;">{getMessageText(message)}</pre>
				</li>
			{/each}
		</ul>

		<h3>messagesToMarkdown(messages)</h3>
		<pre
			data-testid="utilities-messages-to-markdown"
			style="white-space: pre-wrap;">{messagesToMarkdown(messages)}</pre>
	</section>

	<section>
		<h2>ConversationExportActions</h2>
		<div style="display: flex; align-items: center; gap: 0.75rem;">
			<ConversationExportActions
				id="utilities-export-actions"
				{conversation}
				onexported={(format) => (exportStatus = `exported: ${format}`)}
				onexportfailed={(format, error) => (exportStatus = `failed: ${format} (${error})`)}
			/>
			<span data-testid="utilities-export-status">{exportStatus}</span>
		</div>
	</section>

	<section>
		<h2>Imperative Chat methods</h2>
		<div style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.5rem;">
			<button type="button" data-testid="utilities-announce" onclick={handleAnnounce}>
				announce()
			</button>
			<button
				type="button"
				data-testid="utilities-announce-assertive"
				onclick={handleAnnounceAssertive}
			>
				announce(assertive)
			</button>
			<button type="button" data-testid="utilities-scroll-top" onclick={() => chat?.scrollToTop()}>
				scrollToTop()
			</button>
			<button
				type="button"
				data-testid="utilities-scroll-bottom"
				onclick={() => chat?.scrollToBottom()}
			>
				scrollToBottom()
			</button>
			<button type="button" data-testid="utilities-focus-input" onclick={() => chat?.focusInput()}>
				focusInput()
			</button>
			<button
				type="button"
				data-testid="utilities-refresh-composer-value"
				onclick={refreshComposerSnapshot}
			>
				getComposerValue()
			</button>
			<button type="button" data-testid="utilities-clear-input" onclick={handleClearInput}>
				clearInput()
			</button>
		</div>
		<p data-testid="utilities-at-bottom">atBottom: {atBottom}</p>
		<p data-testid="utilities-composer-value">Composer value: "{composerSnapshot}"</p>

		<div
			data-testid="utilities-full-chat-wrapper"
			style="height: 24rem; border: 1px solid var(--cinder-border);"
		>
			<Chat bind:this={chat} id="utilities-full-chat" {conversation} bind:atBottom />
		</div>
	</section>

	<section>
		<h2>Standalone building blocks (no Chat shell)</h2>

		<h3>ChatDateSeparator</h3>
		<div data-testid="utilities-date-separator">
			<ChatDateSeparator date={standaloneDate} dateFormatter={formatDateForTest} />
		</div>

		<h3>ChatMessage</h3>
		<div data-testid="utilities-chat-message-user">
			<ChatMessage message={standaloneUserMessage} />
		</div>
		<div data-testid="utilities-chat-message-assistant">
			<ChatMessage message={standaloneAssistantMessage} />
		</div>

		<h3>MessageContent</h3>
		<div data-testid="utilities-message-content">
			<MessageContent content={standaloneMarkdown} />
		</div>

		<h3>ToolCallGroup</h3>
		<div data-testid="utilities-tool-call-group">
			<ToolCallGroup
				pair={standaloneToolPair}
				expanded={standaloneToolExpanded}
				onToggle={() => (standaloneToolExpanded = !standaloneToolExpanded)}
			/>
		</div>

		<h3>ChatInput</h3>
		<div data-testid="utilities-chat-input">
			<ChatInput
				id="utilities-standalone-input"
				bind:value={standaloneComposerValue}
				allowAttachments={false}
				onsubmit={handleStandaloneSubmit}
			/>
		</div>
		<p data-testid="utilities-last-submission">
			{lastStandaloneSubmission
				? `submitted: ${JSON.stringify(lastStandaloneSubmission)}`
				: 'no submission yet'}
		</p>
	</section>
</div>
