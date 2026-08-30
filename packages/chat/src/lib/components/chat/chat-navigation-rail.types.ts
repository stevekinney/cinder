import type { Message } from './conversation-model.ts';

export type ChatNavigationRailProps = {
  messages: ReadonlyArray<Message>;
  viewport?: HTMLElement | null;
  /** Scroll a message index; callers should delegate to ChatVirtualizer when present. */
  onNavigate?: (index: number, message: Message) => void;
  /** Optional virtualizer bridge; implementations should use center alignment. */
  scrollToIndex?: (index: number) => void;
  label?: string;
  preview?: (message: Message) => string;
};
