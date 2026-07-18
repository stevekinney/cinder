/**
 * Conversation-reading helpers for Chat.
 *
 * These helpers operate on the Conversationalist transcript shape while keeping
 * Cinder's browser runtime free of the full conversation package.
 */

import type {
  ConversationHistory,
  Message,
  ToolCallPair,
  ToolResult,
} from '../conversation-model.ts';

export function getMessages(
  conversation: ConversationHistory,
  options: { includeHidden?: boolean } = {},
): Message[] {
  return conversation.ids
    .map((id) => conversation.messages[id])
    .filter((message): message is Message => message !== undefined)
    .filter((message) => options.includeHidden === true || !message.hidden);
}

/** Pairs tool calls with role-valid tool results from an already-ordered message array. */
export function pairToolCallsWithResults(messages: ReadonlyArray<Message>): ToolCallPair[] {
  const resultsByCallId = new Map<string, ToolResult>();
  for (const message of messages) {
    if (message.role === 'tool-result' && message.toolResult !== undefined) {
      resultsByCallId.set(message.toolResult.callId, message.toolResult);
    }
  }

  const pairs: ToolCallPair[] = [];
  for (const message of messages) {
    if (message.role === 'tool-call' && message.toolCall !== undefined) {
      pairs.push({
        call: message.toolCall,
        result: resultsByCallId.get(message.toolCall.id),
      });
    }
  }
  return pairs;
}
