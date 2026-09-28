import ChatComponent from './components/chat/index.ts';

export default ChatComponent;
export {
  deserializeChatComposerMention,
  parseChatComposerMentions,
  serializeChatComposerMention,
  type ChatComposerMention,
  type ChatComposerMentionParseResult,
  type ChatComposerMentionRange,
} from './components/chat-composer-popover/chat-composer-mention.ts';
export * from './components/chat/index.ts';
export {
  ChatRunFailureError,
  createChatSession,
  createChatSessionController,
  createSessionController,
  type ChatSessionController,
  type ChatSessionControllerOptions,
  type ChatSessionHooks,
  type ChatSessionRequest,
  type ChatSessionTransport,
  type ChatSessionTransportResult,
} from './session/session-controller.ts';
export {
  decodeChatStreamEvents,
  decodeStreamEvents,
  guardChatStreamEvents,
  type ChatStreamDecodeOptions,
} from './session/stream-event-codec.ts';
export {
  type ChatSerializedRunError,
  type ChatStreamEvent,
} from './session/stream-event-contract.ts';
export { decodeChatStreamEvent, decodeStreamEvent } from './session/stream-event-decoder.ts';
export { encodeChatStreamEvent, encodeStreamEvent } from './session/stream-event-encoder.ts';
