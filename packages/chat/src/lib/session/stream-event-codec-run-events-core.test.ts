import { describe, expect, test } from 'bun:test';
import {
  expectRejected,
  hostileEvent,
  inheritedEvent,
  inheritedRecord,
} from './stream-event-codec-test-helpers.ts';
import {
  decodeChatStreamEvent,
  decodeChatStreamEvents,
  encodeChatStreamEvent,
} from './stream-event-codec.ts';

describe('run.* terminal frames (CIN-507)', () => {
  const conversation = {
    schemaVersion: 1,
    id: 'conversation-1',
    status: 'active' as const,
    metadata: {},
    ids: [] as string[],
    messages: {},
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  test('round-trips run.completed carrying the authoritative final conversation', () => {
    const event = {
      type: 'run.completed' as const,
      conversation,
      content: 'Done.',
      usage: { prompt: 10, completion: 5, total: 15 },
      finishReason: 'stop-condition',
      wireVersion: 1 as const,
      sequence: 9,
    };
    expect(decodeChatStreamEvent(encodeChatStreamEvent(event))).toEqual(event);
  });

  test('rejects run.completed when conversation is not a valid ConversationHistory', () => {
    expect(() =>
      decodeChatStreamEvent({
        type: 'run.completed',
        conversation: { id: 'conversation-1' },
        content: 'Done.',
        usage: { prompt: 10, completion: 5, total: 15 },
        finishReason: 'stop-condition',
        wireVersion: 1,
        sequence: 9,
      }),
    ).toThrow('Invalid chat stream event');
  });

  test('round-trips run.error as a serialized error with cause omitted', () => {
    const event = {
      type: 'run.error' as const,
      error: {
        name: 'AgentRunError',
        message: 'The model call failed.',
        kind: 'generate' as const,
        code: 'UNKNOWN' as const,
      },
      wireVersion: 1 as const,
      sequence: 9,
    };
    expect(decodeChatStreamEvent(encodeChatStreamEvent(event))).toEqual(event);
  });

  test('round-trips run.error retryability in both directions', () => {
    // Both values matter, and `false` is the one a truthiness bug eats: a
    // terminal failure that decodes as "not stated" would render with a
    // retry affordance the host explicitly said not to offer.
    for (const retryable of [true, false]) {
      const event = {
        type: 'run.error' as const,
        error: {
          name: 'AgentRunError',
          message: 'The model call failed.',
          kind: 'generate' as const,
          code: 'UNKNOWN' as const,
          retryable,
        },
        wireVersion: 1 as const,
        sequence: 9,
      };
      expect(decodeChatStreamEvent(encodeChatStreamEvent(event))).toEqual(event);
    }
  });

  test('keeps an unstated retryability unstated rather than defaulting it', () => {
    // A producer written before the field existed says nothing about
    // retryability. Inventing `false` here would be a claim it never made,
    // and would silently take the retry affordance away from every host
    // that has not adopted the field.
    const event = {
      type: 'run.error' as const,
      error: {
        name: 'AgentRunError',
        message: 'The model call failed.',
        kind: 'generate' as const,
        code: 'UNKNOWN' as const,
      },
      wireVersion: 1 as const,
      sequence: 9,
    };
    const decoded = decodeChatStreamEvent(encodeChatStreamEvent(event));
    expect(decoded.type).toBe('run.error');
    if (decoded.type !== 'run.error') throw new Error('unreachable');
    expect('retryable' in decoded.error).toBe(false);
  });

  test('refuses a non-boolean retryability at both boundaries', () => {
    const error = {
      name: 'AgentRunError',
      message: 'The model call failed.',
      kind: 'generate' as const,
      code: 'UNKNOWN' as const,
      retryable: 'yes',
    };
    expect(() =>
      encodeChatStreamEvent(
        hostileEvent({
          type: 'run.error',
          error,
          wireVersion: 1,
          sequence: 9,
        }),
      ),
    ).toThrow(/retryable must be a boolean/);
    expect(() =>
      decodeChatStreamEvent(
        hostileEvent({ type: 'run.error', error, wireVersion: 1, sequence: 9 }),
      ),
    ).toThrow();
  });

  test('encodes the run.error fields it validated when a getter answers differently per read', () => {
    const answers = ['AgentRunError', undefined];
    const error = {
      message: 'The model call failed.',
      kind: 'generate',
      code: 'UNKNOWN',
    } as Record<string, unknown>;
    Object.defineProperty(error, 'name', {
      enumerable: true,
      get: () => answers.shift(),
    });
    const event = hostileEvent({
      type: 'run.error',
      error,
      wireVersion: 1,
      sequence: 4,
    });
    // Without a single snapshot the guard sees the string, the returned
    // frame drops `name` entirely, and the decoder rejects it.
    const decoded = decodeChatStreamEvent(encodeChatStreamEvent(event));
    expect(decoded.type).toBe('run.error');
    if (decoded.type === 'run.error') expect(decoded.error.name).toBe('AgentRunError');
  });

  test('encodes the conversation it validated when a getter answers differently per read', () => {
    const histories: unknown[] = [
      {
        schemaVersion: 1,
        id: 'conversation-1',
        status: 'active',
        metadata: {},
        ids: [],
        messages: {},
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      'not a history',
    ];
    const event = {
      type: 'run.completed',
      content: 'done',
      usage: { prompt: 1, completion: 1, total: 2 },
      finishReason: 'stop-condition',
      wireVersion: 1,
      sequence: 7,
    } as Record<string, unknown>;
    Object.defineProperty(event, 'conversation', {
      enumerable: true,
      get: () => histories.shift() ?? histories[0],
    });
    const decoded = decodeChatStreamEvent(encodeChatStreamEvent(hostileEvent(event)));
    expect(decoded.type).toBe('run.completed');
    if (decoded.type === 'run.completed')
      expect((decoded.conversation as { id: string }).id).toBe('conversation-1');
  });

  test('does not read a payload field inherited from a polluted prototype', () => {
    const objectPrototype = Object.prototype as { text?: unknown };
    objectPrototype.text = 'inherited';
    try {
      // `{"type":"text"}` carries no own `text`, so it is not a text frame —
      // whatever the prototype offers.
      expect(() => decodeChatStreamEvent('{"type":"text"}')).toThrow('Invalid chat stream event');
    } finally {
      delete objectPrototype.text;
    }
  });

  test('does not encode frame fields that live only on the prototype', () => {
    // Every field is inherited, so the object itself carries no frame at
    // all — the decoder already rejects it, and the encoder must not
    // materialize it onto the wire.
    expect(() => encodeChatStreamEvent(inheritedEvent({ type: 'text', text: 'secret' }))).toThrow(
      'Invalid chat stream event',
    );
  });

  test('reports a string framing failure through the protocol hook', async () => {
    const seen: unknown[] = [];
    const events = decodeChatStreamEvents(
      '{"type":"run.aborted","wireVersion":1,"sequence":0}\nleftover',
      { onProtocolError: (error) => seen.push(error) },
    );
    // The same content delivered as bytes notifies; this representation
    // must notify too, or a consumer's cleanup depends on how the caller
    // happened to deliver the stream.
    await expectRejected(events.next(), 'Invalid chat stream event');
    expect(seen).toHaveLength(1);
  });

  test('does not encode nested fields that live only on the prototype', () => {
    const block = inheritedRecord({
      id: 'secret',
      type: 'text',
      index: 0,
      content: '',
      complete: false,
    });
    expect(() =>
      encodeChatStreamEvent(
        hostileEvent({
          type: 'stream:block-start',
          block,
          wireVersion: 1,
          sequence: 0,
        }),
      ),
    ).toThrow('Invalid chat stream event');
  });

  test('does not encode tool-result error fields that live only on the prototype', () => {
    const error = inheritedRecord({
      code: 'TIMEOUT',
      category: 'timeout',
      retryable: true,
      message: 'inherited',
    });
    expect(() =>
      encodeChatStreamEvent(
        hostileEvent({
          type: 'tool.settled',
          toolCallId: 'call-1',
          toolName: 'lookup',
          result: { callId: 'call-1', outcome: 'error', content: null, error },
          wireVersion: 1,
          sequence: 2,
        }),
      ),
    ).toThrow('Invalid chat stream event');
  });
});
