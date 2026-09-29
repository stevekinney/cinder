import { isJSONValue, isTokenUsage } from '../components/chat/builders.ts';
import type { ChatStreamEvent, WireEnvelope } from './stream-event-codec-types.ts';
import { toChatStreamBlock, toChatStreamState } from './stream-event-codec-validation.ts';

export function decodeStreamEvent(
  type: string,
  parsed: Record<string, unknown>,
  required: WireEnvelope,
): ChatStreamEvent {
  if (!Object.hasOwn(streamEventDecoders, type)) throw new Error('Invalid chat stream event');
  const decoder = streamEventDecoders[type];
  if (decoder === undefined) throw new Error('Invalid chat stream event');
  return decoder(parsed, required);
}
type StreamEventDecoder = (
  parsed: Record<string, unknown>,
  required: WireEnvelope,
) => ChatStreamEvent;
const streamEventDecoders: Record<string, StreamEventDecoder> = {
  'stream:block-start': (parsed, required) =>
    decodeBlockEvent('stream:block-start', parsed, required),
  'stream:block-delta': (parsed, required) =>
    decodeBlockEvent('stream:block-delta', parsed, required),
  'stream:block-complete': (parsed, required) =>
    decodeBlockEvent('stream:block-complete', parsed, required),
  'stream:text-delta': (parsed, required) =>
    decodeStreamTextOrToolEvent('stream:text-delta', parsed, required),
  'stream:tool-call-start': (parsed, required) =>
    decodeStreamTextOrToolEvent('stream:tool-call-start', parsed, required),
  'stream:tool-call-delta': (parsed, required) =>
    decodeStreamTextOrToolEvent('stream:tool-call-delta', parsed, required),
  'stream:tool-call-complete': (parsed, required) =>
    decodeStreamTextOrToolEvent('stream:tool-call-complete', parsed, required),
  'stream:usage': (parsed, required) => decodeStreamTerminalEvent('stream:usage', parsed, required),
  'stream:complete': (parsed, required) =>
    decodeStreamTerminalEvent('stream:complete', parsed, required),
  'stream:error': (parsed, required) => decodeStreamTerminalEvent('stream:error', parsed, required),
};
function decodeBlockEvent(
  type: string,
  parsed: Record<string, unknown>,
  required: WireEnvelope,
): ChatStreamEvent {
  const block = toChatStreamBlock(parsed['block']);
  if (!block) throw new Error('Invalid chat stream event');
  if (type === 'stream:block-delta' && typeof parsed['delta'] === 'string')
    return { type, block, delta: parsed['delta'], ...required };
  if (type === 'stream:block-start') return { type, block, ...required };
  if (type === 'stream:block-complete') return { type, block, ...required };
  throw new Error('Invalid chat stream event');
}
function decodeStreamTextOrToolEvent(
  type:
    | 'stream:text-delta'
    | 'stream:tool-call-start'
    | 'stream:tool-call-delta'
    | 'stream:tool-call-complete',
  parsed: Record<string, unknown>,
  required: WireEnvelope,
): ChatStreamEvent {
  switch (type) {
    case 'stream:text-delta':
      return decodeTextDelta(parsed, required);
    case 'stream:tool-call-start':
      return decodeToolCallStart(parsed, required);
    case 'stream:tool-call-delta':
      return decodeToolCallDelta(parsed, required);
    case 'stream:tool-call-complete':
      return decodeToolCallComplete(parsed, required);
  }
}
function decodeTextDelta(parsed: Record<string, unknown>, required: WireEnvelope): ChatStreamEvent {
  if (typeof parsed['content'] !== 'string' || typeof parsed['accumulated'] !== 'string')
    throw new Error('Invalid chat stream event');
  return {
    type: 'stream:text-delta',
    content: parsed['content'],
    accumulated: parsed['accumulated'],
    ...required,
  };
}
function decodeToolCallStart(
  parsed: Record<string, unknown>,
  required: WireEnvelope,
): ChatStreamEvent {
  if (typeof parsed['toolName'] !== 'string' || typeof parsed['blockId'] !== 'string')
    throw new Error('Invalid chat stream event');
  return {
    type: 'stream:tool-call-start',
    toolName: parsed['toolName'],
    blockId: parsed['blockId'],
    ...required,
  };
}
function decodeToolCallDelta(
  parsed: Record<string, unknown>,
  required: WireEnvelope,
): ChatStreamEvent {
  if (
    typeof parsed['toolName'] !== 'string' ||
    typeof parsed['blockId'] !== 'string' ||
    typeof parsed['partialArguments'] !== 'string'
  )
    throw new Error('Invalid chat stream event');
  return {
    type: 'stream:tool-call-delta',
    toolName: parsed['toolName'],
    blockId: parsed['blockId'],
    partialArguments: parsed['partialArguments'],
    ...required,
  };
}
function decodeToolCallComplete(
  parsed: Record<string, unknown>,
  required: WireEnvelope,
): ChatStreamEvent {
  if (
    typeof parsed['toolName'] !== 'string' ||
    typeof parsed['blockId'] !== 'string' ||
    !isJSONValue(parsed['arguments'])
  )
    throw new Error('Invalid chat stream event');
  return {
    type: 'stream:tool-call-complete',
    toolName: parsed['toolName'],
    blockId: parsed['blockId'],
    arguments: parsed['arguments'],
    ...required,
  };
}
function decodeStreamTerminalEvent(
  type: string,
  parsed: Record<string, unknown>,
  required: WireEnvelope,
): ChatStreamEvent {
  if (type === 'stream:usage' && isTokenUsage(parsed['usage']))
    return { type, usage: parsed['usage'], ...required };
  if (type === 'stream:complete') {
    const state = toChatStreamState(parsed['state']);
    if (state) return { type, state, ...required };
  }
  if (type === 'stream:error' && isJSONValue(parsed['error']))
    return { type, error: parsed['error'], ...required };
  throw new Error('Invalid chat stream event');
}
