<script lang="ts">
	import {
		appendMessages,
		appendStreamingMessage,
		Chat,
		createConversationHistory,
		finalizeStreamingMessage,
		updateStreamingMessage,
		type ChatAdapter,
		type ChatAdapterErrorEvent,
		type ChatPushHandlers,
		type ChatReadReceiptEvent,
		type ConversationHistory,
		type Message,
		type ReadReceipt,
		type TypingParticipant
	} from '@lostgradient/chat';
	import { SvelteMap } from 'svelte/reactivity';
	import SubscribeInEffectHazardFixture from './subscribe-in-effect-hazard-fixture.svelte';
	import SubscriptionLifecycleFixture from './subscription-lifecycle-fixture.svelte';

	/**
	 * Everything below is driven ENTIRELY through `ChatAdapter.subscribe`'s push
	 * handlers — `onStreamBegin`/`onTokenPush`/`onStreamEnd` for the streamed
	 * reply, `onMessage` for an out-of-band pushed message, `onTypingChange` for
	 * the typing indicator, and `onReadReceipt` for read-receipt badges. There is
	 * no `bind:this` on `<Chat>` and no imperative `beginStreaming`/`pushToken`/
	 * `endStreaming` call anywhere in this file: those live inside Chat itself,
	 * wired to the handlers it hands `subscribe`. That is the point of this
	 * exercise — a push-driven stream is fully self-contained.
	 */

	const ASSISTANT_REPLY =
		"This entire reply streamed through the adapter's onStreamBegin, onTokenPush, and onStreamEnd push handlers — no bind:this, no direct Chat method calls.";
	const PUSHED_MESSAGE_TEXT =
		'A teammate just joined and pushed this message in from another client.';
	const DIRECT_TYPING_PARTICIPANT: TypingParticipant = { id: 'direct-demo', name: 'Priya' };
	const DIRECT_READ_RECEIPT_READER = 'Priya';
	const TOKEN_DELAY_MS = 15;

	let conversation = $state<ConversationHistory>(
		createConversationHistory({ id: 'adapter-push-demo' })
	);
	let streaming = $state(false);
	let error = $state<string | null>(null);
	let eventLog = $state<string[]>([]);

	/**
	 * Toggling these swaps `typingParticipants`/`readReceipts` between `undefined`
	 * (letting the adapter's push events drive Chat's built-in indicator/badges)
	 * and a directly-supplied value. Chat treats a DEFINED prop as authoritative
	 * over the adapter path, so the two mechanisms are exercised one at a time.
	 */
	let directTypingEnabled = $state(false);
	let directReadReceiptEnabled = $state(false);
	let directReadReceipts = new SvelteMap<string, ReadReceipt>();

	const directTypingParticipants = $derived<TypingParticipant[] | undefined>(
		directTypingEnabled ? [DIRECT_TYPING_PARTICIPANT] : undefined
	);
	const readReceiptsProp = $derived<Map<string, ReadReceipt> | undefined>(
		directReadReceiptEnabled ? directReadReceipts : undefined
	);

	// Plain `let`: the push handlers Chat hands to `subscribe` on mount, used only
	// from button click handlers below — never read reactively.
	let pushHandlers: ChatPushHandlers | undefined;

	function snapshot(): ConversationHistory {
		return $state.snapshot(conversation);
	}

	// Deferred via `queueMicrotask` rather than a synchronous `$state` write:
	// Chat calls `adapter.subscribe()` synchronously from inside its own
	// `$effect` (on mount and whenever the adapter/conversation id changes).
	// `subscribe` here calls `log()` immediately, and a synchronous write to
	// `eventLog` at that point re-enters Svelte's effect flush while Chat's
	// own effect is still running, which throws `effect_update_depth_exceeded`
	// (reproduced: typing into the composer alone was enough to trigger it,
	// since Chat's other effects were still settling from the same flush).
	// `ChatAdapter.subscribe`'s own docs call out exactly this and recommend
	// the same `queueMicrotask` deferral used here.
	function log(entry: string): void {
		queueMicrotask(() => {
			eventLog = [...eventLog, entry];
		});
	}

	function delay(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	function tokenize(text: string): string[] {
		return text.match(/\S+\s*/g) ?? [text];
	}

	function findLastUserMessageId(): string | undefined {
		for (let index = conversation.ids.length - 1; index >= 0; index -= 1) {
			const id = conversation.ids[index];
			if (conversation.messages[id]?.role === 'user') return id;
		}
		return undefined;
	}

	/** Drives a full streamed assistant reply purely through the push handlers. */
	async function driveScriptedReply(): Promise<void> {
		if (!pushHandlers) {
			error = 'No adapter subscription is active yet.';
			return;
		}

		const { conversation: withPlaceholder, messageId } = appendStreamingMessage(
			snapshot(),
			'assistant'
		);
		conversation = withPlaceholder;
		pushHandlers.onStreamBegin(messageId);

		let buffer = '';
		for (const token of tokenize(ASSISTANT_REPLY)) {
			await delay(TOKEN_DELAY_MS);
			buffer += token;
			conversation = updateStreamingMessage(snapshot(), messageId, buffer);
			pushHandlers.onTokenPush(token);
		}

		conversation = finalizeStreamingMessage(snapshot(), messageId);
		pushHandlers.onStreamEnd();
	}

	const adapter: ChatAdapter = {
		sendMessage: async (message) => {
			error = null;
			conversation = appendMessages(conversation, message);
			streaming = true;
			try {
				await driveScriptedReply();
			} finally {
				streaming = false;
			}
		},
		subscribe: (conversationId, handlers) => {
			pushHandlers = handlers;
			log(`subscribed to "${conversationId}"`);
			return () => {
				pushHandlers = undefined;
				log('unsubscribed');
			};
		}
	};

	function handleAdapterError(event: ChatAdapterErrorEvent): void {
		error = event.error instanceof Error ? event.error.message : 'Something went wrong.';
	}

	/** Forwarded from the adapter's `onMessage` push. Chat never mutates `conversation` itself. */
	function handlePushMessage(message: Message): void {
		conversation = appendMessages(conversation, {
			role: message.role,
			content: typeof message.content === 'string' ? message.content : [...message.content],
			metadata: message.metadata,
			hidden: message.hidden
		});
		log(`onpushmessage received a "${message.role}" message`);
	}

	function handleTypingChange(isTyping: boolean): void {
		log(`ontypingchange: ${isTyping}`);
	}

	function handleReadReceipt(event: ChatReadReceiptEvent): void {
		log(`onreadreceipt: message ${event.messageId} read at ${event.readAt}`);
	}

	/** Pushes an out-of-band message via `onMessage`, exercising the onpushmessage forwarding path. */
	function pushIncomingMessage(): void {
		if (!pushHandlers) return;

		const message: Message = {
			id: crypto.randomUUID(),
			role: 'assistant',
			content: PUSHED_MESSAGE_TEXT,
			position: conversation.ids.length,
			createdAt: new Date().toISOString(),
			metadata: {},
			hidden: false
		};
		pushHandlers.onMessage(message);
	}

	function pushTypingStart(): void {
		pushHandlers?.onTypingChange(true);
	}

	function pushTypingStop(): void {
		pushHandlers?.onTypingChange(false);
	}

	function pushReadReceipt(): void {
		const messageId = findLastUserMessageId();
		if (!pushHandlers || !messageId) return;
		pushHandlers.onReadReceipt({
			messageId,
			readAt: new Date().toISOString(),
			readBy: [DIRECT_READ_RECEIPT_READER]
		});
	}

	function toggleDirectTyping(): void {
		directTypingEnabled = !directTypingEnabled;
	}

	function toggleDirectReadReceipt(): void {
		const messageId = findLastUserMessageId();
		if (!messageId) return;

		directReadReceiptEnabled = !directReadReceiptEnabled;
		if (directReadReceiptEnabled) {
			directReadReceipts.set(messageId, { status: 'read', readBy: [DIRECT_READ_RECEIPT_READER] });
		}
	}

	/**
	 * A second, distinctly-named `onReadReceipt` push, used to prove the
	 * ownership-transition contract: adapter pushes accumulate into Chat's
	 * internal read-receipt state EVEN while a defined `readReceipts` prop is
	 * suppressing their display, and flipping the prop back to `undefined`
	 * reveals that accumulated state immediately — with no further push.
	 */
	const SECONDARY_READ_RECEIPT_READER = 'Jordan';

	function pushSecondaryReadReceipt(): void {
		const messageId = findLastUserMessageId();
		if (!pushHandlers || !messageId) return;
		pushHandlers.onReadReceipt({
			messageId,
			readAt: new Date().toISOString(),
			readBy: [SECONDARY_READ_RECEIPT_READER]
		});
	}

	// ==========================================================================
	// Out-of-order stream pushes
	// ==========================================================================
	// These call the MAIN adapter's push handlers directly, deliberately out of
	// the documented onStreamBegin -> onTokenPush* -> onStreamEnd order. None of
	// them ever add a message to `conversation`, so if Chat handles the
	// malformed sequence gracefully there is no row for a "ghost" streaming
	// bubble to attach to — any unexpected DOM addition here would indicate
	// state corruption, not a scripted demo message.

	const OUT_OF_ORDER_MESSAGE_ID = 'adapter-push-ooo-fixture';

	function pushTokenBeforeBegin(): void {
		pushHandlers?.onTokenPush('orphan-token ');
		log('onTokenPush fired before onStreamBegin (no active stream)');
	}

	function pushDoubleStreamBegin(): void {
		if (!pushHandlers) return;
		pushHandlers.onStreamBegin(OUT_OF_ORDER_MESSAGE_ID);
		pushHandlers.onStreamBegin(OUT_OF_ORDER_MESSAGE_ID);
		log('onStreamBegin fired twice in a row');
		pushHandlers.onStreamEnd();
	}

	function pushStreamEndTwice(): void {
		pushHandlers?.onStreamEnd();
		pushHandlers?.onStreamEnd();
		log('onStreamEnd fired twice in a row');
	}

	function pushStreamEndWithoutBegin(): void {
		pushHandlers?.onStreamEnd();
		log('onStreamEnd fired with no prior onStreamBegin');
	}
</script>

<div style="height: 100dvh; display: flex; flex-direction: column;">
	<!-- Always rendered, never `{#if}`-gated. A live region has to exist in the
	     DOM before the content arrives: mounting one that already has text is not
	     reliably announced, which is the pattern Chat's own
	     `chat-status-announcer.svelte` documents and follows. Padding is applied
	     only when populated so an empty region takes no layout. -->
	<p
		role="alert"
		data-testid="adapter-push-error"
		style="margin: 0; color: var(--cinder-danger);"
		style:padding={error ? '0.5rem 1rem' : '0'}
	>
		{error ?? ''}
	</p>
	<div style="flex: 1; min-height: 0;">
		<Chat
			id="adapter-push-chat"
			{conversation}
			{adapter}
			{streaming}
			typingParticipants={directTypingParticipants}
			readReceipts={readReceiptsProp}
			onadaptererror={handleAdapterError}
			onpushmessage={handlePushMessage}
			ontypingchange={handleTypingChange}
			onreadreceipt={handleReadReceipt}
		/>
	</div>
	<div
		style="padding: 0.75rem 1rem; border-top: 1px solid var(--cinder-border); display: flex; flex-direction: column; gap: 0.5rem;"
	>
		<div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
			<button type="button" data-testid="push-message" onclick={pushIncomingMessage}>
				Push incoming message
			</button>
			<button type="button" data-testid="push-typing-start" onclick={pushTypingStart}>
				Start typing push
			</button>
			<button type="button" data-testid="push-typing-stop" onclick={pushTypingStop}>
				Stop typing push
			</button>
			<button type="button" data-testid="push-read-receipt" onclick={pushReadReceipt}>
				Push read receipt
			</button>
			<button type="button" data-testid="toggle-direct-typing" onclick={toggleDirectTyping}>
				{directTypingEnabled ? 'Disable' : 'Enable'} direct typingParticipants prop
			</button>
			<button
				type="button"
				data-testid="toggle-direct-read-receipt"
				onclick={toggleDirectReadReceipt}
			>
				{directReadReceiptEnabled ? 'Disable' : 'Enable'} direct readReceipts prop
			</button>
			<button
				type="button"
				data-testid="push-read-receipt-secondary"
				onclick={pushSecondaryReadReceipt}
			>
				Push read receipt (Jordan)
			</button>
		</div>
		<ul data-testid="event-log" style="margin: 0; padding-left: 1.25rem; font-size: 0.75rem;">
			{#each eventLog as entry, index (index)}
				<li>{entry}</li>
			{/each}
		</ul>
	</div>

	<div
		style="padding: 0.75rem 1rem; border-top: 1px solid var(--cinder-border); display: flex; flex-wrap: wrap; gap: 0.5rem;"
	>
		<button type="button" data-testid="push-token-before-begin" onclick={pushTokenBeforeBegin}>
			onTokenPush before onStreamBegin
		</button>
		<button type="button" data-testid="push-double-stream-begin" onclick={pushDoubleStreamBegin}>
			Double onStreamBegin
		</button>
		<button type="button" data-testid="push-stream-end-twice" onclick={pushStreamEndTwice}>
			onStreamEnd twice
		</button>
		<button
			type="button"
			data-testid="push-stream-end-without-begin"
			onclick={pushStreamEndWithoutBegin}
		>
			onStreamEnd without onStreamBegin
		</button>
	</div>

	<SubscriptionLifecycleFixture />

	<SubscribeInEffectHazardFixture />
</div>
