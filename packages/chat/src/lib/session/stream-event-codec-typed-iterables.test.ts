import { describe, expect, test } from 'bun:test';
import { createConversationHistory } from 'conversationalist';
import { expectRejected, hostileEvent } from './stream-event-codec-test-helpers.ts';
import type { ChatStreamEvent } from './stream-event-codec.ts';
import { guardChatStreamEvents } from './stream-event-codec.ts';

const collect = async (events: AsyncIterable<ChatStreamEvent>): Promise<ChatStreamEvent[]> => {
  const seen: ChatStreamEvent[] = [];
  for await (const event of guardChatStreamEvents(events)) seen.push(event);
  return seen;
};

async function* invalidSequenceEvents(): AsyncGenerator<ChatStreamEvent> {
  yield { wireVersion: 1, sequence: Number.NaN, type: 'text', text: 'hi' };
  yield { wireVersion: 1, sequence: 1, type: 'run.aborted' };
}

async function* invalidShapeEvents(): AsyncGenerator<ChatStreamEvent> {
  yield hostileEvent({ wireVersion: 1, sequence: 0, type: 'text', text: 42 });
  yield { wireVersion: 1, sequence: 1, type: 'run.aborted' };
}

async function* validEvents(): AsyncGenerator<ChatStreamEvent> {
  yield { wireVersion: 1, sequence: 0, type: 'text', text: 'hi' };
  yield {
    wireVersion: 1,
    sequence: 1,
    type: 'run.completed',
    conversation: createConversationHistory({ id: 'c1' }),
    content: 'hi',
    usage: { prompt: 1, completion: 1, total: 2 },
    finishReason: 'stop',
  };
}

describe('typed event iterables are validated frame by frame', () => {
  test('rejects a typed event whose sequence is NaN', async () => {
    await expectRejected(collect(invalidSequenceEvents()), /Invalid chat stream event/);
  });

  test('rejects a typed event that would not decode from the wire', async () => {
    await expectRejected(collect(invalidShapeEvents()), /Invalid chat stream event/);
  });

  test('passes a well-formed typed stream through unchanged', async () => {
    const seen = await collect(validEvents());
    expect(seen.map((event) => event.type)).toEqual(['text', 'run.completed']);
  });
});
