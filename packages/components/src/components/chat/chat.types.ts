import type { Snippet } from 'svelte';
import type { Attachment } from 'svelte/attachments';
import type { HTMLAttributes } from 'svelte/elements';

import type {
  ChatScrollStateChangeEvent,
  ChatStopGeneratingEvent,
  ChatSubmitEvent,
  ChatUnreadIndicatorChangeEvent,
} from './container/chat-events.ts';
import type { ConversationHistory, Message } from './conversation-model.ts';
import type { ChatAttachment } from './input/chat-attachment.ts';

/** Props for the Chat component. */
// `onsubmit` is redefined below with a ChatSubmitEvent payload, so strip the
// native DOM SubmitEvent handler from the base attributes to avoid an
// intersection that no handler can satisfy.
export type ChatProps = Omit<HTMLAttributes<HTMLElement>, 'class' | 'onsubmit'> & {
  /** Unique identifier used to scope accessibility attributes across the chat surface. */
  id: string;
  /**
   * The conversation transcript to render. Pass a {@link ConversationHistory}
   * snapshot; consumers holding a stateful conversation object pass its current
   * snapshot (e.g. `conversation.current`).
   */
  conversation: ConversationHistory;
  /** Whether the message viewport is scrolled to the bottom. Bindable; updated automatically as the user scrolls. Default `true`. */
  isAtBottom?: boolean;
  /** Number of messages received while the viewport was scrolled away from the bottom. Bindable; resets to `0` when the user scrolls to the bottom. Default `0`. */
  unreadCount?: number;
  /** Whether the "new messages" indicator is currently visible above the composer. Bindable; cleared automatically when the viewport reaches the bottom. Default `false`. */
  hasNewMessageIndicator?: boolean;
  /** Additional class name merged onto the `.chat-container` root element. */
  class?: string;
  /** Controls the background of the chat surface. Use `'transparent'` to inherit the host element's background when embedding chat inside a card or panel. Default `'default'`. */
  surfaceMode?: 'default' | 'transparent';
  /** Distance in pixels from the bottom of the scroll viewport within which the chat is considered "at bottom" and will auto-scroll on new messages. Default `150`. */
  bottomThreshold?: number;
  /** Distance in pixels scrolled up from the bottom required before the jump-to-latest button appears. Must be greater than `bottomThreshold` to prevent button flickering. Default `200`. */
  jumpThreshold?: number;
  /** Whether a streaming response is currently in progress. When `true`, the composer is disabled and a stop-generating button is shown. Default `false`. */
  isStreaming?: boolean;
  /** Optional status label displayed in the typing indicator while `isStreaming` is `true` and no streaming content has arrived yet (e.g. `"Thinking…"` or `"Analyzing file…"`). When omitted, three animated dots are shown. */
  streamingStatus?: string;
  /** Whether file attachments are enabled in the composer. When `false`, the attachment button is hidden and drag-and-drop onto the chat surface is suppressed. Default `true`. */
  allowAttachments?: boolean;
  /** Whether in-conversation search is enabled. When `true`, pressing Ctrl+F / Cmd+F opens a search bar that highlights matching messages. Default `true`. */
  allowSearch?: boolean;
  /** Whether per-message copy buttons are shown in the message action bar. Default `true`. */
  allowCopy?: boolean;
  /** Whether user messages can be edited inline. Default `true`. */
  allowEditing?: boolean;
  /** Whether failed assistant messages show a retry button. Default `true`. */
  allowRetry?: boolean;
  header?: Snippet;
  empty?: Snippet;
  /** List of suggested starter prompt strings shown as clickable buttons in the default empty state. Clicking a prompt submits it immediately as a user message. Has no effect when a custom `empty` snippet is provided. */
  emptyPrompts?: string[];
  messageActions?: Snippet<[Message]>;
  messageStatus?: Snippet<[Message]>;
  viewportAttachment?: Attachment<HTMLElement>;
  onsubmit?: (event: ChatSubmitEvent) => void;
  onretry?: (messageId: string) => void;
  onedit?: (event: { messageId: string; content: string }) => void;
  onstopgenerating?: (event: ChatStopGeneratingEvent) => void;
  onjumptolatest?: () => void;
  onscrollstatechange?: (event: ChatScrollStateChangeEvent) => void;
  onunreadindicatorchange?: (event: ChatUnreadIndicatorChangeEvent) => void;
  onexpandedchange?: (expanded: boolean) => void;
  onattachmentadd?: (attachment: ChatAttachment) => void;
  onattachmentremove?: (attachment: ChatAttachment) => void;
  onattachmentfailure?: (file: File, error: string) => void;
};
