/**
 * Chat data model helpers.
 *
 * Conversation-reading helpers ({@link getMessages}, {@link pairToolCallsWithResults})
 * and content/markdown utilities, all built on the vendored conversation model.
 */

export { getMessages, pairToolCallsWithResults } from './conversation';
export {
  type ChatExportOptions,
  type ChatMessagePart,
  type DeliveryStatus,
  type ImageMessagePart,
  type MarkdownMessagePart,
  type MessagePartDerivationContext,
  type ToolCallMessagePart,
  type ToolResultMessagePart,
} from './types';
export {
  deriveMessageParts,
  formatMessageAsMarkdown,
  getMessageParts,
  getMessageRoleLabel,
  getMessageText,
  messagesToMarkdown,
  toMultiModalArray,
} from './utilities';
