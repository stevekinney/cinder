/**
 * Optional adapter event/transport seam for the Chat component.
 *
 * `ChatAdapter` names the send / retry / edit / stop / tool-approval / history /
 * real-time contract around the existing `conversation` prop WITHOUT coupling
 * Chat to any transport. It is purely an event boundary — NOT a second
 * conversation model. Every method parameter and every push payload uses the
 * structural mirror types from `../conversation-model.ts`, so a consumer whose
 * authoritative transcript lives in `conversationalist` can pass a plain
 * `ConversationHistory` snapshot to `<Chat>` and wire an adapter with zero
 * adaptation. This module is TYPE-ONLY — it ships no runtime code and imports
 * nothing at runtime, so it is trivially SSR-safe.
 *
 * The adapter is always optional. When omitted, Chat behaves exactly as it does
 * with its plain callback props (`onsubmit` / `onretry` / `onedit` /
 * `onstopgenerating`); the internal command dispatcher routes both paths
 * identically (adapter method first, callback fallback).
 *
 * @module
 */

import type { Message, MessageInput, ToolCall, ToolResult } from '../conversation-model.ts';
import type { ChatAttachment } from '../input/chat-attachment.ts';

/**
 * A read-receipt push event: a message was read at a point in time. The payload
 * is an object (not positional args) so later tasks can extend it — e.g. with a
 * participant id — without a breaking signature change.
 */
export type ChatReadReceiptEvent = {
  /** The id of the message that was read. */
  messageId: string;
  /** ISO-8601 timestamp at which the message was read. */
  readAt: string;
};

/**
 * Push handlers Chat hands to {@link ChatAdapter.subscribe}. The adapter invokes
 * these as real-time transport events arrive.
 *
 * Streaming handlers drive Chat's own imperative streaming buffer
 * (`onStreamBegin`/`onTokenPush`/`onStreamEnd` → `beginStreaming`/`pushToken`/
 * `endStreaming`), so a push-driven stream is fully self-contained — the
 * consumer does not also have to call the imperative API by hand.
 *
 * Transcript/peripheral handlers (`onMessage`/`onTypingChange`/`onReadReceipt`)
 * concern state Chat does NOT own (the consumer owns `conversation`), so Chat
 * forwards them verbatim to the matching pass-through callback props. It never
 * mutates `conversation` in response.
 */
export type ChatPushHandlers = {
  /** A new (or updated) message arrived. Forwarded to the consumer; Chat does not mutate the transcript. */
  onMessage: (message: Message) => void;
  /** A participant's typing state changed. Forwarded to the consumer. */
  onTypingChange: (isTyping: boolean) => void;
  /** A read receipt arrived. Forwarded to the consumer. */
  onReadReceipt: (event: ChatReadReceiptEvent) => void;
  /** Streaming began for a message — drives Chat's `beginStreaming(messageId)`. */
  onStreamBegin: (messageId: string) => void;
  /** A streaming token arrived — drives Chat's `pushToken(token)`. */
  onTokenPush: (token: string) => void;
  /** Streaming ended — drives Chat's `endStreaming()`. */
  onStreamEnd: () => void;
};

/**
 * Optional command/transport boundary around `<Chat conversation={…}>`.
 *
 * Only `sendMessage` is required; everything else is optional so an adapter can
 * opt into exactly the capabilities its transport supports. Command methods
 * return `Promise<void>` — Chat awaits them and routes a rejection to
 * `onadaptererror` rather than swallowing it.
 *
 * The optional `approveToolCall`/`denyToolCall` (consumed by the tool-approval
 * task) and `loadOlderMessages` (consumed by the load-history task) are declared
 * here so the seam is complete; their UI wiring lands with those tasks.
 */
export type ChatAdapter = {
  /** Send a composed message with its attachments. */
  sendMessage: (message: MessageInput, attachments: ChatAttachment[]) => Promise<void>;
  /** Retry a previously-failed message by id. */
  retryMessage?: (messageId: string) => Promise<void>;
  /** Commit an edit to a user message. */
  editMessage?: (event: { messageId: string; content: string }) => Promise<void>;
  /** Stop an in-progress generation for a message. */
  stopGenerating?: (messageId: string) => Promise<void>;
  /**
   * Load a page of older messages for the given conversation. Returns whether
   * more remain. (UI wired by the load-history task.)
   */
  loadOlderMessages?: (conversationId: string) => Promise<{ hasMore: boolean }>;
  /**
   * Subscribe to real-time events for a conversation. Receives the conversation
   * id (so the transport knows which channel to open) plus the push handlers,
   * and returns an unsubscribe function Chat calls on teardown.
   */
  subscribe?: (conversationId: string, handlers: ChatPushHandlers) => () => void;
  /** Approve an action-required tool call by id. (UI wired by the tool-approval task.) */
  approveToolCall?: (toolCallId: string) => Promise<void>;
  /** Reject an action-required tool call by id. (UI wired by the tool-approval task.) */
  denyToolCall?: (toolCallId: string) => Promise<void>;
};

/**
 * The set of commands the internal dispatcher routes. Used to tag an
 * {@link ChatAdapterErrorEvent} so a consumer can tell which command failed.
 *
 * Widen this when a later Chat task wires another adapter method
 * (`approveToolCall`/`denyToolCall`/`loadOlderMessages`) through the dispatcher,
 * so its error events carry the right `command` tag.
 */
export type ChatCommand = 'sendMessage' | 'retryMessage' | 'editMessage' | 'stopGenerating';

/** Error event surfaced when an awaited adapter command rejects. */
export type ChatAdapterErrorEvent = {
  /** Which command's adapter method rejected. */
  command: ChatCommand;
  /** The thrown value. */
  error: unknown;
};

/** Re-export the mirror types an adapter author needs, from one place. */
export type { Message, MessageInput, ToolCall, ToolResult };
