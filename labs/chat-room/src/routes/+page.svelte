<script lang="ts">
	import {
		Chat,
		createChatSessionController,
		createConversationHistory,
		decodeChatStreamEvents,
		type ChatAdapterErrorEvent,
		type ConversationHistory
	} from '@lostgradient/chat';
	import { resolve } from '$app/paths';
	import { SvelteMap } from 'svelte/reactivity';
	import { updatePendingApproval, type PendingApprovalResult } from '$lib/pending-approval';
	import type { SignedPendingToolApproval } from 'armorer';
	let conversation = $state<ConversationHistory>(
		createConversationHistory({ id: 'chatroom-demo' })
	);
	let error = $state<string | null>(null);
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
				if (value) error = null;
			},
			onToolResult: (result) => {
				updatePendingApproval(pendingApprovals, result as PendingApprovalResult);
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
			onError: (cause) => (error = cause instanceof Error ? cause.message : 'Something went wrong.')
		}
	});
	const adapter = session.adapter;
	function handleAdapterError(event: ChatAdapterErrorEvent): void {
		error = event.error instanceof Error ? event.error.message : 'Something went wrong.';
	}
</script>

<svelte:head><title>Chatroom</title></svelte:head>
<div style="height: 100dvh; display: flex; flex-direction: column;">
	<a href={resolve('/exercises')} style="padding: 0.5rem 1rem;">Exercises</a>
	<p
		role="alert"
		data-testid="demo-error"
		style="margin: 0; color: var(--cinder-status-danger-solid); padding: {error
			? '0.5rem 1rem'
			: '0'}"
	>
		{error ?? ''}
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
