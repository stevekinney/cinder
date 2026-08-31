/**
 * Chat data model helpers.
 *
 * Conversation-reading helpers ({@link getMessages}, {@link pairToolCallsWithResults},
 * {@link getUnresolvedToolApprovals}, {@link findToolResultMessage}) and
 * content/markdown utilities, all built on the Conversationalist model.
 */

export {
  findToolResultMessage,
  getMessages,
  getUnresolvedToolApprovals,
  pairToolCallsWithResults,
  type ToolResultMessage,
  type UnresolvedToolApproval,
} from './conversation.ts';
export {
  type ChatExportOptions,
  type ChatMessagePart,
  type DeliveryStatus,
  type ImageMessagePart,
  type MarkdownMessagePart,
  type MessagePartDerivationContext,
  type ReasoningInfo,
  type ToolCallKind,
  type ToolCallMessagePart,
  type ToolCallPresentation,
  type ToolCallTense,
  type ToolResultMessagePart,
  type TranscriptEntryInfo,
  type TranscriptEntryKind,
} from './types.ts';
export {
  CINDER_ARTIFACT_METADATA_KEY,
  CINDER_ENTRIES_METADATA_KEY,
  CINDER_REASONING_METADATA_KEY,
  CINDER_STEPS_METADATA_KEY,
  CINDER_SUGGESTIONS_METADATA_KEY,
  deriveMessageParts,
  formatMessageAsMarkdown,
  formatToolCallProse,
  getMessageParts,
  getMessageRoleLabel,
  getMessageText,
  messagesToMarkdown,
  resolveMessageArtifact,
  resolveMessageReasoning,
  resolveMessageSteps,
  resolveMessageSuggestions,
  resolveMessageTranscriptEntries,
  toMultiModalArray,
} from './utilities.ts';
