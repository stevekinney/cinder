import {
	appendAssistantMessage,
	appendStreamingMessage,
	appendUserMessage,
	cancelStreamingMessage,
	createConversationHistory,
	finalizeStreamingMessage,
	markMessageDeliveryFailed,
	updateStreamingMessage,
	type ConversationHistory,
	type Message
} from '@lostgradient/chat';

// Deterministic stand-in for a token stream — no network call, no timers
// beyond a short fixed delay so a Playwright test can reliably interrupt it
// mid-stream with the stop-generating button.
export const STREAM_TOKENS = [
	'Streaming ',
	'a ',
	'deterministic ',
	'reply ',
	'token ',
	'by ',
	'token.'
];
export const STREAM_DELAY_MS = 120;

/** The marker `streamReply` appends when a simulated post-stop token attempt is (wrongly) applied. */
export const LATE_TOKEN_MARKER = 'LATE TOKEN AFTER STOP';

export function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

// Seeds a conversation with one user message and one FAILED assistant
// message — `markMessageDeliveryFailed` stamps the delivery-status metadata
// `ChatMessage` reads to show the "Failed to send" banner + retry button.
export function seedConversation(id: string): ConversationHistory {
	let conversation = createConversationHistory({ id });
	conversation = appendUserMessage(conversation, 'What is the capital of deterministic testing?');
	conversation = appendAssistantMessage(conversation, 'This reply failed to send.');
	const failedId = conversation.ids[conversation.ids.length - 1];
	if (!failedId) throw new Error('Expected a seeded message id.');
	return markMessageDeliveryFailed(conversation, failedId);
}

export function replaceMessage(
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

export type StreamCallbacks = {
	getSnapshot: () => ConversationHistory;
	setConversation: (next: ConversationHistory) => void;
	setStreaming: (value: boolean) => void;
	shouldStop: () => boolean;
	log: (entry: string) => void;
};

// Shared by both Chat instances: appends a streaming assistant placeholder,
// then reveals `STREAM_TOKENS` one at a time. `shouldStop` is polled between
// tokens so `stopGenerating`/`onstopgenerating` can halt the stream early —
// the assertion a real backend abort would need to satisfy.
//
// After an early stop it simulates the race a real transport has: a token
// arriving just after the stream already finalized or cancelled. The late token
// is applied UNGUARDED on purpose. Since conversationalist 0.6,
// `updateStreamingMessage` enforces the guard at the library boundary — it
// returns the conversation untouched when the target is no longer flagged as
// streaming, exactly as it already did for an unknown id — so this exercise
// asserts that guarantee rather than re-implementing it in every consumer.
// (`updateUnsafeStreamingMessage` is the documented escape hatch for
// render-side projections that deliberately write to a finalized message.)
export async function streamReply(callbacks: StreamCallbacks): Promise<void> {
	const { conversation: withPlaceholder, messageId } = appendStreamingMessage(
		callbacks.getSnapshot(),
		'assistant'
	);
	callbacks.setConversation(withPlaceholder);
	callbacks.setStreaming(true);

	let buffer = '';
	let stoppedEarly = false;

	try {
		for (const token of STREAM_TOKENS) {
			if (callbacks.shouldStop()) {
				stoppedEarly = true;
				break;
			}
			await sleep(STREAM_DELAY_MS);
			if (callbacks.shouldStop()) {
				stoppedEarly = true;
				break;
			}

			buffer += token;
			callbacks.setConversation(updateStreamingMessage(callbacks.getSnapshot(), messageId, buffer));
		}

		callbacks.setConversation(
			buffer
				? finalizeStreamingMessage(callbacks.getSnapshot(), messageId)
				: cancelStreamingMessage(callbacks.getSnapshot(), messageId)
		);

		if (stoppedEarly) {
			await sleep(STREAM_DELAY_MS);

			const afterLateToken = updateStreamingMessage(
				callbacks.getSnapshot(),
				messageId,
				`${buffer}${LATE_TOKEN_MARKER}`
			);
			callbacks.setConversation(afterLateToken);

			// Read the transcript back rather than trusting the call's return
			// identity: the point of the log entry is what a reader would SEE.
			const content = afterLateToken.messages[messageId]?.content;
			const applied = typeof content === 'string' && content.includes(LATE_TOKEN_MARKER);
			callbacks.log(applied ? 'post-stop-token:applied' : 'post-stop-token:blocked');
		}
	} finally {
		callbacks.setStreaming(false);
	}
}
