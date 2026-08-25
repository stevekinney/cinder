<script lang="ts">
	import {
		appendToolCall,
		appendToolResult,
		appendUserMessage,
		Chat,
		createConversationHistory,
		type ChatAdapter,
		type ChatAdapterErrorEvent,
		type ChatAnnounceLevel,
		type ConversationHistory
	} from '@lostgradient/chat';

	// Exercises the documented tool-approval contract from `chat.types.d.ts`:
	// when an adapter is wired, Chat calls `adapter.approveToolCall`/
	// `denyToolCall` FIRST, and only calls `onapprove`/`ondeny` once that
	// adapter call resolves. Each scenario below gets its own Chat instance
	// because Chat's internal `approvedToolCallIds`/`deniedToolCallIds` sets
	// permanently resolve a given tool-call id — a call can't be approved and
	// then denied, so scenarios that need a "fresh" pending call each get a
	// dedicated seed.

	function sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	// Builds a tool-call + action_required tool-result pair. Chat pairs these
	// by matching `toolResult.callId` to `toolCall.id` (`pairToolCallsWithResults`)
	// and renders the approval prompt on the visible tool-CALL row with the
	// result folded in — both messages are required, not just the result.
	function seedWithPendingApproval(
		id: string,
		toolCallId: string,
		toolName: string,
		message: string
	): ConversationHistory {
		let conversation = createConversationHistory({ id });
		conversation = appendUserMessage(conversation, `Please run ${toolName}.`);
		conversation = appendToolCall(conversation, {
			id: toolCallId,
			name: toolName,
			arguments: {}
		});
		conversation = appendToolResult(conversation, {
			callId: toolCallId,
			outcome: 'action_required',
			content: null,
			action: { type: 'approval', message }
		});
		return conversation;
	}

	function seedWithTwoPendingApprovals(id: string): ConversationHistory {
		let conversation = createConversationHistory({ id });
		conversation = appendUserMessage(
			conversation,
			'Please send the digest and refund the invoice.'
		);
		conversation = appendToolCall(conversation, {
			id: 'call-approve',
			name: 'send_email',
			arguments: {}
		});
		conversation = appendToolResult(conversation, {
			callId: 'call-approve',
			outcome: 'action_required',
			content: null,
			action: { type: 'approval', message: 'Send the weekly digest email?' }
		});
		conversation = appendToolCall(conversation, {
			id: 'call-deny',
			name: 'issue_refund',
			arguments: {}
		});
		conversation = appendToolResult(conversation, {
			callId: 'call-deny',
			outcome: 'action_required',
			content: null,
			action: { type: 'approval', message: 'Issue a refund for order #4821?' }
		});
		return conversation;
	}

	// --- Scenario 1: adapter-driven, ordering (approve one call, deny another) ---

	let conversationBoth = $state<ConversationHistory>(
		seedWithTwoPendingApprovals('tool-approval-both')
	);
	let logBoth = $state<string[]>([]);

	const adapterBoth: ChatAdapter = {
		sendMessage: async () => {},
		approveToolCall: async (toolCallId) => {
			logBoth = [...logBoth, `adapter.approveToolCall:${toolCallId}`];
		},
		denyToolCall: async (toolCallId) => {
			logBoth = [...logBoth, `adapter.denyToolCall:${toolCallId}`];
		}
	};

	function handleApproveBoth(toolCallId: string): void {
		logBoth = [...logBoth, `onapprove:${toolCallId}`];
	}

	function handleDenyBoth(toolCallId: string): void {
		logBoth = [...logBoth, `ondeny:${toolCallId}`];
	}

	// --- Scenario 2: rejection routing (adapter.approveToolCall rejects) -----

	let conversationFail = $state<ConversationHistory>(
		seedWithPendingApproval(
			'tool-approval-fail',
			'call-fail',
			'delete_records',
			'Permanently delete the flagged records?'
		)
	);
	let logFail = $state<string[]>([]);
	let failApprove = $state(false);
	let errorFail = $state<string | null>(null);

	const adapterFail: ChatAdapter = {
		sendMessage: async () => {},
		approveToolCall: async (toolCallId) => {
			logFail = [...logFail, `adapter.approveToolCall:${toolCallId}`];
			if (failApprove) throw new Error('Simulated approveToolCall rejection');
		}
	};

	function handleApproveFail(toolCallId: string): void {
		logFail = [...logFail, `onapprove:${toolCallId}`];
	}

	function handleAdapterErrorFail(event: ChatAdapterErrorEvent): void {
		const reason = event.error instanceof Error ? event.error.message : 'failed';
		errorFail = `${event.command}: ${reason}`;
	}

	function toggleFailApprove(): void {
		failApprove = !failApprove;
	}

	// --- Scenario 3: callback-only, no adapter at all ------------------------

	let conversationCallbackOnly = $state<ConversationHistory>(
		seedWithTwoPendingApprovals('tool-approval-callback-only')
	);
	let logCallbackOnly = $state<string[]>([]);

	function handleApproveCallbackOnly(toolCallId: string): void {
		logCallbackOnly = [...logCallbackOnly, `onapprove:${toolCallId}`];
	}

	function handleDenyCallbackOnly(toolCallId: string): void {
		logCallbackOnly = [...logCallbackOnly, `ondeny:${toolCallId}`];
	}

	// --- Scenario 4: rapid double-click against a slow adapter ---------------

	const SLOW_APPROVE_DELAY_MS = 250;

	let conversationDoubleClick = $state<ConversationHistory>(
		seedWithPendingApproval(
			'tool-approval-double-click',
			'call-slow',
			'restart_service',
			'Restart the payments service now?'
		)
	);
	let approveInvocations = $state(0);

	const adapterDoubleClick: ChatAdapter = {
		sendMessage: async () => {},
		approveToolCall: async () => {
			approveInvocations += 1;
			await sleep(SLOW_APPROVE_DELAY_MS);
		}
	};

	function handleApproveDoubleClick(): void {
		// No-op: only the invocation count on the adapter side matters here.
	}

	// --- Scenario 5: assertive announcement precedence ------------------------

	let conversationAssertive = $state<ConversationHistory>(
		seedWithPendingApproval(
			'tool-approval-assertive',
			'call-assertive',
			'purge_cache',
			'Purge the CDN cache for all regions?'
		)
	);
	let chatAssertiveRef: ReturnType<typeof Chat> | undefined;

	function announceConsumerText(): void {
		const level: ChatAnnounceLevel = 'assertive';
		chatAssertiveRef?.announce('Consumer text should not win.', level);
	}
</script>

<div
	style="max-width: 60rem; margin: 0 auto; padding: 1rem; display: flex; flex-direction: column; gap: 2rem;"
>
	<section style="display: flex; flex-direction: column; gap: 0.5rem;">
		<h2 style="margin: 0;">1. Adapter-driven: approve then deny, ordered</h2>
		<div style="height: 24rem;">
			<Chat
				id="tool-approval-both-chat"
				conversation={conversationBoth}
				adapter={adapterBoth}
				onapprove={handleApproveBoth}
				ondeny={handleDenyBoth}
			/>
		</div>
		<ul data-testid="both-log" style="margin: 0; padding-left: 1.25rem; font-size: 0.75rem;">
			{#each logBoth as entry, index (index)}
				<li>{entry}</li>
			{/each}
		</ul>
	</section>

	<section style="display: flex; flex-direction: column; gap: 0.5rem;">
		<h2 style="margin: 0;">2. Rejection routing: adapter.approveToolCall rejects</h2>
		<button type="button" data-testid="toggle-fail-approve" onclick={toggleFailApprove}>
			{failApprove ? 'Disable' : 'Enable'} approveToolCall failure
		</button>
		<!-- Always rendered, never `{#if}`-gated. A live region has to exist in the
		     DOM before the content arrives: mounting one that already has text is not
		     reliably announced, which is the pattern Chat's own
		     `chat-status-announcer.svelte` documents and follows. Padding is applied
		     only when populated so an empty region takes no layout. -->
		<p role="alert" data-testid="fail-error" style="margin: 0; color: var(--cinder-danger);">
			{errorFail ?? ''}
		</p>
		<div style="height: 24rem;">
			<Chat
				id="tool-approval-fail-chat"
				conversation={conversationFail}
				adapter={adapterFail}
				onapprove={handleApproveFail}
				onadaptererror={handleAdapterErrorFail}
			/>
		</div>
		<ul data-testid="fail-log" style="margin: 0; padding-left: 1.25rem; font-size: 0.75rem;">
			{#each logFail as entry, index (index)}
				<li>{entry}</li>
			{/each}
		</ul>
	</section>

	<section style="display: flex; flex-direction: column; gap: 0.5rem;">
		<h2 style="margin: 0;">3. Callback-only: no adapter wired</h2>
		<div style="height: 24rem;">
			<Chat
				id="tool-approval-callback-only-chat"
				conversation={conversationCallbackOnly}
				onapprove={handleApproveCallbackOnly}
				ondeny={handleDenyCallbackOnly}
			/>
		</div>
		<ul
			data-testid="callback-only-log"
			style="margin: 0; padding-left: 1.25rem; font-size: 0.75rem;"
		>
			{#each logCallbackOnly as entry, index (index)}
				<li>{entry}</li>
			{/each}
		</ul>
	</section>

	<section style="display: flex; flex-direction: column; gap: 0.5rem;">
		<h2 style="margin: 0;">4. Rapid double-click against a slow adapter</h2>
		<p data-testid="double-click-count" style="margin: 0;">
			approveToolCall invocations: {approveInvocations}
		</p>
		<div style="height: 24rem;">
			<Chat
				id="tool-approval-double-click-chat"
				conversation={conversationDoubleClick}
				adapter={adapterDoubleClick}
				onapprove={handleApproveDoubleClick}
			/>
		</div>
	</section>

	<section style="display: flex; flex-direction: column; gap: 0.5rem;">
		<h2 style="margin: 0;">5. Assertive announcement precedence</h2>
		<button type="button" data-testid="announce-consumer-text" onclick={announceConsumerText}>
			Announce consumer text (assertive)
		</button>
		<div style="height: 24rem;">
			<Chat
				id="tool-approval-assertive-chat"
				bind:this={chatAssertiveRef}
				conversation={conversationAssertive}
			/>
		</div>
	</section>
</div>
