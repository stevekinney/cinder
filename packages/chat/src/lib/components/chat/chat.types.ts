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
import type { ConversationHistory, Message, ToolCallPair } from './conversation-model.ts';
import type { ChatAttachment } from './input/chat-attachment.ts';
import type { MessagePartOverride } from './message/chat-message-parts.ts';
import type { StepInfo } from './utilities/types.ts';

/**
 * A participant who is currently typing. Out-of-band UI state — NOT stored on
 * `Message` or `ConversationHistory`. Flows in as a plain (non-bindable) prop or
 * via the adapter's `onTypingChange` push handler.
 */
export type TypingParticipant = {
  /** Unique identifier for the participant (e.g. user id). */
  id: string;
  /** Display name shown in the typing indicator label. */
  name: string;
};

/**
 * Read-receipt state for a single message. Out-of-band UI state — NOT stored on
 * `Message`. Flows in as a plain (non-bindable) `readReceipts` prop keyed by
 * message id, or accumulated from the adapter's `onReadReceipt` push handler.
 *
 * Render rules: shown only on `user` messages; color alone never conveys state
 * (icon + text label always present).
 */
export type ReadReceipt = {
  /** Delivery/read status for this message. */
  status: 'sent' | 'delivered' | 'read';
  /**
   * Names of participants who have read the message. Used to compose the
   * accessible text (e.g. "Read by Alice, Bob"). May be empty when status is
   * `sent` or `delivered`.
   */
  readBy?: string[];
};

/** Live-region channel for imperative Chat announcements. */
export type ChatAnnounceLevel = 'polite' | 'assertive';

/**
 * Context shared by every snippet that renders a visible message row.
 *
 * Paired tool-result messages do not render duplicate rows. Instead, the visible
 * tool-call row receives the resolved pair, including its result, through
 * `toolCallPair`. Non-tool-call rows receive `undefined`.
 */
export type ChatRowContext = {
  /** The message that owns the visible row. */
  message: Message;
  /** The tool call and its folded result for a visible tool-call row. */
  toolCallPair: ToolCallPair | undefined;
};

/**
 * Full-row override snippet. Inversion of control: receives the row context AND a
 * `renderDefault` snippet that renders the built-in row, so a consumer can wrap
 * or replace a row while still delegating to the default when it chooses.
 */
export type ChatRowOverride = Snippet<[context: ChatRowContext, renderDefault: Snippet]>;

/**
 * Feature-capability flags for the Chat component. Grouped here so consumers
 * pass a single object instead of five scattered boolean props.
 *
 * All flags default to `true` when the `capabilities` prop is omitted or when
 * an individual key is absent from the object.
 */
export type ChatCapabilities = {
  /** Whether file attachments are enabled in the composer. When `false`, the attachment button is hidden and drag-and-drop onto the chat surface is suppressed. Default `true`. */
  attachments?: boolean;
  /** Whether in-conversation search is enabled. When `true`, pressing Ctrl+F / Cmd+F opens a search bar that highlights matching messages. Default `true`. */
  search?: boolean;
  /** Whether per-message copy buttons are shown in the message action bar. Default `true`. */
  copy?: boolean;
  /** Whether user messages can be edited inline. Default `true`. */
  editing?: boolean;
  /** Whether failed assistant messages show a retry button. Default `true`. */
  retry?: boolean;
};

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
  atBottom?: boolean;
  /** Number of messages received while the viewport was scrolled away from the bottom. Bindable; resets to `0` when the user scrolls to the bottom. Default `0`. */
  unreadCount?: number;
  /** Whether the "new messages" indicator is currently visible above the composer. Bindable; cleared automatically when the viewport reaches the bottom. Default `false`. */
  newMessageIndicatorVisible?: boolean;
  /** Additional class name merged onto the `.chat-container` root element. */
  class?: string;
  /** Controls the background of the chat surface. Use `'transparent'` to inherit the host element's background when embedding chat inside a card or panel. Default `'default'`. */
  surfaceMode?: 'default' | 'transparent';
  /**
   * Controls spacing density of the message timeline.
   * - `'comfortable'` (default): standard padding and gap.
   * - `'compact'`: tighter spacing for data-dense contexts (e.g., embedded panels).
   *   Action buttons keep `min-height: var(--cinder-touch-target-min)` regardless.
   */
  density?: 'comfortable' | 'compact';
  /**
   * Visual treatment for message bubbles.
   * - `'bubble'` (default): colored backgrounds differentiate user from assistant.
   * - `'flat'`: no bubble backgrounds; role is communicated via alignment and role label.
   *   Text-on-surface contrast meets WCAG AA via `--cinder-text` on `--cinder-surface-inset`.
   */
  variant?: 'bubble' | 'flat';
  /** Distance in pixels from the bottom of the scroll viewport within which the chat is considered "at bottom" and will auto-scroll on new messages. Default `150`. */
  bottomThreshold?: number;
  /** Distance in pixels scrolled up from the bottom required before the jump-to-latest button appears. Must be greater than `bottomThreshold` to prevent button flickering. Default `200`. */
  jumpThreshold?: number;
  /** Whether a streaming response is currently in progress. When `true`, the composer is disabled and a stop-generating button is shown. Default `false`. */
  streaming?: boolean;
  /** Optional status label displayed in the typing indicator while `streaming` is `true` and no streaming content has arrived yet (e.g. `"Thinking…"` or `"Analyzing file…"`). When omitted, three animated dots are shown. */
  streamingStatus?: string;
  /**
   * Feature-capability flags. Pass a `ChatCapabilities` object to enable or disable
   * individual Chat features (attachments, search, copy, editing, retry) as a group
   * rather than as five separate boolean props.
   */
  capabilities?: ChatCapabilities;
  /** Explicit role for the composer textarea, for overlay patterns such as ARIA comboboxes. */
  composerRole?: string | undefined;
  /** `aria-expanded` passed to the composer textarea for overlays such as slash-command menus. */
  composerAriaExpanded?: boolean | 'true' | 'false' | undefined;
  /** `aria-controls` passed to the composer textarea for overlays such as slash-command menus. */
  composerAriaControls?: string | undefined;
  /** `aria-activedescendant` passed to the composer textarea for overlays such as slash-command menus. */
  composerAriaActiveDescendant?: string | undefined;
  /** `aria-autocomplete` passed to the composer textarea for overlays such as slash-command menus. */
  composerAriaAutocomplete?: 'none' | 'inline' | 'list' | 'both' | undefined;
  /** Use the virtualized message render path for long transcripts. The complete `ConversationHistory` remains unchanged; only the DOM window is reduced. Default `false`. */
  virtualized?: boolean;
  /** Estimated row height in pixels for virtualized message rows. Default `88`. */
  virtualizationEstimatedRowHeight?: number;
  /** Number of extra virtual rows rendered before and after the viewport. Default `3`. */
  virtualizationOverscan?: number;
  /** Initial virtualized viewport height used before measurement. Default `640`. */
  virtualizationInitialHeight?: number;
  /** Whether the explicit "Load earlier messages" trigger is shown when a load handler exists. Default `true`. */
  moreHistoryAvailable?: boolean;
  /** Label for the history pagination trigger. Default `"Load earlier messages"`. */
  loadEarlierLabel?: string;
  /** Status text while older messages are loading. Default `"Loading earlier messages"`. */
  loadingEarlierLabel?: string;
  header?: Snippet;
  empty?: Snippet;
  /** List of suggested starter prompt strings shown as clickable buttons in the default empty state. Clicking a prompt submits it immediately as a user message. Has no effect when a custom `empty` snippet is provided. */
  emptyPrompts?: string[];
  /** Actions rendered for a visible message row. Receives the same {@link ChatRowContext} as `messageStatus` and `row`; paired tool results are folded into the tool-call row's `toolCallPair`. */
  messageActions?: Snippet<[context: ChatRowContext]>;
  /** Status rendered for a visible message row. Receives the same {@link ChatRowContext} as `messageActions` and `row`; paired tool results are folded into the tool-call row's `toolCallPair`. */
  messageStatus?: Snippet<[context: ChatRowContext]>;
  /**
   * Full-row override. Renders an entire message row; receives the shared row context and
   * a `renderDefault` snippet for the built-in row (inversion of control), so a
   * consumer can wrap or fully replace specific rows. Paired tool results are
   * folded into the visible tool-call row's `toolCallPair`.
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
   * Participants who are currently typing. Out-of-band UI state — NOT stored on
   * `Message`. Pass an array of {@link TypingParticipant} objects; the component
   * renders a per-participant typing indicator above the input. While defined,
   * including as an empty array, this prop determines the visible indicator instead
   * of adapter-derived state. Adapter events still call `ontypingchange`, and their
   * derived state may continue updating and become visible if this prop later becomes
   * `undefined`. Omit the prop or pass `undefined` to show adapter-derived state.
   * Default `undefined` (indicator hidden until adapter state is available).
   */
  typingParticipants?: TypingParticipant[] | undefined;
  /**
   * Per-message read receipt state. Out-of-band UI state — NOT stored on `Message`.
   * Pass a `Map` keyed by message id with a {@link ReadReceipt} value; the
   * component renders a receipt badge on USER messages only. While defined,
   * including as an empty `Map`, this prop determines the visible receipts instead
   * of adapter-derived state. Adapter events still call `onreadreceipt`, and their
   * derived state may continue accumulating and become visible if this prop later
   * becomes `undefined`. Omit the prop or pass `undefined` to show adapter-derived
   * state. Default `undefined` (no receipts shown until adapter state is available).
   */
  readReceipts?: Map<string, ReadReceipt> | undefined;
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
  /**
   * Called with the composer's current plain-text value on every composer
   * input event. The optional event exposes the textarea for composer-bound
   * overlays without reaching into `.chat-input-editor` DOM directly.
   */
  oncomposerinput?: (value: string, event?: Event) => void;
  /**
   * Called before Chat's internal composer key handling when a keydown
   * originates from the composer textarea. Call `event.preventDefault()` to
   * let an overlay consume Arrow keys, Enter, or Escape before Enter-to-send.
   * Chat does not call this hook during IME composition, so Enter can still
   * confirm the active candidate instead of sending.
   */
  oncomposerkeydown?: (event: KeyboardEvent) => void;
  /**
   * Called after pointer or selection activity may have moved the composer
   * caret without changing text. Overlay primitives can resync their active
   * token from the textarea selection.
   */
  oncomposerselectionchange?: (event: Event) => void;
  /**
   * Called when focus leaves the composer textarea. Overlay primitives can use
   * this to dismiss without preventing native focus movement.
   */
  oncomposerblur?: (event: FocusEvent) => void;
};
