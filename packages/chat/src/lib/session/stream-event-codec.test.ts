import { describe, expect, test } from 'bun:test';
import {
  decodeChatStreamEvent,
  decodeChatStreamEvents,
  encodeChatStreamEvent,
} from './stream-event-codec.ts';

describe('chat stream event codec', () => {
  test('round-trips events without provider-specific types', () => {
    const event = {
      type: 'tool_result' as const,
      callId: 'call-1',
      outcome: 'success' as const,
      content: { ok: true },
    };
    expect(decodeChatStreamEvent(encodeChatStreamEvent(event))).toEqual(event);
  });

  test('decodes split newline-delimited chunks', async () => {
    async function* chunks(): AsyncGenerator<string> {
      yield '{"type":"text","text":"hel';
      yield 'lo"}\n{"type":"text","text":"!"}\n';
    }
    expect(await Array.fromAsync(decodeChatStreamEvents(chunks()))).toEqual([
      { type: 'text', text: 'hello' },
      { type: 'text', text: '!' },
    ]);
  });

  test('decodes newline-delimited events from a string', async () => {
    expect(
      await Array.fromAsync(
        decodeChatStreamEvents(
          '{"type":"text","text":"first"}\n\n{"type":"text","text":"second"}\n',
        ),
      ),
    ).toEqual([
      { type: 'text', text: 'first' },
      { type: 'text', text: 'second' },
    ]);
  });

  test('rejects malformed events', () => {
    expect(() => decodeChatStreamEvent({ type: 'text' })).toThrow('Invalid chat stream event');
    expect(() => decodeChatStreamEvent('{not json')).toThrow();
  });

  test('decodes a ReadableStream of UTF-8 NDJSON', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"type":"text","text":"streamed"}\n'));
        controller.close();
      },
    });
    expect(await Array.fromAsync(decodeChatStreamEvents(stream))).toEqual([
      { type: 'text', text: 'streamed' },
    ]);
  });
});
