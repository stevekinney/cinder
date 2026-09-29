import { describe, expect, test } from 'bun:test';
import { expectRejected } from './stream-event-codec-test-helpers.ts';
import { decodeChatStreamEvents, encodeChatStreamEvent } from './stream-event-codec.ts';

const block = (index: number) => ({
  id: `block-${index}`,
  type: 'text' as const,
  index,
  content: '',
  complete: false,
});

describe('decodeChatStreamEvents stream-level invariants (CIN-507)', () => {
  test('rejects an out-of-order sequence across frames', async () => {
    const ndjson =
      encodeChatStreamEvent({
        type: 'stream:block-start',
        block: block(0),
        wireVersion: 1,
        sequence: 5,
      }) +
      encodeChatStreamEvent({
        type: 'stream:block-start',
        block: block(1),
        wireVersion: 1,
        sequence: 4,
      });
    await expectRejected(
      Array.fromAsync(decodeChatStreamEvents(ndjson)),
      'Invalid chat stream event',
    );
  });

  test('rejects a duplicate (non-increasing) sequence across frames', async () => {
    const ndjson =
      encodeChatStreamEvent({
        type: 'stream:block-start',
        block: block(0),
        wireVersion: 1,
        sequence: 5,
      }) +
      encodeChatStreamEvent({
        type: 'stream:block-start',
        block: block(1),
        wireVersion: 1,
        sequence: 5,
      });
    await expectRejected(
      Array.fromAsync(decodeChatStreamEvents(ndjson)),
      'Invalid chat stream event',
    );
  });

  test('accepts an increasing sequence across frames', async () => {
    const ndjson =
      encodeChatStreamEvent({
        type: 'stream:block-start',
        block: block(0),
        wireVersion: 1,
        sequence: 0,
      }) +
      encodeChatStreamEvent({
        type: 'run.completed',
        conversation: {
          schemaVersion: 1,
          id: 'conversation-1',
          status: 'active',
          metadata: {},
          ids: [],
          messages: {},
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
        content: 'Done.',
        usage: { prompt: 1, completion: 1, total: 2 },
        finishReason: 'stop-condition',
        wireVersion: 1,
        sequence: 1,
      });
    const events = await Array.fromAsync(decodeChatStreamEvents(ndjson));
    expect(events).toHaveLength(2);
  });

  test('rejects a versioned stream that ends without a terminal frame', async () => {
    const ndjson = encodeChatStreamEvent({
      type: 'stream:text-delta',
      content: 'h',
      accumulated: 'h',
      wireVersion: 1,
      sequence: 0,
    });
    await expectRejected(
      Array.fromAsync(decodeChatStreamEvents(ndjson)),
      'Invalid chat stream event',
    );
  });

  test('accepts a versioned stream that ends with run.aborted as terminal', async () => {
    const ndjson =
      encodeChatStreamEvent({
        type: 'stream:text-delta',
        content: 'h',
        accumulated: 'h',
        wireVersion: 1,
        sequence: 0,
      }) + encodeChatStreamEvent({ type: 'run.aborted', wireVersion: 1, sequence: 1 });
    const events = await Array.fromAsync(decodeChatStreamEvents(ndjson));
    expect(events).toHaveLength(2);
  });

  test('rejects any frame that follows the terminal frame', async () => {
    const ndjson =
      encodeChatStreamEvent({ type: 'run.aborted', wireVersion: 1, sequence: 0 }) +
      encodeChatStreamEvent({
        type: 'stream:text-delta',
        content: 'h',
        accumulated: 'h',
        wireVersion: 1,
        sequence: 1,
      });
    await expectRejected(
      Array.fromAsync(decodeChatStreamEvents(ndjson)),
      'Invalid chat stream event: frame arrived after the terminal frame',
    );
  });

  test('rejects a second terminal frame following the first', async () => {
    const ndjson =
      encodeChatStreamEvent({ type: 'run.aborted', wireVersion: 1, sequence: 0 }) +
      encodeChatStreamEvent({ type: 'run.aborted', wireVersion: 1, sequence: 1 });
    await expectRejected(
      Array.fromAsync(decodeChatStreamEvents(ndjson)),
      'Invalid chat stream event: frame arrived after the terminal frame',
    );
  });

  test('accepts a wholly legacy (bare) stream with no terminal frame at all', async () => {
    const ndjson =
      '{"type":"text","text":"hi"}\n{"type":"tool_call","id":"call-1","name":"lookup","arguments":{}}\n';
    const events = await Array.fromAsync(decodeChatStreamEvents(ndjson));
    expect(events).toHaveLength(2);
  });

  test('rejects a bare legacy frame following a versioned frame in the same stream', async () => {
    const ndjson =
      encodeChatStreamEvent({
        type: 'stream:text-delta',
        content: 'h',
        accumulated: 'h',
        wireVersion: 1,
        sequence: 0,
      }) + '{"type":"text","text":"hi"}\n';
    await expectRejected(
      Array.fromAsync(decodeChatStreamEvents(ndjson)),
      'Invalid chat stream event',
    );
  });

  test('rejects a versioned frame following a bare legacy frame in the same stream', async () => {
    const ndjson =
      '{"type":"text","text":"hi"}\n' +
      encodeChatStreamEvent({
        type: 'stream:text-delta',
        content: 'h',
        accumulated: 'h',
        wireVersion: 1,
        sequence: 0,
      });
    await expectRejected(
      Array.fromAsync(decodeChatStreamEvents(ndjson)),
      'Invalid chat stream event',
    );
  });

  // A stream commits to ONE wire version, the same way it commits to one
  // envelope mode. The two versions are not interchangeable — version 2 adds
  // vocabulary version 1 has no frame for — so a consumer that read the first
  // frame as version 1 and is handed a version 2 frame partway through has
  // been told two different things about what it is reading. Per-frame decode
  // cannot see this; only the stream guard can.
  test('rejects a version 2 frame following a version 1 frame in the same stream', async () => {
    const ndjson =
      encodeChatStreamEvent({
        type: 'stream:text-delta',
        content: 'h',
        accumulated: 'h',
        wireVersion: 1,
        sequence: 0,
      }) +
      encodeChatStreamEvent({
        type: 'assistant.step.started',
        step: 0,
        messageId: 'host-0',
        wireVersion: 2,
        sequence: 1,
      });
    await expectRejected(
      Array.fromAsync(decodeChatStreamEvents(ndjson)),
      'Invalid chat stream event: wire version changed mid-stream',
    );
  });

  test('rejects a version 1 frame following a version 2 frame in the same stream', async () => {
    const ndjson =
      encodeChatStreamEvent({
        type: 'assistant.step.started',
        step: 0,
        messageId: 'host-0',
        wireVersion: 2,
        sequence: 0,
      }) +
      encodeChatStreamEvent({
        type: 'stream:text-delta',
        content: 'h',
        accumulated: 'h',
        wireVersion: 1,
        sequence: 1,
      });
    await expectRejected(
      Array.fromAsync(decodeChatStreamEvents(ndjson)),
      'Invalid chat stream event: wire version changed mid-stream',
    );
  });

  test('accepts a wholly version 2 stream', async () => {
    const ndjson =
      encodeChatStreamEvent({
        type: 'assistant.step.started',
        step: 0,
        messageId: 'host-0',
        wireVersion: 2,
        sequence: 0,
      }) +
      encodeChatStreamEvent({ type: 'text', text: 'hi', wireVersion: 2, sequence: 1 }) +
      encodeChatStreamEvent({ type: 'run.aborted', wireVersion: 2, sequence: 2 });
    const events = await Array.fromAsync(decodeChatStreamEvents(ndjson));
    expect(events).toHaveLength(3);
  });
});

// Every case below was raised on review. They share a theme worth naming: the
// encoder's job is to refuse to produce a frame its own decoder would reject,
// because by the time the decoder sees a bad frame the payload has already
