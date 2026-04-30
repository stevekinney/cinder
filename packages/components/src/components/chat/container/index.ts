export type {
  ChatScrollStateChangeEvent,
  ChatStopGeneratingEvent,
  ChatSubmitEvent,
  ChatUnreadIndicatorChangeEvent,
} from './chat-events.ts';
export { default as Chat } from './chat.svelte';

// Scroll utilities
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
} from './scroll-utilities';
export type { ScrollConfiguration, ScrollState } from './scroll-utilities';

// Runes helpers
export {
  useChatScrollState,
  type UseChatScrollStateOptions,
  type UseChatScrollStateReturn,
} from './use-chat-scroll-state.svelte';

export {
  useChatUnreadState,
  type UseChatUnreadStateOptions,
  type UseChatUnreadStateReturn,
} from './use-chat-unread-state.svelte';

export {
  useChatKeyboardNav,
  type UseChatKeyboardNavOptions,
  type UseChatKeyboardNavReturn,
} from './use-chat-keyboard-nav.svelte';

export {
  useChatMessageGroups,
  type DateItem,
  type MessageItem,
  type MessageWithDateItem,
  type ToolCallPair,
  type UseChatMessageGroupsOptions,
  type UseChatMessageGroupsReturn,
} from './use-chat-message-groups.svelte';

// Subcomponents
export { default as ChatJumpControls } from './chat-jump-controls.svelte';

export { default as ChatStatusAnnouncer } from './chat-status-announcer.svelte';

export { default as ChatSearchBar } from './chat-search-bar.svelte';

export {
  useChatSearch,
  type ChatSearchMatch,
  type UseChatSearchOptions,
  type UseChatSearchReturn,
} from './use-chat-search.svelte';
