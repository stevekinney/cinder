import { decodeChatStreamEvent } from './stream-event-codec-decoding.ts';
import { encodeChatStreamEvent } from './stream-event-codec-encoding.ts';
import { decodeChatStreamEvents } from './stream-event-codec-stream.ts';

export { decodeChatStreamEvent } from './stream-event-codec-decoding.ts';
export { projectWireEnvelope } from './stream-event-codec-encoding-projection.ts';
export { encodeChatStreamEvent } from './stream-event-codec-encoding.ts';
export {
  decodeChatStreamEvents,
  guardChatStreamEvents,
  type ChatStreamDecodeOptions,
} from './stream-event-codec-stream.ts';
export * from './stream-event-codec-types.ts';

/** Short aliases for applications that already call their wire format `StreamEvent`. */
export const encodeStreamEvent = encodeChatStreamEvent;
export const decodeStreamEvent = decodeChatStreamEvent;
export const decodeStreamEvents = decodeChatStreamEvents;
