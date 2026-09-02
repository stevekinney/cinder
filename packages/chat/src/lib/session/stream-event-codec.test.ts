import { describe, expect, test } from 'bun:test';
import {
  appendToolCall,
  appendToolResult,
  appendUserMessage,
  createConversationHistory,
  isConversationHistory,
} from 'conversationalist';
import type { ChatStreamEvent } from './stream-event-codec.ts';
import {
  decodeChatStreamEvent,
  decodeChatStreamEvents,
  encodeChatStreamEvent,
  guardChatStreamEvents,
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

  test('round-trips a tool_result carrying an error field', () => {
    const event = {
      type: 'tool_result' as const,
      callId: 'call-1',
      outcome: 'error' as const,
      content: null,
      error: {
        code: 'TIMEOUT',
        category: 'timeout' as const,
        retryable: true,
        message: 'timed out',
        details: { elapsedMs: 5000 },
      },
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

  test('rejects a tool_result whose shape is wrong even though it is plain JSON', () => {
    // Reaches the branch's own rejection rather than the plain-data rebuild's:
    // every value here is JSON, the shape is simply not a `ChatToolResult`.
    expect(() =>
      decodeChatStreamEvent({
        type: 'tool_result',
        callId: 'call-1',
        outcome: 'not-an-outcome',
        content: null,
      }),
    ).toThrow('Invalid chat stream event');
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

    test('an inherited envelope key is not part of the frame', () => {
      // `in` would see a polluted prototype's `wireVersion`; only own keys count.
      const frame = Object.create({ wireVersion: 1, sequence: 0 }) as Record<string, unknown>;
      frame['type'] = 'text';
      frame['text'] = 'hi';
      const decoded = decodeChatStreamEvent(frame);
      expect(decoded.type).toBe('text');
      expect(Object.hasOwn(decoded, 'wireVersion')).toBe(false);
      expect(Object.hasOwn(decoded, 'sequence')).toBe(false);
      // The encoder applies the same rule, so the frame round-trips as bare.
      expect(encodeChatStreamEvent(frame as unknown as ChatStreamEvent)).toBe(
        '{"type":"text","text":"hi"}\n',
      );
    });

    test('returns the sequence it validated when a getter answers differently per read', () => {
      const answers = [0, Number.NaN];
      const frame = { type: 'text', text: 'hi', wireVersion: 1 } as Record<string, unknown>;
      Object.defineProperty(frame, 'sequence', {
        enumerable: true,
        get: () => answers.shift() ?? Number.NaN,
      });
      const decoded = decodeChatStreamEvent(frame);
      expect(decoded.sequence).toBe(0);
    });

    test('an inherited type discriminator is not a frame', () => {
      // Serializing this object yields only the envelope, which the NDJSON
      // path rejects; the typed path must not accept what the wire would not.
      const frame = Object.create({ type: 'run.aborted' }) as Record<string, unknown>;
      frame['wireVersion'] = 1;
      frame['sequence'] = 0;
      expect(() => decodeChatStreamEvent(frame)).toThrow('Invalid chat stream event');
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
      const event = {
        type: 'stream:block-start',
        block,
        wireVersion: 1,
        sequence: 0,
      } as unknown as ChatStreamEvent;
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

    test('encodes the usage it validated when a getter answers differently per read', () => {
      const answers = [15, Number.NaN];
      const usage = { prompt: 10, completion: 5 } as Record<string, unknown>;
      Object.defineProperty(usage, 'total', {
        enumerable: true,
        get: () => answers.shift() ?? Number.NaN,
      });
      const event = {
        type: 'stream:usage',
        usage,
        wireVersion: 1,
        sequence: 3,
      } as unknown as ChatStreamEvent;
      // Without a single snapshot the guard sees 15, the projection copies
      // NaN, JSON.stringify rewrites it to null, and the decoder rejects the
      // encoder's own frame.
      const decoded = decodeChatStreamEvent(encodeChatStreamEvent(event));
      expect(decoded.type).toBe('stream:usage');
      if (decoded.type === 'stream:usage') expect(decoded.usage.total).toBe(15);
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

    test('compares and encodes the same tool.settled result when a getter answers differently per read', () => {
      const results = [
        { callId: 'call-1', outcome: 'success', content: { ok: true } },
        { callId: 'call-2', outcome: 'success', content: { ok: true } },
      ];
      const event = {
        type: 'tool.settled',
        toolCallId: 'call-1',
        toolName: 'lookup',
        wireVersion: 1,
        sequence: 2,
      } as Record<string, unknown>;
      Object.defineProperty(event, 'result', {
        enumerable: true,
        get: () => results.shift() ?? results[0],
      });
      // Without a single snapshot the agreement check sees call-1 and the
      // projection encodes call-2, a frame the decoder then rejects.
      expect(() => encodeChatStreamEvent(event as unknown as ChatStreamEvent)).not.toThrow();
      const answers = ['call-1', 'call-2'];
      const other = {
        type: 'tool.settled',
        toolCallId: 'call-1',
        toolName: 'lookup',
        wireVersion: 1,
        sequence: 2,
      } as Record<string, unknown>;
      Object.defineProperty(other, 'result', {
        enumerable: true,
        get: () => ({
          get callId() {
            return answers.shift() ?? 'call-2';
          },
          outcome: 'success',
          content: { ok: true },
        }),
      });
      const decoded = decodeChatStreamEvent(
        encodeChatStreamEvent(other as unknown as ChatStreamEvent),
      );
      expect(decoded.type).toBe('tool.settled');
      if (decoded.type === 'tool.settled') expect(decoded.result.callId).toBe('call-1');
    });

    test('encodes the tool.progress percent it validated when a getter answers differently per read', () => {
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
      const decoded = decodeChatStreamEvent(
        encodeChatStreamEvent(event as unknown as ChatStreamEvent),
      );
      expect(decoded.type).toBe('tool.progress');
      if (decoded.type === 'tool.progress') expect(decoded.percent).toBe(40);
    });

    test('rejects a frame whose serialization hook is reachable through the prototype chain', () => {
      const event = {
        type: 'tool.progress' as const,
        toolCallId: 'call-1',
        toolName: 'lookup',
        wireVersion: 1 as const,
        sequence: 2,
      };
      const objectPrototype = Object.prototype as { toJSON?: unknown };
      objectPrototype.toJSON = () => ({ type: 'run.aborted' });
      try {
        // JSON.stringify would consult the hook and emit something other than
        // the projection every field above was validated into.
        expect(() => encodeChatStreamEvent(event)).toThrow('toJSON');
      } finally {
        delete objectPrototype.toJSON;
      }
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
      const event = {
        type: 'run.error',
        error,
        wireVersion: 1,
        sequence: 4,
      } as unknown as ChatStreamEvent;
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
      const decoded = decodeChatStreamEvent(
        encodeChatStreamEvent(event as unknown as ChatStreamEvent),
      );
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
      expect(() =>
        encodeChatStreamEvent(Object.create({ type: 'text', text: 'secret' }) as ChatStreamEvent),
      ).toThrow('Invalid chat stream event');
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
      await expect(events.next()).rejects.toThrow('Invalid chat stream event');
      expect(seen).toHaveLength(1);
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

  describe('encode-time field projection (CIN-507)', () => {
    test('rejects encoding a non-JSON value smuggled into tool_call arguments', () => {
      const event = {
        type: 'tool_call',
        id: 'call-1',
        name: 'lookup',
        arguments: { handler: () => {} },
      } as unknown as ChatStreamEvent;
      expect(() => encodeChatStreamEvent(event)).toThrow(
        'Invalid chat stream event: tool_call.arguments is not a valid JSON value',
      );
    });

    test('rejects encoding a bare legacy member with a half-formed envelope smuggled via a cast', () => {
      // `WithOptionalEnvelope` no longer makes this constructible without a
      // cast — this pins that the runtime check still catches a caller who
      // bypasses the type anyway.
      const event = { type: 'text', text: 'hi', wireVersion: 1 } as unknown as ChatStreamEvent;
      expect(() => encodeChatStreamEvent(event)).toThrow(
        'Invalid chat stream event: cannot encode a malformed wire envelope',
      );
    });

    test('rejects encoding run.completed when conversation is not a valid ConversationHistory', () => {
      const event = {
        type: 'run.completed',
        conversation: { id: 'conversation-1', providerSecret: 'leak' },
        content: 'Done.',
        usage: { prompt: 1, completion: 1, total: 2 },
        finishReason: 'stop-condition',
        wireVersion: 1,
        sequence: 0,
      } as unknown as ChatStreamEvent;
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

    test('reads the discriminator once so a stateful type getter cannot dodge the envelope check', () => {
      // A getter that answers `text` to the legacy check and `run.aborted`
      // to the switch would otherwise encode a bare new-vocabulary frame
      // that the decoder then rejects.
      const answers: Array<ChatStreamEvent['type']> = ['text', 'run.aborted'];
      const event = { text: 'hi' } as Record<string, unknown>;
      Object.defineProperty(event, 'type', {
        enumerable: true,
        get: () => answers.shift() ?? 'run.aborted',
      });
      // Whichever answer the encoder acts on, the frame it emits must be one
      // its own decoder accepts — a bare `run.aborted` frame is not.
      const frame = encodeChatStreamEvent(event as unknown as ChatStreamEvent);
      expect(decodeChatStreamEvent(frame).type).toBe('text');
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
        'Invalid chat stream event: tool_call.arguments is not a valid JSON value',
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
        'Invalid chat stream event: stream:tool-call-complete.arguments is not a valid JSON value',
      );
    });

    test('rejects encoding a non-finite number nested in tool_result content', () => {
      const event = {
        type: 'tool_result',
        callId: 'call-1',
        outcome: 'success',
        content: { score: Number.POSITIVE_INFINITY },
      } as unknown as ChatStreamEvent;
      expect(() => encodeChatStreamEvent(event)).toThrow(
        'Invalid chat stream event: tool result content is not a valid JSON value',
      );
    });

    test('rejects encoding a non-finite number nested in a tool result error.details', () => {
      const event = {
        type: 'tool_result',
        callId: 'call-1',
        outcome: 'error',
        content: null,
        error: {
          code: 'TIMEOUT',
          category: 'timeout',
          retryable: true,
          message: 'timed out',
          details: { elapsedMs: Number.NaN },
        },
      } as unknown as ChatStreamEvent;
      expect(() => encodeChatStreamEvent(event)).toThrow(
        'Invalid chat stream event: tool result error.details is not a valid JSON value',
      );
    });

    test('rejects encoding a non-finite number nested in a tool result action.schema', () => {
      const event = {
        type: 'tool_result',
        callId: 'call-1',
        outcome: 'action_required',
        content: 'confirm?',
        action: {
          type: 'approval',
          message: 'confirm?',
          schema: { threshold: Number.POSITIVE_INFINITY },
        },
      } as unknown as ChatStreamEvent;
      expect(() => encodeChatStreamEvent(event)).toThrow(
        'Invalid chat stream event: tool result action.schema is not a valid JSON value',
      );
    });

    test('rejects encoding a non-finite number nested in a tool result pendingApproval', () => {
      const event = {
        type: 'tool_result',
        callId: 'call-approval',
        outcome: 'action_required',
        content: 'confirm?',
        pendingApproval: { callId: 'call-approval', arguments: { weight: Number.NaN } },
      } as unknown as ChatStreamEvent;
      expect(() => encodeChatStreamEvent(event)).toThrow(
        'Invalid chat stream event: tool result pendingApproval is not a valid JSON value',
      );
    });

    test('rejects encoding a stream block with a negative index', () => {
      const event = {
        type: 'stream:block-start',
        block: { id: 'block-1', type: 'text', index: -1, content: '', complete: false },
        wireVersion: 1,
        sequence: 0,
      } as unknown as ChatStreamEvent;
      expect(() => encodeChatStreamEvent(event)).toThrow(
        'Invalid chat stream event: block index must be a non-negative safe integer',
      );
    });

    test('rejects encoding a nested stream:complete block with a non-finite index', () => {
      const event = {
        type: 'stream:complete',
        state: {
          blocks: [
            { id: 'block-1', type: 'text', index: Number.NaN, content: '', complete: false },
          ],
          textContent: '',
          toolCalls: [],
          complete: true,
        },
        wireVersion: 1,
        sequence: 0,
      } as unknown as ChatStreamEvent;
      expect(() => encodeChatStreamEvent(event)).toThrow(
        'Invalid chat stream event: block index must be a non-negative safe integer',
      );
    });

    test('rejects encoding a non-finite stream:usage value', () => {
      const event = {
        type: 'stream:usage',
        usage: { prompt: 1, completion: Number.NaN, total: 1 },
        wireVersion: 1,
        sequence: 0,
      } as unknown as ChatStreamEvent;
      expect(() => encodeChatStreamEvent(event)).toThrow(
        'Invalid chat stream event: usage is not a valid TokenUsage',
      );
    });

    test('rejects encoding a non-finite run.completed usage value', () => {
      const event = {
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
        usage: { prompt: 1, completion: 1, total: Number.POSITIVE_INFINITY },
        finishReason: 'stop-condition',
        wireVersion: 1,
        sequence: 0,
      } as unknown as ChatStreamEvent;
      expect(() => encodeChatStreamEvent(event)).toThrow(
        'Invalid chat stream event: usage is not a valid TokenUsage',
      );
    });

    test('rejects encoding a non-finite number nested in stream:error.error', () => {
      const event = {
        type: 'stream:error',
        error: { message: 'provider failed', code: Number.NaN },
        wireVersion: 1,
        sequence: 0,
      } as unknown as ChatStreamEvent;
      expect(() => encodeChatStreamEvent(event)).toThrow(
        'Invalid chat stream event: stream:error.error is not a valid JSON value',
      );
    });

    test('rejects encoding a non-finite number nested in tool.error.error', () => {
      const event = {
        type: 'tool.error',
        toolCallId: 'call-1',
        toolName: 'lookup',
        error: { message: 'boom', retryAfterMs: Number.POSITIVE_INFINITY },
        wireVersion: 1,
        sequence: 0,
      } as unknown as ChatStreamEvent;
      expect(() => encodeChatStreamEvent(event)).toThrow(
        'Invalid chat stream event: tool.error.error is not a valid JSON value',
      );
    });

    test('never decodes extra properties smuggled onto a nested stream:block-start block', () => {
      const decoded = decodeChatStreamEvent({
        type: 'stream:block-start',
        block: {
          id: 'block-1',
          type: 'text',
          index: 0,
          content: '',
          complete: false,
          providerSecret: 'should-never-survive-decode',
        },
        wireVersion: 1,
        sequence: 0,
      });
      expect(decoded).toEqual({
        type: 'stream:block-start',
        block: { id: 'block-1', type: 'text', index: 0, content: '', complete: false },
        wireVersion: 1,
        sequence: 0,
      });
    });

    test('never decodes extra properties smuggled onto nested stream:complete blocks', () => {
      const decoded = decodeChatStreamEvent({
        type: 'stream:complete',
        state: {
          blocks: [
            {
              id: 'block-1',
              type: 'text',
              index: 0,
              content: 'hi',
              complete: true,
              providerSecret: 'should-never-survive-decode',
            },
          ],
          textContent: 'hi',
          toolCalls: [],
          complete: true,
        },
        wireVersion: 1,
        sequence: 0,
      });
      expect(decoded).toEqual({
        type: 'stream:complete',
        state: {
          blocks: [{ id: 'block-1', type: 'text', index: 0, content: 'hi', complete: true }],
          textContent: 'hi',
          toolCalls: [],
          complete: true,
        },
        wireVersion: 1,
        sequence: 0,
      });
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
      await expect(Array.fromAsync(decodeChatStreamEvents(ndjson))).rejects.toThrow(
        'Invalid chat stream event: frame arrived after the terminal frame',
      );
    });

    test('rejects a second terminal frame following the first', async () => {
      const ndjson =
        encodeChatStreamEvent({ type: 'run.aborted', wireVersion: 1, sequence: 0 }) +
        encodeChatStreamEvent({ type: 'run.aborted', wireVersion: 1, sequence: 1 });
      await expect(Array.fromAsync(decodeChatStreamEvents(ndjson))).rejects.toThrow(
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

// Every case below was raised on review. They share a theme worth naming: the
// encoder's job is to refuse to produce a frame its own decoder would reject,
// because by the time the decoder sees a bad frame the payload has already
// crossed the wire.
describe('encoder refuses to emit frames its decoder would reject', () => {
  const envelope = { wireVersion: 1 as const, sequence: 1 };

  test('rejects an unsupported discriminator instead of emitting "undefined"', () => {
    // A JavaScript caller, or any runtime-cast value, can arrive with a type
    // the union does not contain. Falling through the switch returned
    // `undefined`, and `JSON.stringify(undefined)` is `undefined` — so the
    // encoder emitted the literal frame `undefined\n`.
    const smuggled = { type: 'run.exploded', ...envelope } as unknown as ChatStreamEvent;
    expect(() => encodeChatStreamEvent(smuggled)).toThrow(/unsupported type run\.exploded/);
  });

  test('rejects a run error whose kind or code is outside the vocabulary', () => {
    const base = { name: 'AgentRunError', message: 'boom' };
    const badKind = {
      type: 'run.error',
      error: { ...base, kind: 'meltdown', code: 'UNKNOWN' },
      ...envelope,
    } as unknown as ChatStreamEvent;
    const badCode = {
      type: 'run.error',
      error: { ...base, kind: 'generate', code: 'KABOOM' },
      ...envelope,
    } as unknown as ChatStreamEvent;

    expect(() => encodeChatStreamEvent(badKind)).toThrow(/unsupported run error kind meltdown/);
    expect(() => encodeChatStreamEvent(badCode)).toThrow(/unsupported run error code KABOOM/);
  });

  test('rejects a run error whose name or message is not a string', () => {
    const event = {
      type: 'run.error',
      error: { name: 'AgentRunError', message: 42, kind: 'generate', code: 'UNKNOWN' },
      ...envelope,
    } as unknown as ChatStreamEvent;

    expect(() => encodeChatStreamEvent(event)).toThrow(/name and message must be strings/);
  });

  test('refuses a completed conversation carrying extra top-level fields', () => {
    const conversation = {
      ...createConversationHistory({ id: 'c1' }),
      // Structural typing lets this ride along on an assigned variable.
      providerTrace: { apiKeyHint: 'sk-should-never-cross-the-wire' },
    };
    const event = {
      type: 'run.completed',
      conversation,
      content: 'done',
      usage: { prompt: 1, completion: 1, total: 2 },
      finishReason: 'stop',
      ...envelope,
    } as unknown as ChatStreamEvent;

    // `isConversationHistory` rejects extra top-level keys, not just missing
    // required ones, so validating IS the projection here — the frame never
    // gets built and the metadata never reaches the wire.
    expect(() => encodeChatStreamEvent(event)).toThrow(/not a valid ConversationHistory/);

    const clean = {
      ...event,
      conversation: createConversationHistory({ id: 'c1' }),
    } as unknown as ChatStreamEvent;
    expect(encodeChatStreamEvent(clean)).toContain('"id":"c1"');
  });

  const completedWith = (conversation: unknown): ChatStreamEvent =>
    ({
      type: 'run.completed',
      conversation,
      content: 'done',
      usage: { prompt: 1, completion: 1, total: 2 },
      finishReason: 'stop',
      ...envelope,
    }) as unknown as ChatStreamEvent;

  test('refuses a completed conversation carrying a non-enumerable toJSON hook', () => {
    // A non-enumerable own property is invisible to the strict key check but
    // is exactly what JSON.stringify consults, so the wire would carry the
    // hook's return value instead of the validated history. (Histories are
    // frozen, so the hook goes on an unfrozen structural copy.)
    const conversation = { ...createConversationHistory({ id: 'c1' }) };
    Object.defineProperty(conversation, 'toJSON', {
      value: () => ({ leaked: 'sk-should-never-cross-the-wire' }),
      enumerable: false,
    });
    expect(() => encodeChatStreamEvent(completedWith(conversation))).toThrow(
      'Invalid chat stream event: conversation carries a toJSON serialization hook',
    );
  });

  test('refuses a completed conversation whose prototype carries a toJSON hook', () => {
    const conversation = Object.assign(
      Object.create({ toJSON: () => ({ leaked: 'sk-should-never-cross-the-wire' }) }),
      createConversationHistory({ id: 'c1' }),
    );
    // Either the schema guard (which insists on a plain object) or the
    // projection refuses it — what matters is that the hook never runs.
    expect(() => encodeChatStreamEvent(completedWith(conversation))).toThrow(
      /not a valid ConversationHistory|carries a toJSON serialization hook/,
    );
  });

  test('refuses a toJSON hook nested inside a completed conversation', () => {
    const history = createConversationHistory({ id: 'c1' });
    const conversation = { ...history, metadata: { ...history.metadata } };
    Object.defineProperty(conversation.metadata, 'toJSON', {
      value: () => ({ leaked: 'sk-should-never-cross-the-wire' }),
      enumerable: false,
    });
    expect(() => encodeChatStreamEvent(completedWith(conversation))).toThrow(
      'Invalid chat stream event: conversation.metadata carries a toJSON serialization hook',
    );
  });
});

describe('every JSON-valued payload is projected before serialization', () => {
  const envelope = { wireVersion: 1, sequence: 1 } as const;
  const hooked = (): Record<string, unknown> => {
    const value: Record<string, unknown> = { safe: true };
    Object.defineProperty(value, 'toJSON', {
      value: () => ({ leaked: 'sk-should-never-cross-the-wire' }),
      enumerable: false,
    });
    return value;
  };

  test.each([
    ['tool_call.arguments', { type: 'tool_call', id: 't1', name: 'lookup', arguments: hooked() }],
    [
      'tool result content',
      { type: 'tool_result', callId: 't1', outcome: 'success', content: hooked() },
    ],
    [
      'stream:tool-call-complete.arguments',
      { type: 'stream:tool-call-complete', toolName: 'lookup', blockId: 'b1', arguments: hooked() },
    ],
    ['stream:error.error', { type: 'stream:error', error: hooked() }],
    [
      'tool.error.error',
      { type: 'tool.error', toolCallId: 't1', toolName: 'lookup', error: hooked() },
    ],
  ] as const)('refuses a toJSON hook reachable through %s', (context, event) => {
    expect(() =>
      encodeChatStreamEvent({ ...event, ...envelope } as unknown as ChatStreamEvent),
    ).toThrow(`Invalid chat stream event: ${context} carries a toJSON serialization hook`);
  });

  test('refuses a toJSON hook nested in a pending approval', () => {
    expect(() =>
      encodeChatStreamEvent({
        type: 'tool_result',
        callId: 't1',
        outcome: 'success',
        content: 'ok',
        pendingApproval: { arguments: hooked() },
        ...envelope,
      } as unknown as ChatStreamEvent),
    ).toThrow(
      'Invalid chat stream event: tool result pendingApproval.arguments carries a toJSON serialization hook',
    );
  });

  test('copies arrays by index without calling the producer array methods', () => {
    const hostile = ['safe'];
    Object.defineProperty(hostile, 'map', {
      value: () => {
        const leaked: unknown[] = ['safe'];
        Object.defineProperty(leaked, 'toJSON', {
          value: () => ['sk-should-never-cross-the-wire'],
          enumerable: false,
        });
        return leaked;
      },
      enumerable: false,
    });
    const line = encodeChatStreamEvent({
      type: 'tool_call',
      id: 't1',
      name: 'lookup',
      arguments: { items: hostile },
      ...envelope,
    } as unknown as ChatStreamEvent);
    expect(line).not.toContain('sk-should-never-cross-the-wire');
    expect((JSON.parse(line) as { arguments: { items: unknown[] } }).arguments.items).toEqual([
      'safe',
    ]);
  });

  test('keeps an own __proto__ key as data rather than a prototype assignment', () => {
    const conversation = { ...createConversationHistory({ id: 'c1' }) };
    const metadata: Record<string, unknown> = {};
    Object.defineProperty(metadata, '__proto__', {
      value: { polluted: true },
      enumerable: true,
      writable: true,
      configurable: true,
    });
    (conversation as { metadata: unknown }).metadata = metadata;
    const line = encodeChatStreamEvent({
      type: 'run.completed',
      conversation,
      content: 'done',
      usage: { prompt: 1, completion: 1, total: 2 },
      finishReason: 'stop',
      ...envelope,
    } as unknown as ChatStreamEvent);
    const parsed = JSON.parse(line) as { conversation: { metadata: Record<string, unknown> } };
    expect(Object.hasOwn(parsed.conversation.metadata, '__proto__')).toBe(true);
    expect(parsed.conversation.metadata['__proto__']).toEqual({ polluted: true });
  });
});

describe('typed event iterables are validated frame by frame', () => {
  const collect = async (events: AsyncIterable<ChatStreamEvent>): Promise<ChatStreamEvent[]> => {
    const seen: ChatStreamEvent[] = [];
    for await (const event of guardChatStreamEvents(events)) seen.push(event);
    return seen;
  };

  test('rejects a typed event whose sequence is NaN', async () => {
    async function* events(): AsyncGenerator<ChatStreamEvent> {
      yield { wireVersion: 1, sequence: Number.NaN, type: 'text', text: 'hi' };
      yield { wireVersion: 1, sequence: 1, type: 'run.aborted' };
    }
    await expect(collect(events())).rejects.toThrow(/Invalid chat stream event/);
  });

  test('rejects a typed event that would not decode from the wire', async () => {
    async function* events(): AsyncGenerator<ChatStreamEvent> {
      yield { wireVersion: 1, sequence: 0, type: 'text', text: 42 } as unknown as ChatStreamEvent;
      yield { wireVersion: 1, sequence: 1, type: 'run.aborted' };
    }
    await expect(collect(events())).rejects.toThrow(/Invalid chat stream event/);
  });

  test('passes a well-formed typed stream through unchanged', async () => {
    async function* events(): AsyncGenerator<ChatStreamEvent> {
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
    const seen = await collect(events());
    expect(seen.map((event) => event.type)).toEqual(['text', 'run.completed']);
  });
});

describe('decoder byte handling at EOF', () => {
  test('rejects a stream truncated mid-multibyte after a terminal frame', async () => {
    // The terminal frame and its newline are complete, so the guard is
    // satisfied — but the stream then ends partway through a multibyte
    // character. Those bytes sit inside TextDecoder, not in the line buffer,
    // so without a final flush the truncation is invisible and the stream is
    // accepted as a clean, complete response.
    const terminal = `${JSON.stringify({
      type: 'run.completed',
      conversation: createConversationHistory({ id: 'c1' }),
      content: 'done',
      usage: { prompt: 1, completion: 1, total: 2 },
      finishReason: 'stop',
      wireVersion: 1,
      sequence: 1,
    })}\n`;

    async function* chunks(): AsyncGenerator<Uint8Array> {
      yield new TextEncoder().encode(terminal);
      // First two bytes of a three-byte UTF-8 sequence (U+20AC EURO SIGN).
      yield new Uint8Array([0xe2, 0x82]);
    }

    const collect = async (): Promise<void> => {
      for await (const _event of decodeChatStreamEvents(chunks())) {
        // Drain; the failure is expected at EOF, after the terminal frame.
      }
    };

    // The retained bytes surface as a replacement character, which is not
    // valid JSON — the point is that EOF is rejected rather than silently
    // accepted as a clean, complete stream.
    await expect(collect()).rejects.toThrow();
  });
});

describe('legacy envelope is all-or-nothing at the type level', () => {
  test('accepts a bare legacy member and a fully-enveloped one', () => {
    const bare: ChatStreamEvent = { type: 'text', text: 'x' };
    const enveloped: ChatStreamEvent = { type: 'text', text: 'x', wireVersion: 1, sequence: 1 };

    expect(encodeChatStreamEvent(bare)).toContain('"text":"x"');
    expect(encodeChatStreamEvent(enveloped)).toContain('"wireVersion":1');
  });

  test('rejects a half-envelope at compile time', () => {
    // A plain `T` branch would ACCEPT this: excess-property checking does not
    // reject `wireVersion`, because that property is known to another member
    // of the same union. The `?: never` keys on the bare branch are what make
    // it match neither branch. If this stops erroring, the runtime contract
    // and the public type have silently diverged again.
    // @ts-expect-error — `wireVersion` without `sequence` is not a valid frame.
    const halfVersion: ChatStreamEvent = { type: 'text', text: 'x', wireVersion: 1 };
    // @ts-expect-error — `sequence` without `wireVersion` is not a valid frame.
    const halfSequence: ChatStreamEvent = { type: 'text', text: 'x', sequence: 1 };

    expect(() => encodeChatStreamEvent(halfVersion)).toThrow();
    expect(() => encodeChatStreamEvent(halfSequence)).toThrow();
  });
});

describe('encoder validates primitive fields', () => {
  test('rejects a non-string text on the legacy text member', () => {
    const event = { type: 'text', text: 42 } as unknown as ChatStreamEvent;
    expect(() => encodeChatStreamEvent(event)).toThrow(
      'Invalid chat stream event: text must be a string',
    );
  });

  const envelope = { wireVersion: 1 as const, sequence: 1 };

  test('rejects a non-string content on stream:text-delta', () => {
    const event = {
      type: 'stream:text-delta',
      content: 42,
      accumulated: 'hello',
      ...envelope,
    } as unknown as ChatStreamEvent;

    expect(() => encodeChatStreamEvent(event)).toThrow(/content must be a string/);
  });

  test('rejects an undefined toolName on stream:tool-call-start', () => {
    const event = {
      type: 'stream:tool-call-start',
      toolName: undefined,
      blockId: 'b1',
      ...envelope,
    } as unknown as ChatStreamEvent;

    expect(() => encodeChatStreamEvent(event)).toThrow(/toolName must be a string/);
  });
});

describe('versioned streams must be newline-framed', () => {
  const frame = (sequence: number, extra: Record<string, unknown>): string =>
    JSON.stringify({ wireVersion: 1, sequence, ...extra });

  test('rejects a versioned stream cut immediately after a terminal frame', async () => {
    // The leftover parses cleanly and the terminal-frame guard is satisfied,
    // so only the missing newline distinguishes a complete response from a
    // severed one.
    const terminal = frame(1, {
      type: 'run.aborted',
      reason: 'stopped',
    });

    async function* chunks(): AsyncGenerator<string> {
      yield terminal; // deliberately no trailing newline
    }

    const collect = async (): Promise<void> => {
      for await (const _event of decodeChatStreamEvents(chunks())) {
        // Drain.
      }
    };

    await expect(collect()).rejects.toThrow(/ended mid-frame without a newline/);
  });

  test('accepts the same stream when the terminal frame is newline-framed', async () => {
    async function* chunks(): AsyncGenerator<string> {
      yield `${frame(1, { type: 'run.aborted', reason: 'stopped' })}\n`;
    }

    const seen: ChatStreamEvent[] = [];
    for await (const event of decodeChatStreamEvents(chunks())) seen.push(event);
    expect(seen).toHaveLength(1);
  });

  test('still accepts a bare legacy frame without a trailing newline', async () => {
    async function* chunks(): AsyncGenerator<string> {
      yield JSON.stringify({ type: 'text', text: 'hi' });
    }

    const seen: ChatStreamEvent[] = [];
    for await (const event of decodeChatStreamEvents(chunks())) seen.push(event);
    expect(seen).toEqual([{ type: 'text', text: 'hi' }]);
  });
});

describe('a paused-approval history still encodes as run.completed', () => {
  // Raised on review: `ChatToolResult` carries `pendingApproval`, and the
  // session controller passes the whole result to `appendToolResult` — so the
  // concern was that a controller-owned history contains that extension,
  // which the strict conversation guard would reject, preventing a paused
  // approval run from ever delivering its terminal history.
  //
  // It does not, and this pins why: conversationalist strips `pendingApproval`
  // when it materialises the result into the transcript. The descriptor lives
  // on the wire `tool_result` frame and in the client's own pending-approval
  // map, never in `ConversationHistory`. If that ever changes, this test fails
  // and the projection question genuinely reopens.
  test('conversationalist does not persist pendingApproval into the transcript', () => {
    const history = appendToolCall(
      appendUserMessage(createConversationHistory({ id: 'c1' }), 'hi'),
      {
        id: 'call_1',
        name: 'remember_note',
        arguments: { text: 'x' },
      } as never,
    );

    const withResult = appendToolResult(history, {
      callId: 'call_1',
      outcome: 'action_required',
      content: null,
      action: { type: 'approval', message: 'Save this note?' },
      pendingApproval: {
        toolName: 'remember_note',
        arguments: { text: 'x' },
        approvalToken: 'a'.repeat(64),
      },
    } as never);

    expect(isConversationHistory(withResult)).toBe(true);
    expect(JSON.stringify(withResult)).not.toContain('approvalToken');
  });

  test('encodes run.completed for that history without throwing', () => {
    const history = appendToolCall(
      appendUserMessage(createConversationHistory({ id: 'c1' }), 'hi'),
      {
        id: 'call_1',
        name: 'remember_note',
        arguments: { text: 'x' },
      } as never,
    );

    const withResult = appendToolResult(history, {
      callId: 'call_1',
      outcome: 'action_required',
      content: null,
      action: { type: 'approval', message: 'Save this note?' },
      pendingApproval: {
        toolName: 'remember_note',
        arguments: { text: 'x' },
        approvalToken: 'a'.repeat(64),
      },
    } as never);

    const event = {
      type: 'run.completed',
      conversation: withResult,
      content: 'paused',
      usage: { prompt: 1, completion: 1, total: 2 },
      finishReason: 'stop',
      wireVersion: 1,
      sequence: 1,
    } as unknown as ChatStreamEvent;

    expect(() => encodeChatStreamEvent(event)).not.toThrow();
    expect(encodeChatStreamEvent(event)).not.toContain('approvalToken');
  });
});

describe('encoder mirrors every decoder guard', () => {
  const envelope = { wireVersion: 1 as const, sequence: 1 };
  const block = { id: 'b1', type: 'text', index: 0, content: 'hi', complete: false };

  test('rejects a tool result the decoder would refuse', () => {
    const event = {
      type: 'tool_result',
      callId: 42,
      outcome: 'success',
      content: null,
    } as unknown as ChatStreamEvent;

    expect(() => encodeChatStreamEvent(event)).toThrow(/not a valid ChatToolResult/);
  });

  test('reports the specific nested failure rather than a generic shape error', () => {
    // The structural guard runs last precisely so this message survives.
    const event = {
      type: 'tool_result',
      callId: 'c1',
      outcome: 'success',
      content: { value: Number.POSITIVE_INFINITY },
    } as unknown as ChatStreamEvent;

    expect(() => encodeChatStreamEvent(event)).toThrow(/tool result content/);
  });

  test('rejects block fields the decoder would refuse', () => {
    const badType = {
      type: 'stream:block-start',
      block: { ...block, type: 'hologram' },
      ...envelope,
    } as unknown as ChatStreamEvent;
    const badComplete = {
      type: 'stream:block-start',
      block: { ...block, complete: 'yes' },
      ...envelope,
    } as unknown as ChatStreamEvent;

    expect(() => encodeChatStreamEvent(badType)).toThrow(/unsupported block type hologram/);
    expect(() => encodeChatStreamEvent(badComplete)).toThrow(/block.complete must be a boolean/);
  });

  test('rejects sparse block arrays instead of serializing their holes as null', () => {
    // A sparse array is assignable to a block array but has no element
    // for `.map` to visit; `JSON.stringify` would turn the hole into `null`
    // and the decoder would then refuse the frame the encoder just produced.
    // Built by assigning `length` and by skipping an index, because the
    // literal forms (`new Array(n)`, `[a, , b]`) are lint errors — which is
    // the point: production code cannot write one on purpose, so this guards
    // runtime casts, not authored literals.
    const holes: Array<typeof block> = [];
    holes.length = 1;
    const middleHole: Array<typeof block> = [];
    middleHole[0] = block;
    middleHole[2] = block;
    const sparseBlocks = {
      type: 'stream:complete',
      state: { blocks: holes, textContent: '', toolCalls: [], complete: true },
      ...envelope,
    } as unknown as ChatStreamEvent;
    const sparseToolCalls = {
      type: 'stream:complete',
      state: { blocks: [], textContent: '', toolCalls: middleHole, complete: true },
      ...envelope,
    } as unknown as ChatStreamEvent;

    expect(() => encodeChatStreamEvent(sparseBlocks)).toThrow(/state.blocks\[0\] is missing/);
    expect(() => encodeChatStreamEvent(sparseToolCalls)).toThrow(/state.toolCalls\[1\] is missing/);
  });

  test('rejects a non-array block collection instead of projecting it to []', () => {
    // `{}` has no `length`, so a plain index loop runs zero times and would
    // emit `blocks: []` — a well-formed frame that says something the caller
    // never sent. The decoder already requires a real array; the encoder
    // has to as well.
    const objectBlocks = {
      type: 'stream:complete',
      state: { blocks: {}, textContent: '', toolCalls: [], complete: true },
      ...envelope,
    } as unknown as ChatStreamEvent;
    const stringToolCalls = {
      type: 'stream:complete',
      state: { blocks: [], textContent: '', toolCalls: 'none', complete: true },
      ...envelope,
    } as unknown as ChatStreamEvent;
    const arrayLikeBlocks = {
      type: 'stream:complete',
      state: { blocks: { length: 0 }, textContent: '', toolCalls: [], complete: true },
      ...envelope,
    } as unknown as ChatStreamEvent;

    expect(() => encodeChatStreamEvent(objectBlocks)).toThrow(/state.blocks is not an array/);
    expect(() => encodeChatStreamEvent(stringToolCalls)).toThrow(/state.toolCalls is not an array/);
    expect(() => encodeChatStreamEvent(arrayLikeBlocks)).toThrow(/state.blocks is not an array/);
  });
});

describe('framing is enforced identically for string and streamed sources', () => {
  const terminal = JSON.stringify({
    wireVersion: 1,
    sequence: 1,
    type: 'run.aborted',
    reason: 'stopped',
  });

  test('a string source missing its final newline is rejected', async () => {
    const collect = async (): Promise<void> => {
      for await (const _event of decodeChatStreamEvents(terminal)) {
        // Drain.
      }
    };
    await expect(collect()).rejects.toThrow(/ended mid-frame without a newline/);
  });

  test('the same string source is accepted when newline-framed', async () => {
    const seen: ChatStreamEvent[] = [];
    for await (const event of decodeChatStreamEvents(`${terminal}\n`)) seen.push(event);
    expect(seen).toHaveLength(1);
  });

  test('an unterminated leftover is never yielded before framing is judged', async () => {
    async function* chunks(): AsyncGenerator<string> {
      yield `${JSON.stringify({ wireVersion: 1, sequence: 1, type: 'text', text: 'a' })}\n`;
      yield JSON.stringify({ wireVersion: 1, sequence: 2, type: 'run.aborted' });
    }

    const seen: ChatStreamEvent[] = [];
    await expect(
      (async () => {
        for await (const event of decodeChatStreamEvents(chunks())) seen.push(event);
      })(),
    ).rejects.toThrow(/ended mid-frame without a newline/);

    // The complete first frame is delivered; the truncated second is not.
    expect(seen).toHaveLength(1);
  });
});

describe('framing on the ReadableStream path', () => {
  // The byte-stream branch has its own EOF handling, so the same guarantee
  // needs its own coverage — an async iterable exercises different code.
  const encoder = new TextEncoder();
  const readableOf = (parts: string[]): ReadableStream<Uint8Array> =>
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (const part of parts) controller.enqueue(encoder.encode(part));
        controller.close();
      },
    });

  test('rejects an unterminated leftover and does not yield it', async () => {
    const complete = `${JSON.stringify({ wireVersion: 1, sequence: 1, type: 'text', text: 'a' })}\n`;
    const truncated = JSON.stringify({ wireVersion: 1, sequence: 2, type: 'run.aborted' });

    const seen: ChatStreamEvent[] = [];
    await expect(
      (async () => {
        for await (const event of decodeChatStreamEvents(readableOf([complete, truncated])))
          seen.push(event);
      })(),
    ).rejects.toThrow(/ended mid-frame without a newline/);

    expect(seen).toHaveLength(1);
  });

  test('accepts the same stream when the final frame is newline-framed', async () => {
    const complete = `${JSON.stringify({ wireVersion: 1, sequence: 1, type: 'text', text: 'a' })}\n`;
    const terminal = `${JSON.stringify({ wireVersion: 1, sequence: 2, type: 'run.aborted' })}\n`;

    const seen: ChatStreamEvent[] = [];
    for await (const event of decodeChatStreamEvents(readableOf([complete, terminal])))
      seen.push(event);
    expect(seen).toHaveLength(2);
  });
});

describe('encoder validates stream:complete scalar fields', () => {
  const stateEvent = (overrides: Record<string, unknown>): ChatStreamEvent =>
    ({
      type: 'stream:complete',
      state: { blocks: [], textContent: 'hi', toolCalls: [], complete: true, ...overrides },
      wireVersion: 1,
      sequence: 0,
    }) as unknown as ChatStreamEvent;

  test('rejects an undefined textContent', () => {
    expect(() => encodeChatStreamEvent(stateEvent({ textContent: undefined }))).toThrow(
      'Invalid chat stream event: state.textContent must be a string',
    );
  });

  test('rejects a non-boolean complete', () => {
    expect(() => encodeChatStreamEvent(stateEvent({ complete: 'yes' }))).toThrow(
      'Invalid chat stream event: state.complete must be a boolean',
    );
  });
});

describe('encoder treats present envelope keys as an attempted envelope', () => {
  test('rejects a legacy event whose envelope keys are present but undefined', () => {
    // A runtime cast or a spread of a partial object can leave both keys
    // present with `undefined` values. `readWireEnvelope` rejects that frame
    // on key presence, so the encoder must not quietly downgrade it to bare.
    const event = {
      type: 'text',
      text: 'hi',
      wireVersion: undefined,
      sequence: undefined,
    } as unknown as ChatStreamEvent;
    expect(() => encodeChatStreamEvent(event)).toThrow(
      'Invalid chat stream event: cannot encode a malformed wire envelope',
    );
  });

  test('still encodes a legacy event with no envelope keys at all', () => {
    const encoded = encodeChatStreamEvent({ type: 'text', text: 'hi' });
    expect(JSON.parse(encoded)).toEqual({ type: 'text', text: 'hi' });
  });
});

describe('frames buffered after a terminal frame are rejected before it is yielded', () => {
  const text = (sequence: number): string =>
    JSON.stringify({ wireVersion: 1, sequence, type: 'text', text: 'late' });
  const terminal = JSON.stringify({ wireVersion: 1, sequence: 1, type: 'run.aborted' });

  // A consumer that stops on the terminal frame calls the generator's
  // `return()`, so anything decoded lazily after it is never seen.
  const consumeUntilTerminal = async (
    stream: AsyncIterable<ChatStreamEvent>,
  ): Promise<ChatStreamEvent[]> => {
    const seen: ChatStreamEvent[] = [];
    for await (const event of stream) {
      seen.push(event);
      if (event.type === 'run.aborted') break;
    }
    return seen;
  };

  test('a string source rejects a complete line following the terminal frame', async () => {
    await expect(
      consumeUntilTerminal(decodeChatStreamEvents(`${terminal}\n${text(2)}\n`)),
    ).rejects.toThrow('Invalid chat stream event: frame arrived after the terminal frame');
  });

  test('a string source rejects a partial fragment following the terminal frame', async () => {
    await expect(
      consumeUntilTerminal(decodeChatStreamEvents(`${terminal}\n${text(2)}`)),
    ).rejects.toThrow(/ended mid-frame without a newline/);
  });

  test('a chunked source rejects a complete line following the terminal frame in the same chunk', async () => {
    async function* chunks(): AsyncGenerator<Uint8Array> {
      yield new TextEncoder().encode(`${terminal}\n${text(2)}\n`);
    }
    await expect(consumeUntilTerminal(decodeChatStreamEvents(chunks()))).rejects.toThrow(
      'Invalid chat stream event: frame arrived after the terminal frame',
    );
  });

  test('a chunked source rejects partial bytes following the terminal frame in the same chunk', async () => {
    async function* chunks(): AsyncGenerator<Uint8Array> {
      yield new TextEncoder().encode(`${terminal}\n${text(2)}`);
    }
    await expect(consumeUntilTerminal(decodeChatStreamEvents(chunks()))).rejects.toThrow(
      'Invalid chat stream event: frame arrived after the terminal frame',
    );
  });

  test('a chunked source rejects retained multibyte bytes following the terminal frame', async () => {
    // The trailing bytes are the start of a multibyte sequence, so TextDecoder
    // retains them instead of surfacing them in the line buffer. A consumer
    // stopping on the terminal frame never reaches EOF, so the residue has
    // to be checked before the terminal is yielded.
    async function* chunks(): AsyncGenerator<Uint8Array> {
      yield new Uint8Array([...new TextEncoder().encode(`${terminal}\n`), 0xe2, 0x82]);
    }
    await expect(consumeUntilTerminal(decodeChatStreamEvents(chunks()))).rejects.toThrow(
      /Invalid chat stream event/,
    );
  });

  test('a string chunk arriving while bytes are pending rejects rather than reordering text', async () => {
    // The byte chunk ends inside '€' (0xe2 0x82 0xac). Appending the string
    // first and completing the character afterwards would move the 0xac
    // tail behind the string, so the pending bytes are flushed (and fail the
    // fatal decode) before the string is accepted.
    const encoded = new TextEncoder().encode(
      `${JSON.stringify({ wireVersion: 1, sequence: 0, type: 'text', text: '€' })}\n`,
    );
    const split = encoded.indexOf(0xe2) + 1;
    async function* chunks(): AsyncGenerator<string | Uint8Array> {
      yield encoded.slice(0, split);
      yield new TextDecoder().decode(encoded.slice(split + 2));
      yield encoded.slice(split, split + 2);
      yield `${terminal}\n`;
    }
    await expect(consumeUntilTerminal(decodeChatStreamEvents(chunks()))).rejects.toThrow(
      'Invalid chat stream event: response bytes are not valid UTF-8',
    );
  });

  test('a multibyte character split across chunks before the terminal still decodes', async () => {
    const encoded = new TextEncoder().encode(
      `${JSON.stringify({ wireVersion: 1, sequence: 0, type: 'text', text: '€' })}\n${terminal}\n`,
    );
    const split = encoded.indexOf(0xe2) + 1;
    async function* chunks(): AsyncGenerator<Uint8Array> {
      yield encoded.slice(0, split);
      yield encoded.slice(split);
    }
    const seen = await consumeUntilTerminal(decodeChatStreamEvents(chunks()));
    expect(seen.map((event) => event.type)).toEqual(['text', 'run.aborted']);
  });

  test('a clean terminal frame is still yielded to a consumer that stops on it', async () => {
    const seen = await consumeUntilTerminal(decodeChatStreamEvents(`${text(0)}\n${terminal}\n`));
    expect(seen.map((event) => event.type)).toEqual(['text', 'run.aborted']);
  });
});

describe('string sources validate the final fragment before yielding it', () => {
  test('an unterminated terminal frame is never yielded, even if the consumer stops early', async () => {
    const source = `${JSON.stringify({ wireVersion: 1, sequence: 1, type: 'text', text: 'a' })}\n${JSON.stringify({ wireVersion: 1, sequence: 2, type: 'run.aborted' })}`;

    const seen: ChatStreamEvent[] = [];
    await expect(
      (async () => {
        for await (const event of decodeChatStreamEvents(source)) {
          seen.push(event);
          // A consumer that stops on the first terminal frame it sees.
          if (event.type === 'run.aborted') break;
        }
      })(),
    ).rejects.toThrow(/ended mid-frame without a newline/);

    expect(seen).toHaveLength(1);
  });
});

describe('decoder rejects invalid UTF-8 instead of replacing bytes', () => {
  const encoder = new TextEncoder();
  const corrupt = (): Uint8Array[] => {
    const frame = encoder.encode(
      `${JSON.stringify({ wireVersion: 1, sequence: 1, type: 'text', text: 'ab' })}\n`,
    );
    // Replace the `a` inside the quoted payload with a lone continuation byte.
    const corrupted = new Uint8Array(frame);
    corrupted[frame.indexOf(0x61)] = 0x80;
    const terminal = encoder.encode(
      `${JSON.stringify({ wireVersion: 1, sequence: 2, type: 'run.aborted' })}\n`,
    );
    return [corrupted, terminal];
  };

  test('on the async-iterable path', async () => {
    async function* chunks(): AsyncGenerator<Uint8Array> {
      for (const chunk of corrupt()) yield chunk;
    }
    await expect(Array.fromAsync(decodeChatStreamEvents(chunks()))).rejects.toThrow(
      'Invalid chat stream event: response bytes are not valid UTF-8',
    );
  });

  test('on the ReadableStream path', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of corrupt()) controller.enqueue(chunk);
        controller.close();
      },
    });
    await expect(Array.fromAsync(decodeChatStreamEvents(stream))).rejects.toThrow(
      'Invalid chat stream event: response bytes are not valid UTF-8',
    );
  });

  test('a stream cut mid-multibyte sequence is rejected at EOF', async () => {
    const euro = encoder.encode('€'); // three bytes
    async function* chunks(): AsyncGenerator<Uint8Array> {
      yield encoder.encode(
        `${JSON.stringify({ wireVersion: 1, sequence: 1, type: 'run.aborted' })}\n`,
      );
      yield euro.slice(0, 2);
    }
    await expect(Array.fromAsync(decodeChatStreamEvents(chunks()))).rejects.toThrow(
      'Invalid chat stream event',
    );
  });
});
