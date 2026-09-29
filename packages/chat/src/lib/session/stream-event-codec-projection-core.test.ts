import { describe, expect, test } from 'bun:test';
import { hostileEvent } from './stream-event-codec-test-helpers.ts';
import { encodeChatStreamEvent } from './stream-event-codec.ts';

describe('encode-time field projection (CIN-507)', () => {
  test('rejects encoding a non-JSON value smuggled into tool_call arguments', () => {
    const event = hostileEvent({
      type: 'tool_call',
      id: 'call-1',
      name: 'lookup',
      arguments: { handler: () => {} },
    });
    expect(() => encodeChatStreamEvent(event)).toThrow(
      'Invalid chat stream event: tool_call.arguments is not a valid JSON value',
    );
  });

  test('rejects encoding a bare legacy member with a half-formed envelope smuggled via a cast', () => {
    // `WithOptionalEnvelope` no longer makes this constructible without a
    // cast — this pins that the runtime check still catches a caller who
    // bypasses the type anyway.
    const event = hostileEvent({ type: 'text', text: 'hi', wireVersion: 1 });
    expect(() => encodeChatStreamEvent(event)).toThrow(
      'Invalid chat stream event: cannot encode a malformed wire envelope',
    );
  });

  test('rejects encoding run.completed when conversation is not a valid ConversationHistory', () => {
    const event = hostileEvent({
      type: 'run.completed',
      conversation: { id: 'conversation-1', providerSecret: 'leak' },
      content: 'Done.',
      usage: { prompt: 1, completion: 1, total: 2 },
      finishReason: 'stop-condition',
      wireVersion: 1,
      sequence: 0,
    });
    expect(() => encodeChatStreamEvent(event)).toThrow(
      'Invalid chat stream event: conversation is not a valid ConversationHistory',
    );
  });

  test('never encodes a `cause` a caller smuggled onto a run.error at runtime', () => {
    // TypeScript's static type has no `cause` field — that's the whole
    // point of ChatSerializedRunError — but the type doesn't exist at
    // runtime. A host that spreads Operative's `agentRunErrorToJSON()`
    // output (which *does* include `cause`) onto this event would produce
    // exactly this shape. Route through `unknown` so the compiler permits
    // constructing it, mirroring what a real host integration would do.
    const eventWithSmuggledCause = hostileEvent({
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

    const encoded = encodeChatStreamEvent(eventWithSmuggledCause);

    expect(encoded).not.toContain('cause');
    expect(encoded).not.toContain('sk-should-never-cross-the-wire');
    expect(JSON.parse(encoded)).toEqual({
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

  test('never encodes a `cause` a caller smuggled onto a run.tripwire at runtime', () => {
    const eventWithSmuggledCause = hostileEvent({
      type: 'run.tripwire',
      error: {
        name: 'GuardrailTripwireError',
        message: 'Guardrail tripped.',
        kind: 'policy',
        code: 'TRIPWIRE',
        cause: { apiKey: 'sk-should-never-cross-the-wire' },
      },
      wireVersion: 1,
      sequence: 9,
    });

    const encoded = encodeChatStreamEvent(eventWithSmuggledCause);

    expect(encoded).not.toContain('cause');
    expect(encoded).not.toContain('sk-should-never-cross-the-wire');
  });

  test('never encodes extra properties smuggled onto a tool_result at runtime', () => {
    const eventWithSmuggledField = hostileEvent({
      type: 'tool_result',
      callId: 'call-1',
      outcome: 'success',
      content: { ok: true },
      internalDebugToken: 'should-never-cross-the-wire',
    });

    const encoded = encodeChatStreamEvent(eventWithSmuggledField);

    expect(encoded).not.toContain('internalDebugToken');
    expect(encoded).not.toContain('should-never-cross-the-wire');
  });

  test('rejects encoding a wire envelope carrying only wireVersion', () => {
    const event = hostileEvent({
      type: 'text',
      text: 'hi',
      wireVersion: 1,
    });
    expect(() => encodeChatStreamEvent(event)).toThrow(
      'Invalid chat stream event: cannot encode a malformed wire envelope',
    );
  });

  test('rejects encoding a wire envelope with an unsupported wireVersion', () => {
    const event = hostileEvent({
      type: 'text',
      text: 'hi',
      wireVersion: 3,
      sequence: 0,
    });
    expect(() => encodeChatStreamEvent(event)).toThrow(
      'Invalid chat stream event: cannot encode a malformed wire envelope',
    );
  });

  test('never encodes extra properties smuggled onto a nested stream:block-start block', () => {
    const event = hostileEvent({
      type: 'stream:block-start',
      block: {
        id: 'block-1',
        type: 'text',
        index: 0,
        content: '',
        complete: false,
        providerSecret: 'should-never-cross-the-wire',
      },
      wireVersion: 1,
      sequence: 0,
    });

    const encoded = encodeChatStreamEvent(event);

    expect(encoded).not.toContain('providerSecret');
    expect(encoded).not.toContain('should-never-cross-the-wire');
  });

  test('never encodes extra properties smuggled onto nested stream:complete blocks', () => {
    const event = hostileEvent({
      type: 'stream:complete',
      state: {
        blocks: [
          {
            id: 'block-1',
            type: 'text',
            index: 0,
            content: 'hi',
            complete: true,
            providerSecret: 'should-never-cross-the-wire',
          },
        ],
        textContent: 'hi',
        toolCalls: [],
        complete: true,
      },
      wireVersion: 1,
      sequence: 0,
    });

    const encoded = encodeChatStreamEvent(event);

    expect(encoded).not.toContain('providerSecret');
    expect(encoded).not.toContain('should-never-cross-the-wire');
  });
});
