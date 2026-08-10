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
  prependMessages,
} from 'conversationalist';

const DELIVERY_STATUS_METADATA_KEY = '_deliveryStatus';

/** Mark a message as failed so Chat renders its retry affordance. */
export function markMessageDeliveryFailed(
  history: ConversationHistory,
  messageId: string,
): ConversationHistory {
  const message = history.messages[messageId];
  if (!message || message.metadata?.['_deliveryStatus'] === 'failed') return history;

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
