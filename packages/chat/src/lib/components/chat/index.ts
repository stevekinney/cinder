/**
 * Chat feature components.
 *
 * Re-exports from all chat subdirectories for convenient access.
 *
 * @module
 */

// Top-level Chat wrapper — the public component consumers import as
// `@lostgradient/chat`. It composes the inner implementation in container/ with a
// custom class-merge layer.
import { CURRENT_SCHEMA_VERSION } from 'conversationalist/versioning';
import './chat.css';
import Chat from './chat.svelte';

export default Chat;
export type {
  ChatAnnounceLevel,
  ChatCapabilities,
  ChatProps,
  ReadReceipt,
  TypingParticipant,
} from './chat.types.ts';
export { Chat, CURRENT_SCHEMA_VERSION };

// Adapter seam — the optional event/transport boundary around <Chat>. Type-only.
export type {
  ChatAdapter,
  ChatAdapterErrorEvent,
  ChatCommand,
  ChatPushHandlers,
  ChatReadReceiptEvent,
} from './adapter/index.ts';

// Conversation builders — an ergonomic, immutable way to construct the
// ConversationHistory Chat renders, for apps without their own conversation state.
export {
  appendAssistantMessage,
  appendMessages,
  appendUserMessage,
  createConversation,
} from './builders.ts';

// Streaming conversation builders — keep the immutable snapshot and Chat's
// imperative streaming surface in sync through the package's own
// `conversationalist` dependency.
export {
  appendStreamingMessage,
  cancelStreamingMessage,
  finalizeStreamingMessage,
  updateStreamingMessage,
} from 'conversationalist/streaming';

// Conversationalist runtime helper — validates that values a consumer builds
// by hand (message content, metadata, tool call arguments) are JSON-compatible
// before handing them to the builders above.
export { isJSONValue } from 'conversationalist';

// Conversation data model — published Conversationalist shapes Chat renders.
// Public so consumers can type the `conversation` prop and construct messages
// without this package maintaining a stale local mirror.
export type {
  AssistantMessage,
  ContainerUploadContent,
  Conversation,
  ConversationActionType,
  ConversationEnvironment,
  ConversationEvent,
  ConversationEventMap,
  ConversationEventType,
  ConversationHistory,
  ConversationHistoryDraft,
  ConversationNodeSnapshot,
  ConversationSnapshot,
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
  TokenUsage,
  ToMarkdownOptions,
  ToolAction,
  ToolCall,
  ToolCallInput,
  ToolCallPair,
  ToolError,
  ToolErrorCategory,
  ToolInteraction,
  ToolResult,
  ToolResultInput,
  WebSearchToolResultContent,
} from './conversation-model.ts';

// Utilities
export {
  formatMessageAsMarkdown,
  getMessageRoleLabel,
  getMessageText,
  messagesToMarkdown,
  pairToolCallsWithResults,
  type ChatExportOptions,
  type DeliveryStatus,
} from './utilities/index.ts';
export type { StepInfo } from './utilities/types.ts';

// Input
export {
  ChatAttachmentPreview,
  ChatInput,
  deriveAttachmentKind,
  serializeChatAttachment,
  serializeChatAttachments,
} from './input/index.ts';
export type { AttachmentKind, ChatAttachment, SerializedChatAttachment } from './input/index.ts';

// Message
export {
  ChatDateSeparator,
  ChatMessage,
  MessageAttachments,
  MessageContent,
  ToolCallGroup,
} from './message/index.ts';

// Container — internal implementation utilities. The inner `Chat`
// implementation is intentionally NOT re-exported here; consumers should use
// the wrapper above. (The wrapper provides the documented public API and
// class-merge behavior the inner implementation lacks.)
// `formatUnreadCount` and `isLargeCount` are intentionally NOT re-exported:
// they encode this component's badge presentation policy (e.g. capping at
// "99+"), not reusable behavior a consumer building a custom chat container
// would depend on. They remain available internally from ./container.
export {
  calculateScrollToBottom,
  calculateUnreadCount,
  DEFAULT_SCROLL_CONFIGURATION,
  extractTimestamp,
  findUnreadBoundaryIndex,
  isAtBottom,
  shouldShowJumpToLatest,
} from './container/index.ts';
export type {
  ChatScrollStateChangeEvent,
  ChatStopGeneratingEvent,
  ChatSubmitEvent,
  ChatUnreadIndicatorChangeEvent,
  ScrollConfiguration,
  ScrollState,
} from './container/index.ts';

// Export
export { ConversationExportActions } from './export/index.ts';

// Artifact
export { ArtifactPanel, ArtifactViewer, ChatArtifactLayout } from './artifact/index.ts';
