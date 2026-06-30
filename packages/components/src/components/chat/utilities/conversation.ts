/**
 * Conversation-reading helpers for Chat.
 *
 * These delegate to `conversationalist` so message ordering stays aligned with
 * the published conversation package. Tool pairing keeps Chat's role gate so an
 * incidental tool-shaped field on a non-tool message never renders as a pair.
 */

import { getMessages } from 'conversationalist';
import { pairToolCallsWithResults as pairConversationalistToolCallsWithResults } from 'conversationalist/utilities';

import type { Message, ToolCallPair } from '../conversation-model.ts';

function hasPairableToolField(message: Message): boolean {
  return (
    (message.role === 'tool-call' && message.toolCall !== undefined) ||
    (message.role === 'tool-result' && message.toolResult !== undefined)
  );
}

/** Pairs tool calls with role-valid tool results from an already-ordered message array. */
export function pairToolCallsWithResults(messages: ReadonlyArray<Message>): ToolCallPair[] {
  return pairConversationalistToolCallsWithResults(messages.filter(hasPairableToolField));
}

export { getMessages };
