/**
 * Chat feature components.
 *
 * Re-exports from all chat subdirectories for convenient access.
 *
 * @module
 */

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

// Container
export {
  Chat,
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
