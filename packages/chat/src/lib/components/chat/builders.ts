import type { ConversationHistory } from './conversation-model.ts';

/**
 * Conversation builders re-exported from Chat's direct Conversationalist
 * dependency. Keeping these at the Chat boundary gives consumers one stable
 * import surface while Chat and Conversationalist share the same transcript
 * types and runtime implementation.
 */

export {
  appendAssistantMessage,
  appendMessages,
  appendToolCall,
  appendToolCalls,
  appendToolResult,
  appendToolResultAsync,
  appendToolResults,
  appendToolResultsAsync,
  appendUserMessage,
  buildMessage,
  createConversationHistory,
  isJSONValue,
  isToolResult,
  prependMessages,
} from 'conversationalist';

// Branch-rewind builders — the operation Chat's own `editMessage` adapter
// command asks consumers to perform ("rewind to just before the edited
// message, discard the superseded branch, re-send"). `rewindBeforeMessage` is
// the form edit flows usually want, since the adapter hands them a message id.
export { rewindBeforeMessage, rewindBeforePosition } from 'conversationalist/context';
export type { RewindOptions } from 'conversationalist/context';

// Transcript mutation helpers—canonical in-place edits (update, remove,
// hide/show, replace a tool result) that keep message identity, role, order,
// and creation time intact. Every helper is a no-op (returns the original
// history unchanged) when given an unknown message or tool-call identifier.
export {
  removeMessage,
  replaceToolResult,
  setMessageHidden,
  updateMessage,
} from 'conversationalist';
export type { MessageUpdate } from 'conversationalist';

const DELIVERY_STATUS_METADATA_KEY = '_deliveryStatus';

/** Mark a message as failed so Chat renders its retry affordance. */
export function markMessageDeliveryFailed(
  history: ConversationHistory,
  messageId: string,
): ConversationHistory {
  const message = history.messages[messageId];
  if (!message || message.metadata?.[DELIVERY_STATUS_METADATA_KEY] === 'failed') return history;

  return {
    ...history,
    messages: {
      ...history.messages,
      [messageId]: {
        ...message,
        metadata: { ...message.metadata, [DELIVERY_STATUS_METADATA_KEY]: 'failed' },
      },
    },
    updatedAt: new Date().toISOString(),
  };
}

/** Clear a message's failed-delivery marker after a successful retry. */
export function clearMessageDeliveryStatus(
  history: ConversationHistory,
  messageId: string,
): ConversationHistory {
  const message = history.messages[messageId];
  if (!message || !message.metadata || !(DELIVERY_STATUS_METADATA_KEY in message.metadata)) {
    return history;
  }

  const metadata = { ...message.metadata };
  delete metadata[DELIVERY_STATUS_METADATA_KEY];
  return {
    ...history,
    messages: { ...history.messages, [messageId]: { ...message, metadata } },
    updatedAt: new Date().toISOString(),
  };
}

/**
 * @deprecated Use {@link createConversationHistory}. This alias is retained
 * as the explicit migration path for consumers upgrading to Conversationalist 0.5.
 */
export { createConversationHistory as createConversation } from 'conversationalist';
