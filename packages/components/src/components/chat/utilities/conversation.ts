/**
 * Cinder-owned conversation-reading helpers.
 *
 * These reimplement the small slice of conversation-reading behavior Chat needs
 * (message ordering and tool-call pairing) so Chat depends only on the vendored
 * {@link ConversationHistory}/{@link Message} shapes, not on a runtime library.
 * Behavior is transcribed from `conversationalist`'s `getOrderedMessages`/`getMessages`
 * and `pairToolCallsWithResults`; tests pin the contract so any divergence is visible.
 */

import type {
  ConversationHistory,
  Message,
  ToolCallPair,
  ToolResult,
} from '../conversation-model.ts';

/**
 * Returns a conversation's messages in canonical order.
 *
 * Walks `conversation.ids` in order, resolving each id from the `messages`
 * record. Ids with no matching record are skipped (no throw); records not
 * referenced by `ids` are excluded. Hidden messages are filtered out unless
 * `includeHidden` is true.
 *
 * @param conversation - The conversation snapshot to read
 * @param options - `includeHidden` keeps hidden messages in the result
 * @returns Ordered messages
 */
export function getMessages(
  conversation: ConversationHistory,
  options?: { includeHidden?: boolean },
): Message[] {
  const includeHidden = options?.includeHidden ?? false;
  const ordered: Message[] = [];
  for (const id of conversation.ids) {
    const message = conversation.messages[id];
    if (message && (includeHidden || !message.hidden)) {
      ordered.push(message);
    }
  }
  return ordered;
}

/**
 * Pairs tool calls with their results from an already-ordered message array.
 *
 * Consumes an ordered array only — pass {@link getMessages} output — so pairing
 * can never disagree with render ordering or surface a stale message that
 * `getMessages` would have excluded. Two passes: collect results by their
 * `callId`, then emit one pair per message bearing a `toolCall`, attaching the
 * matching result if one exists. When two results share a `callId`, the later
 * one wins (last write to the map).
 *
 * @param messages - Messages in canonical order
 * @returns One pair per tool call, in call order
 */
export function pairToolCallsWithResults(messages: ReadonlyArray<Message>): ToolCallPair[] {
  const resultsByCallId = new Map<string, ToolResult>();
  for (const message of messages) {
    // Role-gate (not just `toolResult` presence) so a non-tool message carrying
    // an incidental tool-shaped field never contributes a phantom result.
    if (message.role === 'tool-result' && message.toolResult) {
      resultsByCallId.set(message.toolResult.callId, message.toolResult);
    }
  }

  const pairs: ToolCallPair[] = [];
  for (const message of messages) {
    if (message.role === 'tool-call' && message.toolCall) {
      pairs.push({ call: message.toolCall, result: resultsByCallId.get(message.toolCall.id) });
    }
  }
  return pairs;
}
