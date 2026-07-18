/**
 * Chat adapter seam — the optional event/transport boundary around `<Chat>`.
 *
 * Type-only; see `./chat-adapter.ts`.
 *
 * @module
 */

export type {
  ChatAdapter,
  ChatAdapterErrorEvent,
  ChatCommand,
  ChatPushHandlers,
  ChatReadReceiptEvent,
} from './chat-adapter.ts';
