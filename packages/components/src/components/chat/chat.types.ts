import type { Snippet } from 'svelte';
import type { Attachment } from 'svelte/attachments';
import type { HTMLAttributes } from 'svelte/elements';

import type {
  ChatAdapter,
  ChatAdapterErrorEvent,
  ChatReadReceiptEvent,
} from './adapter/chat-adapter.ts';
import type {
  ChatScrollStateChangeEvent,
  ChatStopGeneratingEvent,
  ChatSubmitEvent,
  ChatUnreadIndicatorChangeEvent,
} from './container/chat-events.ts';
import type { ConversationHistory, Message } from './conversation-model.ts';
import type { ChatAttachment } from './input/chat-attachment.ts';
import type { MessagePartOverride } from './message/chat-message-parts.ts';
import type { StepInfo } from './utilities/types.ts';

/**
 * Full-row override snippet. Inversion of control: receives the message AND a
 * `renderDefault` snippet that renders the built-in row, so a consumer can wrap
 * or replace a row while still delegating to the default when it chooses.
 */
export type ChatRowOverride = Snippet<[message: Message, renderDefault: Snippet]>;

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
  /** Use the virtualized message render path for long transcripts. The complete `ConversationHistory` remains unchanged; only the DOM window is reduced. Default `false`. */
  virtualized?: boolean;
  /** Estimated row height in pixels for virtualized message rows. Default `88`. */
  virtualizationEstimatedRowHeight?: number;
  /** Number of extra virtual rows rendered before and after the viewport. Default `3`. */
  virtualizationOverscan?: number;
  /** Initial virtualized viewport height used before measurement. Default `640`. */
  virtualizationInitialHeight?: number;
  /** Whether the explicit "Load earlier messages" trigger is shown when a load handler exists. Default `true`. */
  hasMoreHistory?: boolean;
  /** Label for the history pagination trigger. Default `"Load earlier messages"`. */
  loadEarlierLabel?: string;
  /** Status text while older messages are loading. Default `"Loading earlier messages"`. */
  loadingEarlierLabel?: string;
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
  /**
   * Full-row override. Renders an entire message row; receives the message and
   * a `renderDefault` snippet for the built-in row (inversion of control), so a
   * consumer can wrap or fully replace specific rows.
   */
  row?: ChatRowOverride;
  /**
   * Per-message-part override. Replaces the rendering of an individual body part
   * (markdown, tool call, tool result) while delegating the rest to the built-ins
   * via the `renderDefault` snippet it receives. Image parts are excluded — they
   * render through the grouped attachment grid, not this override.
   */
  messagePart?: MessagePartOverride;
  viewportAttachment?: Attachment<HTMLElement>;
  /**
   * Optional command/transport boundary around `conversation`. Its methods take
   * precedence over the matching callback props (e.g. `sendMessage` over
   * `onsubmit`); omit it and Chat behaves exactly as with plain callbacks.
   */
  adapter?: ChatAdapter;
  /** Called when an adapter command fails — either a rejected promise or a synchronous throw from the method. */
  onadaptererror?: (event: ChatAdapterErrorEvent) => void;
  /** Forwarded from the adapter's real-time `onMessage` push (consumer owns the transcript). */
  onpushmessage?: (message: Message) => void;
  /** Forwarded from the adapter's real-time `onTypingChange` push. */
  ontypingchange?: (isTyping: boolean) => void;
  /** Forwarded from the adapter's real-time `onReadReceipt` push. */
  onreadreceipt?: (event: ChatReadReceiptEvent) => void;
  onsubmit?: (event: ChatSubmitEvent) => void;
  onretry?: (messageId: string) => void;
  onedit?: (event: { messageId: string; content: string }) => void;
  /**
   * Called when the user approves an action-required tool call. The
   * consumer is responsible for updating its transcript (e.g. calling
   * conversationalist to unblock the pending tool) and triggering a new
   * generation. When an adapter is also wired, Chat calls
   * `adapter.approveToolCall(toolCallId)` first and then this callback.
   */
  onapprove?: (toolCallId: string) => void;
  /**
   * Called when the user denies an action-required tool call. When an
   * adapter is also wired, Chat calls `adapter.denyToolCall(toolCallId)` first
   * and then this callback.
   */
  ondeny?: (toolCallId: string) => void;
  /**
   * Override or supplement the reasoning text for a message. Called per-message;
   * return a non-empty string to show a reasoning block, `undefined` to fall back
   * to `message.metadata['cinder:reasoning']`, empty string to suppress reasoning.
   */
  messageReasoning?: (message: Message) => string | undefined;
  /**
   * Override or supplement the step list for a message. Called per-message;
   * return an array to show step indicators, `undefined` to fall back to
   * `message.metadata['cinder:steps']`. An empty array suppresses steps.
   */
  messageSteps?: (message: Message) => StepInfo[] | undefined;
  /**
   * Override or supplement the suggestion list for a message. Called
   * per-message; return an array of label strings to show suggestion chips,
   * `undefined` to fall back to `message.metadata['cinder:suggestions']`. An
   * empty array suppresses suggestions.
   */
  messageSuggestions?: (message: Message) => string[] | undefined;
  /**
   * Called when the user selects a suggestion chip. The label string is
   * passed back. The consumer is responsible for submitting it as a new user
   * message.
   */
  onsuggestionselect?: (label: string) => void;
  /** Called when the explicit history trigger is activated. The consumer prepends compatible messages into `conversation`. */
  onloadhistory?: () => void | Promise<void>;
  onstopgenerating?: (event: ChatStopGeneratingEvent) => void;
  onjumptolatest?: () => void;
  onscrollstatechange?: (event: ChatScrollStateChangeEvent) => void;
  onunreadindicatorchange?: (event: ChatUnreadIndicatorChangeEvent) => void;
  onexpandedchange?: (expanded: boolean) => void;
  onattachmentadd?: (attachment: ChatAttachment) => void;
  onattachmentremove?: (attachment: ChatAttachment) => void;
  onattachmentfailure?: (file: File, error: string) => void;
};
