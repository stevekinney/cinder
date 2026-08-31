import type { ChatToolResult } from '../components/chat/adapter/chat-adapter.ts';
import { isJSONValue, isToolResult } from '../components/chat/builders.ts';
import type { JSONValue } from '../components/chat/conversation-model.ts';

/** Provider-neutral events emitted by a chat response stream. */
export type ChatStreamEvent =
  | { type: 'text'; text: string }
  | { type: 'tool_call'; id: string; name: string; arguments: JSONValue }
  | ({ type: 'tool_result' } & ChatToolResult);

/** Encodes one event as a newline-delimited JSON frame. */
export function encodeChatStreamEvent(event: ChatStreamEvent): string {
  return `${JSON.stringify(event)}\n`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Decodes and validates one provider-neutral stream event. */
export function decodeChatStreamEvent(value: unknown): ChatStreamEvent {
  const parsed = typeof value === 'string' ? (JSON.parse(value) as unknown) : value;
  if (!isRecord(parsed) || typeof parsed['type'] !== 'string')
    throw new Error('Invalid chat stream event');
  const eventType = parsed['type'];
  if (eventType === 'text' && typeof parsed['text'] === 'string')
    return { type: 'text', text: parsed['text'] };
  if (
    eventType === 'tool_call' &&
    typeof parsed['id'] === 'string' &&
    typeof parsed['name'] === 'string' &&
    isJSONValue(parsed['arguments'])
  ) {
    return {
      type: 'tool_call',
      id: parsed['id'],
      name: parsed['name'],
      arguments: parsed['arguments'],
    };
  }
  if (eventType === 'tool_result') {
    const { type: _type, pendingApproval, ...candidate } = parsed;
    if (
      isToolResult(candidate) &&
      (pendingApproval === undefined || isJSONValue(pendingApproval))
    ) {
      return {
        type: 'tool_result',
        ...candidate,
        ...(pendingApproval === undefined ? {} : { pendingApproval }),
      };
    }
  }
  throw new Error('Invalid chat stream event');
}

/** Decodes newline-delimited events from a string or an async byte stream. */
export async function* decodeChatStreamEvents(
  source: string | AsyncIterable<string | Uint8Array> | ReadableStream<Uint8Array>,
): AsyncGenerator<ChatStreamEvent> {
  if (typeof source === 'string') {
    for (const line of source
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean))
      yield decodeChatStreamEvent(line);
    return;
  }
  const decoder = new TextDecoder();
  let buffer = '';
  const appendChunk = function* (chunk: string | Uint8Array): Generator<ChatStreamEvent> {
    buffer += typeof chunk === 'string' ? chunk : decoder.decode(chunk, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines.map((item) => item.trim()).filter(Boolean))
      yield decodeChatStreamEvent(line);
  };
  if (source instanceof ReadableStream) {
    const reader = source.getReader();
    let completed = false;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        yield* appendChunk(value);
      }
      if (buffer.trim()) yield decodeChatStreamEvent(buffer.trim());
      completed = true;
    } finally {
      try {
        if (!completed) await reader.cancel();
      } catch {
        // Cancellation is cleanup. Never replace the primary read/decode
        // failure with a provider-specific cancellation error.
      } finally {
        reader.releaseLock();
      }
    }
    return;
  } else {
    for await (const chunk of source) yield* appendChunk(chunk);
  }
  if (buffer.trim()) yield decodeChatStreamEvent(buffer.trim());
}

/** Short aliases for applications that already call their wire format `StreamEvent`. */
export const encodeStreamEvent = encodeChatStreamEvent;
export const decodeStreamEvent = decodeChatStreamEvent;
export const decodeStreamEvents = decodeChatStreamEvents;
