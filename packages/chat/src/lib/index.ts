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
  decodeChatStreamEvent,
  decodeChatStreamEvents,
  decodeStreamEvent,
  decodeStreamEvents,
  encodeChatStreamEvent,
  encodeStreamEvent,
  guardChatStreamEvents,
  type ChatStreamDecodeOptions,
  type ChatStreamEvent,
} from './session/stream-event-codec.ts';
