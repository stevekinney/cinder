<script lang="ts">
	import {
		appendMessages,
		Chat,
		clearMessageDeliveryStatus,
		type ChatAdapter,
		type ChatAdapterErrorEvent,
		type ConversationHistory,
		type MessageInput
	} from '@lostgradient/chat';
	import { replaceMessage, seedConversation, streamReply } from './message-lifecycle-shared';

	// Instance A: driven entirely through a `ChatAdapter`. Beyond the plain
	// retry/edit/stop-generating coverage the sibling plain-panel also exercises,
	// this panel additionally proves the adapter FAILURE-ROUTING contract
	// (`ChatAdapter`'s doc comment: "Command methods return `Promise<void>` —
	// Chat awaits them and routes any failure (a rejected promise OR a
	// synchronous throw from the method) to `onadaptererror`") and single-flight
	// behavior under rapid double-clicks.

	type FailMode = 'resolve' | 'reject' | 'throw';
	type CommandName = 'sendMessage' | 'retryMessage' | 'editMessage' | 'stopGenerating';

	// Artificial delay before `retryMessage`'s real work completes, so a
	// double-click test has a window in which the first click's promise is
	// still pending when the second click lands. `sendMessage`'s own
	// `streamReply` already has a much longer natural window (the first
	// `STREAM_DELAY_MS` await before anything resolves).
	const RETRY_DELAY_MS = 150;

	let conversationA = $state<ConversationHistory>(seedConversation('message-lifecycle-adapter'));
	let streamingA = $state(false);
	let errorA = $state<string | null>(null);
	let logA = $state<string[]>([]);
	let stopRequestedA = false;

	let failModeA = $state<FailMode>('resolve');
	let callCountsA = $state<Record<CommandName, number>>({
		sendMessage: 0,
		retryMessage: 0,
		editMessage: 0,
		stopGenerating: 0
	});

	function snapshotA(): ConversationHistory {
		return $state.snapshot(conversationA);
	}

	function logEntry(entry: string): void {
		logA = [...logA, entry];
	}

	// Builds a synchronous-throw failure for `command`. Declaring the adapter
	// methods themselves as plain (non-`async`) functions matters here: an
	// `async` function turns any throw inside it into a rejected promise, which
	// would make "sync throw" indistinguishable from "rejected promise" at the
	// call site. Throwing before any `Promise` is created/returned is the only
	// way to exercise the sync-throw leg of Chat's routing contract for real.
	function throwFailure(command: CommandName): never {
		throw new Error(`${command} failed (fail-mode: throw)`);
	}

	function rejectFailure(command: CommandName): Promise<never> {
		return Promise.reject(new Error(`${command} failed (fail-mode: reject)`));
	}

	async function performSendA(message: MessageInput): Promise<void> {
		errorA = null;
		logEntry('sendMessage');
		conversationA = appendMessages(conversationA, message);
		stopRequestedA = false;
		await streamReply({
			getSnapshot: snapshotA,
			setConversation: (next) => (conversationA = next),
			setStreaming: (value) => (streamingA = value),
			shouldStop: () => stopRequestedA,
			log: logEntry
		});
	}

	async function performRetryA(messageId: string): Promise<void> {
		errorA = null;
		await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));

		const target = conversationA.messages[messageId];
		if (!target) return;

		logEntry(`retryMessage:${messageId}`);
		conversationA = clearMessageDeliveryStatus(
			replaceMessage(conversationA, messageId, {
				content: 'Retried reply: the deterministic fact arrived on retry.'
			}),
			messageId
		);
	}

	async function performEditA(event: { messageId: string; content: string }): Promise<void> {
		errorA = null;
		logEntry(`editMessage:${event.messageId}:${event.content}`);
		conversationA = replaceMessage(conversationA, event.messageId, { content: event.content });
	}

	async function performStopA(messageId: string): Promise<void> {
		errorA = null;
		logEntry(`stopGenerating:${messageId}`);
		stopRequestedA = true;
	}

	const adapter: ChatAdapter = {
		sendMessage: (message) => {
			callCountsA.sendMessage += 1;
			if (failModeA === 'throw') return throwFailure('sendMessage');
			if (failModeA === 'reject') return rejectFailure('sendMessage');
			return performSendA(message);
		},
		retryMessage: (messageId) => {
			callCountsA.retryMessage += 1;
			if (failModeA === 'throw') return throwFailure('retryMessage');
			if (failModeA === 'reject') return rejectFailure('retryMessage');
			return performRetryA(messageId);
		},
		editMessage: (event) => {
			callCountsA.editMessage += 1;
			if (failModeA === 'throw') return throwFailure('editMessage');
			if (failModeA === 'reject') return rejectFailure('editMessage');
			return performEditA(event);
		},
		stopGenerating: (messageId) => {
			callCountsA.stopGenerating += 1;
			if (failModeA === 'throw') return throwFailure('stopGenerating');
			if (failModeA === 'reject') return rejectFailure('stopGenerating');
			return performStopA(messageId);
		}
	};

	function handleAdapterError(event: ChatAdapterErrorEvent): void {
		const message = event.error instanceof Error ? event.error.message : 'Something went wrong.';
		errorA = `${event.command}: ${message}`;
	}
</script>

<section style="flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 0.5rem;">
	<h2 style="margin: 0;">Adapter-driven (retryMessage / editMessage / stopGenerating)</h2>
	<div style="display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;">
		<label style="display: flex; align-items: center; gap: 0.35rem; font-size: 0.85rem;">
			Fail mode
			<select data-testid="fail-mode-a" bind:value={failModeA}>
				<option value="resolve">resolve</option>
				<option value="reject">reject</option>
				<option value="throw">throw</option>
			</select>
		</label>
		<dl
			data-testid="call-counts-a"
			style="display: flex; gap: 0.75rem; margin: 0; font-size: 0.75rem;"
		>
			{#each Object.entries(callCountsA) as [command, count] (command)}
				<div style="display: flex; gap: 0.25rem;">
					<dt>{command}</dt>
					<dd data-testid={`call-count-a-${command}`} style="margin: 0;">{count}</dd>
				</div>
			{/each}
		</dl>
	</div>
	<!-- Always rendered, never `{#if}`-gated. A live region has to exist in the
	     DOM before the content arrives: mounting one that already has text is not
	     reliably announced, which is the pattern Chat's own
	     `chat-status-announcer.svelte` documents and follows. Padding is applied
	     only when populated so an empty region takes no layout. -->
	<p role="alert" data-testid="adapter-error" style="margin: 0; color: var(--cinder-danger);">
		{errorA ?? ''}
	</p>
	<div style="flex: 1; min-height: 0; display: flex; gap: 0.5rem;">
		<div style="flex: 2; min-height: 0; display: flex; flex-direction: column;">
			<Chat
				id="message-lifecycle-adapter-chat"
				conversation={conversationA}
				{adapter}
				streaming={streamingA}
				onadaptererror={handleAdapterError}
			/>
		</div>
		<ul
			data-testid="adapter-log"
			style="flex: 1; min-width: 0; overflow-y: auto; margin: 0; padding: 0.5rem; font-size: 0.75rem; list-style: none;"
		>
			{#each logA as entry, index (index)}
				<li>{entry}</li>
			{/each}
		</ul>
	</div>
</section>
