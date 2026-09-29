import { describe, expect, test } from 'bun:test';
import { hostileEvent } from './stream-event-codec-test-helpers.ts';
import { decodeChatStreamEvent, encodeChatStreamEvent } from './stream-event-codec.ts';

describe('stream:* members mirror Operative StreamEvent (CIN-507)', () => {
  test('round-trips stream:block-start', () => {
    const event = {
      type: 'stream:block-start' as const,
      block: {
        id: 'block-1',
        type: 'text' as const,
        index: 0,
        content: '',
        complete: false,
      },
      wireVersion: 1 as const,
      sequence: 0,
    };
    expect(decodeChatStreamEvent(encodeChatStreamEvent(event))).toEqual(event);
  });

  test('encodes the block index it validated when a getter answers differently per read', () => {
    const answers = [0, Number.NaN];
    const block = { id: 'block-1', type: 'text', content: '', complete: false } as Record<
      string,
      unknown
    >;
    Object.defineProperty(block, 'index', {
      enumerable: true,
      get: () => answers.shift() ?? Number.NaN,
    });
    const event = hostileEvent({
      type: 'stream:block-start',
      block,
      wireVersion: 1,
      sequence: 0,
    });
    // Without a single snapshot the projection copies NaN, JSON.stringify
    // rewrites it to null, and the decoder rejects the encoder's own frame.
    const decoded = decodeChatStreamEvent(encodeChatStreamEvent(event));
    expect(decoded.type).toBe('stream:block-start');
    if (decoded.type === 'stream:block-start') expect(decoded.block.index).toBe(0);
  });

  test('rejects a block with a negative index', () => {
    expect(() =>
      decodeChatStreamEvent({
        type: 'stream:block-start',
        block: { id: 'block-1', type: 'text', index: -1, content: '', complete: false },
        wireVersion: 1,
        sequence: 0,
      }),
    ).toThrow('Invalid chat stream event');
  });

  test('rejects a block index above Number.MAX_SAFE_INTEGER', () => {
    expect(() =>
      decodeChatStreamEvent({
        type: 'stream:block-start',
        block: {
          id: 'block-1',
          type: 'text',
          index: Number.MAX_SAFE_INTEGER + 1,
          content: '',
          complete: false,
        },
        wireVersion: 1,
        sequence: 0,
      }),
    ).toThrow('Invalid chat stream event');
  });

  test('round-trips stream:block-delta', () => {
    const event = {
      type: 'stream:block-delta' as const,
      block: {
        id: 'block-1',
        type: 'text' as const,
        index: 0,
        content: 'he',
        complete: false,
      },
      delta: 'he',
      wireVersion: 1 as const,
      sequence: 1,
    };
    expect(decodeChatStreamEvent(encodeChatStreamEvent(event))).toEqual(event);
  });

  test('round-trips stream:block-complete', () => {
    const event = {
      type: 'stream:block-complete' as const,
      block: {
        id: 'block-1',
        type: 'text' as const,
        index: 0,
        content: 'hello',
        complete: true,
      },
      wireVersion: 1 as const,
      sequence: 2,
    };
    expect(decodeChatStreamEvent(encodeChatStreamEvent(event))).toEqual(event);
  });

  test('round-trips stream:tool-call-start', () => {
    const event = {
      type: 'stream:tool-call-start' as const,
      toolName: 'lookup',
      blockId: 'block-2',
      wireVersion: 1 as const,
      sequence: 3,
    };
    expect(decodeChatStreamEvent(encodeChatStreamEvent(event))).toEqual(event);
  });

  test('round-trips stream:tool-call-delta', () => {
    const event = {
      type: 'stream:tool-call-delta' as const,
      toolName: 'lookup',
      blockId: 'block-2',
      partialArguments: '{"query":',
      wireVersion: 1 as const,
      sequence: 4,
    };
    expect(decodeChatStreamEvent(encodeChatStreamEvent(event))).toEqual(event);
  });

  test('round-trips stream:text-delta', () => {
    const event = {
      type: 'stream:text-delta' as const,
      content: 'lo',
      accumulated: 'hello',
      wireVersion: 1 as const,
      sequence: 3,
    };
    expect(decodeChatStreamEvent(encodeChatStreamEvent(event))).toEqual(event);
  });

  test('round-trips stream:tool-call-complete with JSONValue-narrowed arguments', () => {
    const event = {
      type: 'stream:tool-call-complete' as const,
      toolName: 'lookup',
      blockId: 'block-2',
      arguments: { query: 'weather' },
      wireVersion: 1 as const,
      sequence: 4,
    };
    expect(decodeChatStreamEvent(encodeChatStreamEvent(event))).toEqual(event);
  });

  test('rejects stream:tool-call-complete when arguments is not JSON-safe', () => {
    expect(() =>
      decodeChatStreamEvent({
        type: 'stream:tool-call-complete',
        toolName: 'lookup',
        blockId: 'block-2',
        arguments: undefined,
        wireVersion: 1,
        sequence: 4,
      }),
    ).toThrow('Invalid chat stream event');
  });

  test('round-trips stream:complete with a nested StreamState', () => {
    const block = {
      id: 'block-1',
      type: 'text' as const,
      index: 0,
      content: 'hello',
      complete: true,
    };
    const event = {
      type: 'stream:complete' as const,
      state: {
        blocks: [block],
        textContent: 'hello',
        toolCalls: [],
        complete: true,
        usage: { prompt: 10, completion: 5, total: 15 },
      },
      wireVersion: 1 as const,
      sequence: 5,
    };
    expect(decodeChatStreamEvent(encodeChatStreamEvent(event))).toEqual(event);
  });

  test('round-trips stream:complete with an activeBlock', () => {
    const block = {
      id: 'block-1',
      type: 'text' as const,
      index: 0,
      content: 'he',
      complete: false,
    };
    const event = {
      type: 'stream:complete' as const,
      state: {
        blocks: [block],
        activeBlock: block,
        textContent: 'he',
        toolCalls: [],
        complete: false,
      },
      wireVersion: 1 as const,
      sequence: 5,
    };
    expect(decodeChatStreamEvent(encodeChatStreamEvent(event))).toEqual(event);
  });

  test('rejects stream:block-delta when delta is not a string', () => {
    expect(() =>
      decodeChatStreamEvent({
        type: 'stream:block-delta',
        block: { id: 'block-1', type: 'text', index: 0, content: '', complete: false },
        delta: 42,
        wireVersion: 1,
        sequence: 0,
      }),
    ).toThrow('Invalid chat stream event');
  });

  test('round-trips stream:usage', () => {
    const event = {
      type: 'stream:usage' as const,
      usage: { prompt: 10, completion: 5, total: 15 },
      wireVersion: 1 as const,
      sequence: 4,
    };
    expect(decodeChatStreamEvent(encodeChatStreamEvent(event))).toEqual(event);
  });

  test('round-trips stream:error with JSONValue-narrowed error', () => {
    const event = {
      type: 'stream:error' as const,
      error: { message: 'provider failed' },
      wireVersion: 1 as const,
      sequence: 6,
    };
    expect(decodeChatStreamEvent(encodeChatStreamEvent(event))).toEqual(event);
  });
});
