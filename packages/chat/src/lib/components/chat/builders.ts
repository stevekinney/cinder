/**
 * Conversation builders re-exported from Chat's pinned Conversationalist
 * dependency. Keeping these at the Chat boundary gives consumers one stable
 * import surface while Chat and Conversationalist share the same transcript
 * types and runtime implementation.
 */

export {
  appendAssistantMessage,
  appendMessages,
  appendUserMessage,
  buildMessage,
  createConversationHistory,
  prependMessages,
} from 'conversationalist';

/**
 * @deprecated Use {@link createConversationHistory}. This alias is retained
 * as the explicit migration path for consumers upgrading to Conversationalist 0.5.
 */
export { createConversationHistory as createConversation } from 'conversationalist';
