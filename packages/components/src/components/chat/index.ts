/**
 * Chat feature components.
 *
 * Re-exports from all chat subdirectories for convenient access.
 *
 * @module
 */

// Top-level Chat wrapper — the public component consumers import as
// `cinder/chat`. It composes the inner implementation in container/ with a
// custom class-merge layer.
import Chat from './chat.svelte';

export default Chat;
export type { ChatProps } from './chat.types.ts';
export { Chat };

// Conversation builders — an ergonomic, immutable way to construct the
// ConversationHistory Chat renders, for apps without their own conversation state.
export {
  appendAssistantMessage,
  appendMessages,
  appendUserMessage,
  createConversation,
} from './builders.ts';

// Conversation data model — the vendored shapes Chat renders. Public so consumers
// can type the `conversation` prop and construct messages without depending on a
// conversation-state library. Structurally compatible with `conversationalist`.
export type {
  ConversationHistory,
  ConversationStatus,
  ImageContent,
  JSONPrimitive,
  JSONValue,
  Message,
  MessageInput,
  MessageRole,
  MultiModalContent,
  TextContent,
  TokenUsage,
  ToolAction,
  ToolCall,
  ToolCallPair,
  ToolError,
  ToolErrorCategory,
  ToolResult,
} from './conversation-model.ts';

// Utilities
export {
  formatMessageAsMarkdown,
  getMessageRoleLabel,
  getMessageText,
  messagesToMarkdown,
  type ChatExportOptions,
  type DeliveryStatus,
} from './utilities';

// Input
export { ChatAttachmentPreview, ChatInput, deriveAttachmentKind } from './input';
export type { AttachmentKind } from './input';

// Message
export {
  ChatDateSeparator,
  ChatMessage,
  MessageAttachments,
  MessageContent,
  ToolCallGroup,
} from './message';

// Container — internal implementation utilities. The inner `Chat`
// implementation is intentionally NOT re-exported here; consumers should use
// the wrapper above. (The wrapper provides the documented public API and
// class-merge behavior the inner implementation lacks.)
export {
  DEFAULT_SCROLL_CONFIGURATION,
  calculateScrollToBottom,
  calculateUnreadCount,
  extractTimestamp,
  findUnreadBoundaryIndex,
  formatUnreadCount,
  isAtBottom,
  isLargeCount,
  shouldShowJumpToLatest,
} from './container';
export type {
  ChatScrollStateChangeEvent,
  ChatStopGeneratingEvent,
  ChatSubmitEvent,
  ChatUnreadIndicatorChangeEvent,
  ScrollConfiguration,
  ScrollState,
} from './container';

// Scope
export { RepositoryScope } from './scope';

// Export
export { ConversationExportActions } from './export';

// Artifact
export { ArtifactPanel, ArtifactViewer, ChatArtifactLayout } from './artifact';
