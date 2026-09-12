<script lang="ts">
	import {
		Chat,
		createChatSessionController,
		createConversationHistory,
		decodeChatStreamEvents,
		type ChatAdapterErrorEvent,
		type ConversationHistory
	} from '@lostgradient/chat';
	import { toBannerFailure, type BannerFailure } from '$lib/chat-failure';
	import { resolve } from '$app/paths';
	import { SvelteMap } from 'svelte/reactivity';
	import { updatePendingApproval, type PendingApprovalResult } from '$lib/pending-approval';
	import type { SignedPendingToolApproval } from 'armorer';
	let conversation = $state<ConversationHistory>(
		createConversationHistory({ id: 'chatroom-demo' })
	);
	let failure = $state<BannerFailure | null>(null);
	let streaming = $state(false);
	const pendingApprovals = new SvelteMap<string, SignedPendingToolApproval>();
	const session = createChatSessionController({
		getConversation: () => $state.snapshot(conversation),
		setConversation: (next) => (conversation = next),
		transport: async ({ conversation: history, signal }) => {
			const response = await fetch('/api/chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ conversation: history }),
				signal
			});
			if (!response.ok || !response.body) throw new Error(await response.text());
			return decodeChatStreamEvents(response.body);
		},
		hooks: {
			onStreamingChange: (value) => {
				streaming = value;
				if (value) failure = null;
			},
			onToolResult: (result) => {
				updatePendingApproval(pendingApprovals, result);
			},
			approveToolCall: async (toolCallId) => {
				const approval = pendingApprovals.get(toolCallId);
				if (!approval) return undefined;
				const response = await fetch('/api/chat/resume', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ approval, decision: 'approve' })
				});
				if (!response.ok) throw new Error(await response.text());
				const result = (await response.json()) as PendingApprovalResult;
				updatePendingApproval(pendingApprovals, result);
				return result;
			},
			denyToolCall: async (toolCallId) => {
				pendingApprovals.delete(toolCallId);
				return {
					callId: toolCallId,
					outcome: 'error',
					content: null,
					error: {
						code: 'denied',
						category: 'permission',
						retryable: false,
						message: 'The user denied this request.'
					}
				};
			},
			onError: (cause) => (failure = toBannerFailure(cause))
		}
	});
	const adapter = session.adapter;
	function handleAdapterError(event: ChatAdapterErrorEvent): void {
		failure = toBannerFailure(event.error);
	}
</script>

<svelte:head><title>Chatroom</title></svelte:head>
<div style="height: 100dvh; display: flex; flex-direction: column;">
	<a href={resolve('/exercises')} style="padding: 0.5rem 1rem;">Exercises</a>
	<p
		role="alert"
		data-testid="demo-error"
		data-retryable={failure?.retryable === undefined ? undefined : String(failure.retryable)}
		style="margin: 0; color: var(--cinder-status-danger-solid); padding: {failure
			? '0.5rem 1rem'
			: '0'}"
	>
		{#if failure}
			{failure.message}
			<!--
				The classification, rendered rather than flattened away. A reader
				should be able to tell from the banner whether pressing Retry is
				worth anything, without guessing from the wording.
			-->
			{#if failure.retryable === true}
				<span data-testid="demo-error-disposition"> — you can try that again.</span>
			{:else if failure.retryable === false}
				<span data-testid="demo-error-disposition"> — retrying will not help.</span>
			{/if}
		{/if}
	</p>
	<div style="flex: 1; min-height: 0;">
		<Chat
			id="chatroom-demo-chat"
			{conversation}
			{adapter}
			{streaming}
			scrollFadeVisible
			onadaptererror={handleAdapterError}
		/>
	</div>
</div>
