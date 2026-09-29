import { describe, expect, test } from 'bun:test';
import { hostileEvent } from './stream-event-codec-test-helpers.ts';
import { decodeChatStreamEvent, encodeChatStreamEvent } from './stream-event-codec.ts';

describe('run.* terminal frames (CIN-507)', () => {
  test('validates the conversation it projected, not the one it was handed', () => {
    const identities = ['conversation-1', 42];
    const conversation = {
      schemaVersion: 1,
      status: 'active',
      metadata: {},
      ids: [],
      messages: {},
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    } as Record<string, unknown>;
    Object.defineProperty(conversation, 'id', {
      enumerable: true,
      get: () => identities.shift() ?? identities[0],
    });
    // Validating the raw graph would let the schema see the string and the
    // projection encode the number, producing a frame the decoder rejects.
    // Projecting first means one graph is both validated and serialized.
    const decoded = decodeChatStreamEvent(
      encodeChatStreamEvent(
        hostileEvent({
          type: 'run.completed',
          conversation,
          content: 'Done.',
          usage: { prompt: 1, completion: 1, total: 2 },
          finishReason: 'stop-condition',
          wireVersion: 1,
          sequence: 9,
        }),
      ),
    );
    expect(decoded.type).toBe('run.completed');
    if (decoded.type === 'run.completed')
      expect((decoded.conversation as { id: string }).id).toBe('conversation-1');
  });

  test('rejects an array carrying frame-shaped properties', () => {
    // It spreads into an ordinary frame but serializes to `[]`, so the
    // typed-transport path would accept what the NDJSON path rejects.
    expect(() =>
      decodeChatStreamEvent(
        Object.assign([], { type: 'run.aborted', wireVersion: 1, sequence: 0 }),
      ),
    ).toThrow('Invalid chat stream event');
  });

  test('reads a nested block field once on the already-decoded path', () => {
    const answers = [0, Number.NaN];
    const block = { id: 'block-1', type: 'text', content: '', complete: false } as Record<
      string,
      unknown
    >;
    Object.defineProperty(block, 'index', {
      enumerable: true,
      get: () => answers.shift() ?? Number.NaN,
    });
    const decoded = decodeChatStreamEvent({
      type: 'stream:block-start',
      block,
      wireVersion: 1,
      sequence: 0,
    });
    expect(decoded.type).toBe('stream:block-start');
    if (decoded.type === 'stream:block-start') expect(decoded.block.index).toBe(0);
  });

  test('rejects an array smuggled in as a nested block', () => {
    // It reads as a block but serializes to `[]`, which the NDJSON path
    // rejects — so the typed path must reject it too.
    expect(() =>
      decodeChatStreamEvent({
        type: 'stream:block-start',
        block: Object.assign([], {
          id: 'block-1',
          type: 'text',
          index: 0,
          content: '',
          complete: false,
        }),
        wireVersion: 1,
        sequence: 0,
      }),
    ).toThrow('Invalid chat stream event');
  });

  test('rebuilds a decoded JSON payload as plain data', () => {
    const args = { query: 'weather' };
    Object.defineProperty(args, 'toJSON', {
      enumerable: false,
      value: () => 'replaced',
    });
    expect(() =>
      decodeChatStreamEvent({
        type: 'stream:tool-call-complete',
        toolName: 'lookup',
        blockId: 'toolu_1',
        arguments: args,
        wireVersion: 1,
        sequence: 3,
      }),
    ).toThrow('toJSON');
  });

  test('validates the already-decoded event fields it returns when a getter answers differently per read', () => {
    const answers = [40, Number.NaN];
    const event = {
      type: 'tool.progress',
      toolCallId: 'call-1',
      toolName: 'lookup',
      wireVersion: 1,
      sequence: 2,
    } as Record<string, unknown>;
    Object.defineProperty(event, 'percent', {
      enumerable: true,
      get: () => answers.shift() ?? Number.NaN,
    });
    // The already-decoded transport path hands the guard the producer's own
    // object, so the predicate and the returned event must see one value.
    const decoded = decodeChatStreamEvent(event);
    expect(decoded.type).toBe('tool.progress');
    if (decoded.type === 'tool.progress') expect(decoded.percent).toBe(40);
  });

  test('strips a `cause` field from run.error rather than forwarding it', () => {
    const decoded = decodeChatStreamEvent({
      type: 'run.error',
      error: {
        name: 'AgentRunError',
        message: 'The model call failed.',
        kind: 'generate',
        code: 'UNKNOWN',
        cause: { apiKey: 'sk-should-never-cross-the-wire' },
      },
      wireVersion: 1,
      sequence: 9,
    });
    expect(decoded).toEqual({
      type: 'run.error',
      error: {
        name: 'AgentRunError',
        message: 'The model call failed.',
        kind: 'generate',
        code: 'UNKNOWN',
      },
      wireVersion: 1,
      sequence: 9,
    });
  });

  test('round-trips run.tripwire as a serialized error', () => {
    const event = {
      type: 'run.tripwire' as const,
      error: {
        name: 'GuardrailTripwireError',
        message: 'Guardrail tripped.',
        kind: 'policy' as const,
        code: 'TRIPWIRE' as const,
      },
      wireVersion: 1 as const,
      sequence: 9,
    };
    expect(decodeChatStreamEvent(encodeChatStreamEvent(event))).toEqual(event);
  });

  test('rejects run.error with an unrecognized error kind', () => {
    expect(() =>
      decodeChatStreamEvent({
        type: 'run.error',
        error: {
          name: 'AgentRunError',
          message: 'oops',
          kind: 'not-a-real-kind',
          code: 'UNKNOWN',
        },
        wireVersion: 1,
        sequence: 9,
      }),
    ).toThrow('Invalid chat stream event');
  });

  test('round-trips run.aborted', () => {
    const event = {
      type: 'run.aborted' as const,
      reason: 'user cancelled',
      wireVersion: 1 as const,
      sequence: 9,
    };
    expect(decodeChatStreamEvent(encodeChatStreamEvent(event))).toEqual(event);
  });
});
