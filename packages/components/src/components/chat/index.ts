/**
 * Chat feature components.
 *
 * Re-exports from all chat subdirectories for convenient access.
 *
 * @module
 */

// Top-level Chat wrapper — the public component consumers import as
// `@lostgradient/cinder/chat`. It composes the inner implementation in container/ with a
// custom class-merge layer.
import Chat from './chat.svelte';

export default Chat;
export type { ChatCapabilities, ChatProps, ReadReceipt, TypingParticipant } from './chat.types.ts';
export { Chat };

// Adapter seam — the optional event/transport boundary around <Chat>. Type-only.
export type {
  ChatAdapter,
  ChatAdapterErrorEvent,
  ChatCommand,
  ChatPushHandlers,
  ChatReadReceiptEvent,
} from './adapter';

// Conversation builders — an ergonomic, immutable way to construct the
// ConversationHistory Chat renders, for apps without their own conversation state.
export {
  appendAssistantMessage,
  appendMessages,
  appendUserMessage,
  createConversation,
} from './builders.ts';

// Conversation data model — published Conversationalist shapes Chat renders.
// Public so consumers can type the `conversation` prop and construct messages
// without Cinder maintaining a stale local mirror.
export type {
  AssistantMessage,
  ContainerUploadContent,
  ConversationHistory,
  ConversationStatus,
  ExportOptions,
  ImageContent,
  // JSONValue types the public `ToolCall.arguments` / `metadata` / `content`
  // fields, so consumers constructing those need it. (JSONPrimitive is an
  // internal building block and is intentionally not re-exported.)
  JSONValue,
  Message,
  MessageInput,
  MessageRole,
  MultiModalContent,
  RedactedThinkingContent,
  ServerToolResultContent,
  ServerToolResultType,
  ServerToolUseContent,
  TextContent,
  ThinkingContent,
  ToMarkdownOptions,
  TokenUsage,
  ToolAction,
  ToolCall,
  ToolCallPair,
  ToolError,
  ToolErrorCategory,
  ToolResult,
  WebSearchToolResultContent,
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
// `formatUnreadCount` and `isLargeCount` are intentionally NOT re-exported:
// they encode this component's badge presentation policy (e.g. capping at
// "99+"), not reusable behavior a consumer building a custom chat container
// would depend on. They remain available internally from ./container.
export {
  DEFAULT_SCROLL_CONFIGURATION,
  calculateScrollToBottom,
  calculateUnreadCount,
  extractTimestamp,
  findUnreadBoundaryIndex,
  isAtBottom,
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

// Export
export { ConversationExportActions } from './export';

// Artifact
export { ArtifactPanel, ArtifactViewer, ChatArtifactLayout } from './artifact';
