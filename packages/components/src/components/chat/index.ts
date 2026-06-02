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
