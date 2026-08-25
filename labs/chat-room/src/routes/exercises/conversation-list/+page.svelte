<script lang="ts">
	import {
		appendAssistantMessage,
		appendUserMessage,
		Chat,
		createConversationHistory,
		type ChatSubmitEvent,
		type ConversationHistory
	} from '@lostgradient/chat';
	import {
		ChatConversationList,
		deriveConversationSummary,
		type ConversationSummary
	} from '@lostgradient/chat/conversation-list';
	import { ChatConversationHeader } from '@lostgradient/chat/conversation-header';

	/**
	 * Fixed timestamps (rather than the real clock) keep conversation recency —
	 * and therefore ChatConversationList's internal sort order — deterministic
	 * across runs. `at(base, offsetSeconds)` returns a `ConversationEnvironment`
	 * override whose `now()` always resolves to the same instant.
	 */
	function at(base: string, offsetSeconds: number): { now: () => string } {
		const iso = new Date(Date.parse(base) + offsetSeconds * 1000).toISOString();
		return { now: () => iso };
	}

	const LAUNCH_CREATED = '2024-01-01T09:00:00.000Z';
	const BILLING_CREATED = '2024-01-02T09:00:00.000Z';
	const ONBOARDING_CREATED = '2024-01-03T09:00:00.000Z';
	const HEADER_DEMO_CREATED = '2024-01-04T09:00:00.000Z';

	/**
	 * Seeds three fixed conversations, oldest-created first, so the exercise is
	 * deterministic: no network calls, no clock-dependent ordering beyond what's
	 * baked in here. `billing` also carries the namespaced `_unreadCount` /
	 * `_participantNames` conversation metadata that `deriveConversationSummary`
	 * reads, exercising the unread badge and participant display.
	 */
	function seedConversations(): Record<string, ConversationHistory> {
		let launch = createConversationHistory(
			{ id: 'launch', title: 'Launch support' },
			at(LAUNCH_CREATED, 0)
		);
		launch = appendUserMessage(
			launch,
			'When do we launch the rocket?',
			undefined,
			at(LAUNCH_CREATED, 1)
		);
		launch = appendAssistantMessage(
			launch,
			'We launch the rocket on Friday at 9am.',
			undefined,
			at(LAUNCH_CREATED, 2)
		);

		let billing = createConversationHistory(
			{
				id: 'billing',
				title: 'Billing question',
				metadata: { _unreadCount: 2, _participantNames: ['Ali Chen', 'Jordan Reyes'] }
			},
			at(BILLING_CREATED, 0)
		);
		billing = appendUserMessage(
			billing,
			'Can you resend the invoice?',
			undefined,
			at(BILLING_CREATED, 1)
		);
		billing = appendAssistantMessage(
			billing,
			"Sure, I've resent the invoice to your inbox.",
			undefined,
			at(BILLING_CREATED, 2)
		);

		let onboarding = createConversationHistory(
			{ id: 'onboarding', title: 'Onboarding walkthrough' },
			at(ONBOARDING_CREATED, 0)
		);
		onboarding = appendUserMessage(
			onboarding,
			'How do I invite my team?',
			undefined,
			at(ONBOARDING_CREATED, 1)
		);
		onboarding = appendAssistantMessage(
			onboarding,
			'Go to Settings, then Team, then Invite Members.',
			undefined,
			at(ONBOARDING_CREATED, 2)
		);

		return { launch, billing, onboarding };
	}

	/**
	 * A conversation used only by the header-variant demos below, kept out of
	 * the sidebar entirely so its title never collides with the sidebar's
	 * "Launch support" / "Billing question" / "Onboarding walkthrough" headings
	 * once one of those becomes the active conversation's heading too. Three
	 * participant names exercise ChatConversationHeader's ">2 names" truncation.
	 */
	function seedHeaderDemoConversation(): ConversationHistory {
		let conversation = createConversationHistory(
			{
				id: 'header-demo',
				title: 'Header demo conversation',
				metadata: {
					_unreadCount: 5,
					_participantNames: ['Priya Patel', 'Sam Osei', 'Lee Kim']
				}
			},
			at(HEADER_DEMO_CREATED, 0)
		);
		conversation = appendUserMessage(
			conversation,
			'Testing the header export actions.',
			undefined,
			at(HEADER_DEMO_CREATED, 1)
		);
		conversation = appendAssistantMessage(
			conversation,
			'Acknowledged — header demo message.',
			undefined,
			at(HEADER_DEMO_CREATED, 2)
		);
		return conversation;
	}

	let conversations = $state<Record<string, ConversationHistory>>(seedConversations());
	let activeConversationId = $state('launch');

	// Deliberately NOT pre-sorted: ChatConversationList's prop docs say it
	// sorts by recency internally, so raw insertion order (oldest-created
	// first) is handed straight through, and the rendered order pins whether
	// the component actually performs that sort itself.
	const summaries = $derived(Object.values(conversations).map(deriveConversationSummary));
	const activeConversation = $derived(conversations[activeConversationId]);

	function selectConversation(conversationId: string): void {
		activeConversationId = conversationId;
	}

	// Deterministic stand-in for a backend: echoes the user's message back as
	// the assistant reply, scoped to whichever conversation is active. `onsubmit`
	// hands back the raw message (mirroring the adapter's `sendMessage`
	// contract) — the consumer owns appending it to the transcript.
	function handleSubmit(event: ChatSubmitEvent): void {
		const conversationId = activeConversationId;
		const content = event.message.content;
		let next = appendUserMessage(conversations[conversationId], content);
		next = appendAssistantMessage(
			next,
			typeof content === 'string' ? `You said: ${content}` : 'Got it.'
		);
		conversations = { ...conversations, [conversationId]: next };
	}

	// --- Empty state exercise ------------------------------------------------
	let emptyStateConversations = $state<ConversationSummary[]>(
		Object.values(seedConversations()).map(deriveConversationSummary)
	);

	function clearEmptyStateConversations(): void {
		emptyStateConversations = [];
	}

	function restoreEmptyStateConversations(): void {
		emptyStateConversations = Object.values(seedConversations()).map(deriveConversationSummary);
	}

	// --- Header variant exercise ----------------------------------------------
	const headerDemoConversation = seedHeaderDemoConversation();
</script>

<div style="height: 100dvh; display: flex; flex-direction: column; overflow-y: auto;">
	<div style="flex: 1; min-height: 24rem; display: flex;">
		<div
			style="width: 20rem; border-right: 1px solid var(--cinder-border); overflow-y: auto;"
			data-testid="main-conversation-list"
		>
			<ChatConversationList
				conversations={summaries}
				{activeConversationId}
				onSelectConversation={selectConversation}
			/>
		</div>
		<div style="flex: 1; min-height: 0; display: flex; flex-direction: column;">
			{#key activeConversationId}
				<Chat
					id="conversation-list-exercise-chat"
					conversation={activeConversation}
					onsubmit={handleSubmit}
				>
					{#snippet header()}
						<ChatConversationHeader conversation={activeConversation} showExportActions={false} />
					{/snippet}
				</Chat>
			{/key}
		</div>
	</div>

	<section
		data-testid="empty-state-demo"
		style="padding: 1rem; border-top: 1px solid var(--cinder-border);"
	>
		<h2>Empty state</h2>
		<div style="display: flex; gap: 0.5rem; margin-block-end: 0.5rem;">
			<button type="button" data-testid="empty-state-clear" onclick={clearEmptyStateConversations}>
				Empty conversations
			</button>
			<button
				type="button"
				data-testid="empty-state-restore"
				onclick={restoreEmptyStateConversations}
			>
				Restore conversations
			</button>
		</div>
		<div style="width: 20rem;">
			<ChatConversationList
				conversations={emptyStateConversations}
				ariaLabel="Empty state demo conversations"
			/>
		</div>
		<div style="width: 20rem; margin-block-start: 0.5rem;">
			<ChatConversationList
				conversations={[]}
				ariaLabel="Custom empty text demo conversations"
				emptyText="No saved conversations yet"
			/>
		</div>
	</section>

	<section
		data-testid="active-null-demo"
		style="padding: 1rem; border-top: 1px solid var(--cinder-border);"
	>
		<h2>No active conversation</h2>
		<div style="width: 20rem;">
			<ChatConversationList
				conversations={summaries}
				activeConversationId={null}
				ariaLabel="Active null demo conversations"
			/>
		</div>
	</section>

	<section
		data-testid="header-demo"
		style="padding: 1rem; border-top: 1px solid var(--cinder-border); display: flex; flex-direction: column; gap: 1rem;"
	>
		<h2>Conversation header variants</h2>

		<div data-testid="header-default-export">
			<ChatConversationHeader conversation={headerDemoConversation} />
		</div>

		<div data-testid="header-heading-level-3">
			<ChatConversationHeader
				conversation={headerDemoConversation}
				headingLevel={3}
				showExportActions={false}
			/>
		</div>

		<div data-testid="header-actions-snippet">
			<ChatConversationHeader conversation={headerDemoConversation} showExportActions={false}>
				{#snippet actions(summary)}
					<span data-testid="header-actions-content">
						{summary.title} · {summary.messageCount} messages · {summary.participantNames.join(
							', '
						)}
					</span>
				{/snippet}
			</ChatConversationHeader>
		</div>
	</section>
</div>
