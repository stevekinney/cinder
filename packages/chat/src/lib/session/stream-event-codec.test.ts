import { describe, expect, test } from 'bun:test';
import type { ChatStreamEvent } from './stream-event-codec.ts';
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

  test('preserves a JSON-safe signed pending approval extension', () => {
    const event = {
      type: 'tool_result' as const,
      callId: 'call-approval',
      outcome: 'action_required' as const,
      content: 'Save this note?',
      action: { type: 'approval' as const, message: 'Save this note?' },
      pendingApproval: {
        callId: 'call-approval',
        toolName: 'remember_note',
        arguments: { text: 'A note' },
        approvalToken: 'a'.repeat(64),
      },
    };

    expect(decodeChatStreamEvent(encodeChatStreamEvent(event))).toEqual(event);
  });

  test('rejects a non-JSON pending approval extension', () => {
    expect(() =>
      decodeChatStreamEvent({
        type: 'tool_result',
        callId: 'call-approval',
        outcome: 'action_required',
        content: null,
        pendingApproval: { approvalToken: Symbol('invalid') },
      }),
    ).toThrow('Invalid chat stream event');
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

  test('releases the reader lock when cancellation rejects without replacing the primary error', async () => {
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(new TextEncoder().encode('{invalid}\n'));
      },
      cancel() {
        return Promise.reject(new Error('cancel failed'));
      },
    });
    await expect(Array.fromAsync(decodeChatStreamEvents(stream))).rejects.toThrow();
    expect(stream.locked).toBe(false);
  });

  describe('legacy members keep their exact current shape (CIN-507)', () => {
    test('a bare `text` frame with no envelope decodes byte-identically to today', () => {
      const event = { type: 'text' as const, text: 'hello' };
      expect(decodeChatStreamEvent(encodeChatStreamEvent(event))).toEqual(event);
    });

    test('a bare `tool_call` frame with no envelope decodes byte-identically to today', () => {
      const event = {
        type: 'tool_call' as const,
        id: 'call-1',
        name: 'lookup',
        arguments: { query: 'weather' },
      };
      expect(decodeChatStreamEvent(encodeChatStreamEvent(event))).toEqual(event);
    });

    test('a bare `tool_result` frame with no envelope decodes byte-identically to today', () => {
      const event = {
        type: 'tool_result' as const,
        callId: 'call-1',
        outcome: 'success' as const,
        content: { ok: true },
      };
      expect(decodeChatStreamEvent(encodeChatStreamEvent(event))).toEqual(event);
    });

    test('legacy members also accept an attached wire envelope', () => {
      const event = { type: 'text' as const, text: 'hi', wireVersion: 1 as const, sequence: 0 };
      expect(decodeChatStreamEvent(encodeChatStreamEvent(event))).toEqual(event);
    });
  });

  describe('wire envelope (CIN-507)', () => {
    test('rejects an unsupported wireVersion on a legacy member', () => {
      expect(() =>
        decodeChatStreamEvent({ type: 'text', text: 'hi', wireVersion: 2, sequence: 0 }),
      ).toThrow('Invalid chat stream event');
    });

    test('rejects an unsupported wireVersion on a new member', () => {
      expect(() =>
        decodeChatStreamEvent({
          type: 'stream:text-delta',
          content: 'h',
          accumulated: 'h',
          wireVersion: 2,
          sequence: 0,
        }),
      ).toThrow('Invalid chat stream event');
    });

    test('new members require the envelope — missing sequence is rejected', () => {
      expect(() =>
        decodeChatStreamEvent({
          type: 'stream:text-delta',
          content: 'h',
          accumulated: 'h',
          wireVersion: 1,
        }),
      ).toThrow('Invalid chat stream event');
    });

    test('new members require the envelope — missing wireVersion is rejected', () => {
      expect(() =>
        decodeChatStreamEvent({
          type: 'stream:text-delta',
          content: 'h',
          accumulated: 'h',
          sequence: 0,
        }),
      ).toThrow('Invalid chat stream event');
    });

    test('rejects a legacy member carrying only wireVersion', () => {
      expect(() => decodeChatStreamEvent({ type: 'text', text: 'hi', wireVersion: 1 })).toThrow(
        'Invalid chat stream event',
      );
    });

    test('rejects a legacy member carrying only sequence', () => {
      expect(() => decodeChatStreamEvent({ type: 'text', text: 'hi', sequence: 0 })).toThrow(
        'Invalid chat stream event',
      );
    });

    test('rejects a sequence above Number.MAX_SAFE_INTEGER', () => {
      expect(() =>
        decodeChatStreamEvent({
          type: 'stream:text-delta',
          content: 'h',
          accumulated: 'h',
          wireVersion: 1,
          sequence: Number.MAX_SAFE_INTEGER + 1,
        }),
      ).toThrow('Invalid chat stream event');
    });

    test('accepts a sequence at exactly Number.MAX_SAFE_INTEGER', () => {
      const event = {
        type: 'stream:text-delta' as const,
        content: 'h',
        accumulated: 'h',
        wireVersion: 1 as const,
        sequence: Number.MAX_SAFE_INTEGER,
      };
      expect(decodeChatStreamEvent(encodeChatStreamEvent(event))).toEqual(event);
    });
  });

  test('still throws on a genuinely unrecognized type', () => {
    expect(() =>
      decodeChatStreamEvent({ type: 'not-a-real-event', wireVersion: 1, sequence: 0 }),
    ).toThrow('Invalid chat stream event');
  });

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

  describe('tool.* members key by toolCallId (CIN-507)', () => {
    test('round-trips tool.started', () => {
      const event = {
        type: 'tool.started' as const,
        toolCallId: 'call-1',
        toolName: 'lookup',
        wireVersion: 1 as const,
        sequence: 1,
      };
      expect(decodeChatStreamEvent(encodeChatStreamEvent(event))).toEqual(event);
    });

    test('round-trips tool.progress', () => {
      const event = {
        type: 'tool.progress' as const,
        toolCallId: 'call-1',
        toolName: 'lookup',
        percent: 42,
        message: 'Fetching…',
        wireVersion: 1 as const,
        sequence: 1,
      };
      expect(decodeChatStreamEvent(encodeChatStreamEvent(event))).toEqual(event);
    });

    test('rejects a non-finite tool.progress percent', () => {
      expect(() =>
        decodeChatStreamEvent({
          type: 'tool.progress',
          toolCallId: 'call-1',
          toolName: 'lookup',
          percent: Number.POSITIVE_INFINITY,
          wireVersion: 1,
          sequence: 1,
        }),
      ).toThrow('Invalid chat stream event');
    });

    test('round-trips tool.settled with a paused result carrying an action descriptor', () => {
      const event = {
        type: 'tool.settled' as const,
        toolCallId: 'call-1',
        toolName: 'remember_note',
        result: {
          callId: 'call-1',
          outcome: 'action_required' as const,
          content: 'Save this note?',
          action: { type: 'approval' as const, message: 'Save this note?' },
        },
        wireVersion: 1 as const,
        sequence: 2,
      };
      expect(decodeChatStreamEvent(encodeChatStreamEvent(event))).toEqual(event);
    });

    test('rejects tool.settled when result is not a valid ChatToolResult', () => {
      expect(() =>
        decodeChatStreamEvent({
          type: 'tool.settled',
          toolCallId: 'call-1',
          toolName: 'remember_note',
          result: { callId: 'call-1' },
          wireVersion: 1,
          sequence: 2,
        }),
      ).toThrow('Invalid chat stream event');
    });

    test('rejects tool.settled when the result callId disagrees with toolCallId', () => {
      expect(() =>
        decodeChatStreamEvent({
          type: 'tool.settled',
          toolCallId: 'call-1',
          toolName: 'lookup',
          result: { callId: 'call-2', outcome: 'success', content: { ok: true } },
          wireVersion: 1,
          sequence: 2,
        }),
      ).toThrow('Invalid chat stream event');
    });

    test('round-trips tool.error with JSONValue-narrowed error', () => {
      const event = {
        type: 'tool.error' as const,
        toolCallId: 'call-1',
        toolName: 'lookup',
        error: { code: 'TIMEOUT' },
        wireVersion: 1 as const,
        sequence: 2,
      };
      expect(decodeChatStreamEvent(encodeChatStreamEvent(event))).toEqual(event);
    });

    test('round-trips tool.policy-denied', () => {
      const event = {
        type: 'tool.policy-denied' as const,
        toolCallId: 'call-1',
        toolName: 'delete_file',
        reason: 'not permitted',
        wireVersion: 1 as const,
        sequence: 2,
      };
      expect(decodeChatStreamEvent(encodeChatStreamEvent(event))).toEqual(event);
    });
  });

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

  describe('encode-time field projection (CIN-507)', () => {
    test('never encodes a `cause` a caller smuggled onto a run.error at runtime', () => {
      // TypeScript's static type has no `cause` field — that's the whole
      // point of ChatSerializedRunError — but the type doesn't exist at
      // runtime. A host that spreads Operative's `agentRunErrorToJSON()`
      // output (which *does* include `cause`) onto this event would produce
      // exactly this shape. Route through `unknown` so the compiler permits
      // constructing it, mirroring what a real host integration would do.
      const eventWithSmuggledCause = {
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
      } as unknown as ChatStreamEvent;

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
      const eventWithSmuggledCause = {
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
      } as unknown as ChatStreamEvent;

      const encoded = encodeChatStreamEvent(eventWithSmuggledCause);

      expect(encoded).not.toContain('cause');
      expect(encoded).not.toContain('sk-should-never-cross-the-wire');
    });

    test('never encodes extra properties smuggled onto a tool_result at runtime', () => {
      const eventWithSmuggledField = {
        type: 'tool_result',
        callId: 'call-1',
        outcome: 'success',
        content: { ok: true },
        internalDebugToken: 'should-never-cross-the-wire',
      } as unknown as ChatStreamEvent;

      const encoded = encodeChatStreamEvent(eventWithSmuggledField);

      expect(encoded).not.toContain('internalDebugToken');
      expect(encoded).not.toContain('should-never-cross-the-wire');
    });

    test('rejects encoding a wire envelope carrying only wireVersion', () => {
      const event = {
        type: 'text',
        text: 'hi',
        wireVersion: 1,
      } as unknown as ChatStreamEvent;
      expect(() => encodeChatStreamEvent(event)).toThrow(
        'Invalid chat stream event: cannot encode a malformed wire envelope',
      );
    });

    test('rejects encoding a wire envelope with an unsupported wireVersion', () => {
      const event = {
        type: 'text',
        text: 'hi',
        wireVersion: 2,
        sequence: 0,
      } as unknown as ChatStreamEvent;
      expect(() => encodeChatStreamEvent(event)).toThrow(
        'Invalid chat stream event: cannot encode a malformed wire envelope',
      );
    });

    test('never encodes extra properties smuggled onto a nested stream:block-start block', () => {
      const event = {
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
      } as unknown as ChatStreamEvent;

      const encoded = encodeChatStreamEvent(event);

      expect(encoded).not.toContain('providerSecret');
      expect(encoded).not.toContain('should-never-cross-the-wire');
    });

    test('never encodes extra properties smuggled onto nested stream:complete blocks', () => {
      const event = {
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
      } as unknown as ChatStreamEvent;

      const encoded = encodeChatStreamEvent(event);

      expect(encoded).not.toContain('providerSecret');
      expect(encoded).not.toContain('should-never-cross-the-wire');
    });

    test('rejects encoding a non-finite tool.progress percent', () => {
      const event = {
        type: 'tool.progress',
        toolCallId: 'call-1',
        toolName: 'lookup',
        percent: Number.NaN,
        wireVersion: 1,
        sequence: 0,
      } as unknown as ChatStreamEvent;
      expect(() => encodeChatStreamEvent(event)).toThrow(
        'Invalid chat stream event: tool.progress percent must be finite',
      );
    });

    test('rejects encoding a CIN-507 member with no wire envelope at all', () => {
      const event = {
        type: 'stream:text-delta',
        content: 'h',
        accumulated: 'h',
      } as unknown as ChatStreamEvent;
      expect(() => encodeChatStreamEvent(event)).toThrow(
        'Invalid chat stream event: stream:text-delta requires a wire envelope',
      );
    });

    test('rejects encoding tool.settled when result.callId disagrees with toolCallId', () => {
      const event = {
        type: 'tool.settled',
        toolCallId: 'call-1',
        toolName: 'lookup',
        result: { callId: 'call-2', outcome: 'success', content: { ok: true } },
        wireVersion: 1,
        sequence: 0,
      } as unknown as ChatStreamEvent;
      expect(() => encodeChatStreamEvent(event)).toThrow(
        'Invalid chat stream event: tool.settled result.callId must equal toolCallId',
      );
    });

    test('rejects encoding non-finite numbers nested in tool_call arguments', () => {
      const event = {
        type: 'tool_call',
        id: 'call-1',
        name: 'lookup',
        arguments: { weights: [1, Number.POSITIVE_INFINITY] },
      } as unknown as ChatStreamEvent;
      expect(() => encodeChatStreamEvent(event)).toThrow(
        'Invalid chat stream event: tool_call.arguments contains a non-finite number',
      );
    });

    test('rejects encoding non-finite numbers nested in stream:tool-call-complete arguments', () => {
      const event = {
        type: 'stream:tool-call-complete',
        toolName: 'lookup',
        blockId: 'block-1',
        arguments: { nested: { score: Number.NaN } },
        wireVersion: 1,
        sequence: 0,
      } as unknown as ChatStreamEvent;
      expect(() => encodeChatStreamEvent(event)).toThrow(
        'Invalid chat stream event: stream:tool-call-complete.arguments contains a non-finite number',
      );
    });
  });

  describe('decodeChatStreamEvents stream-level invariants (CIN-507)', () => {
    const block = (index: number) => ({
      id: `block-${index}`,
      type: 'text' as const,
      index,
      content: '',
      complete: false,
    });

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
      await expect(Array.fromAsync(decodeChatStreamEvents(ndjson))).rejects.toThrow(
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
      await expect(Array.fromAsync(decodeChatStreamEvents(ndjson))).rejects.toThrow(
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
      await expect(Array.fromAsync(decodeChatStreamEvents(ndjson))).rejects.toThrow(
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
      await expect(Array.fromAsync(decodeChatStreamEvents(ndjson))).rejects.toThrow(
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
      await expect(Array.fromAsync(decodeChatStreamEvents(ndjson))).rejects.toThrow(
        'Invalid chat stream event',
      );
    });
  });
});
