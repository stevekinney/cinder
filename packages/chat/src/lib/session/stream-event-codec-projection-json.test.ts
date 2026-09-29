import { describe, expect, test } from 'bun:test';
import { hostileEvent } from './stream-event-codec-test-helpers.ts';
import type { ChatStreamEvent } from './stream-event-codec.ts';
import { decodeChatStreamEvent, encodeChatStreamEvent } from './stream-event-codec.ts';

describe('encode-time field projection (CIN-507)', () => {
  test('rejects encoding a non-finite tool.progress percent', () => {
    const event = hostileEvent({
      type: 'tool.progress',
      toolCallId: 'call-1',
      toolName: 'lookup',
      percent: Number.NaN,
      wireVersion: 1,
      sequence: 0,
    });
    expect(() => encodeChatStreamEvent(event)).toThrow(
      'Invalid chat stream event: tool.progress percent must be finite',
    );
  });

  test('rejects encoding a CIN-507 member with no wire envelope at all', () => {
    const event = hostileEvent({
      type: 'stream:text-delta',
      content: 'h',
      accumulated: 'h',
    });
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
    const frame = encodeChatStreamEvent(hostileEvent(event));
    expect(decodeChatStreamEvent(frame).type).toBe('text');
  });

  test('rejects encoding tool.settled when result.callId disagrees with toolCallId', () => {
    const event = hostileEvent({
      type: 'tool.settled',
      toolCallId: 'call-1',
      toolName: 'lookup',
      result: { callId: 'call-2', outcome: 'success', content: { ok: true } },
      wireVersion: 1,
      sequence: 0,
    });
    expect(() => encodeChatStreamEvent(event)).toThrow(
      'Invalid chat stream event: tool.settled result.callId must equal toolCallId',
    );
  });

  test('rejects encoding non-finite numbers nested in tool_call arguments', () => {
    const event = hostileEvent({
      type: 'tool_call',
      id: 'call-1',
      name: 'lookup',
      arguments: { weights: [1, Number.POSITIVE_INFINITY] },
    });
    expect(() => encodeChatStreamEvent(event)).toThrow(
      'Invalid chat stream event: tool_call.arguments is not a valid JSON value',
    );
  });

  test('rejects encoding non-finite numbers nested in stream:tool-call-complete arguments', () => {
    const event = hostileEvent({
      type: 'stream:tool-call-complete',
      toolName: 'lookup',
      blockId: 'block-1',
      arguments: { nested: { score: Number.NaN } },
      wireVersion: 1,
      sequence: 0,
    });
    expect(() => encodeChatStreamEvent(event)).toThrow(
      'Invalid chat stream event: stream:tool-call-complete.arguments is not a valid JSON value',
    );
  });

  test('rejects encoding a non-finite number nested in tool_result content', () => {
    const event = hostileEvent({
      type: 'tool_result',
      callId: 'call-1',
      outcome: 'success',
      content: { score: Number.POSITIVE_INFINITY },
    });
    expect(() => encodeChatStreamEvent(event)).toThrow(
      'Invalid chat stream event: tool result content is not a valid JSON value',
    );
  });

  test('rejects encoding a non-finite number nested in a tool result error.details', () => {
    const event = hostileEvent({
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
    });
    expect(() => encodeChatStreamEvent(event)).toThrow(
      'Invalid chat stream event: tool result error.details is not a valid JSON value',
    );
  });

  test('rejects encoding a non-finite number nested in a tool result action.schema', () => {
    const event = hostileEvent({
      type: 'tool_result',
      callId: 'call-1',
      outcome: 'action_required',
      content: 'confirm?',
      action: {
        type: 'input',
        message: 'confirm?',
        schema: { threshold: Number.POSITIVE_INFINITY },
      },
    });
    expect(() => encodeChatStreamEvent(event)).toThrow(
      'Invalid chat stream event: tool result action.schema is not a valid JSON value',
    );
  });

  test('preserves declared approval fields and strips undeclared action fields', () => {
    const event = hostileEvent({
      type: 'tool_result',
      callId: 'call-approval',
      outcome: 'action_required',
      content: 'Approve external operation?',
      action: {
        type: 'approval',
        message: 'Approve external operation?',
        risk: 'low',
        operation: {
          kind: 'other',
          filesTouched: [
            'components/chat/src/lib/session/stream-event-codec-projection-json.test.ts',
          ],
          argsPreview: { target: 'external-system' },
          providerSecret: 'strip-operation-field',
        },
        sandbox: {
          provider: 'codex',
          name: 'read-only',
          workingDir: '/Users/stevekinney/Developer/corvidae',
          providerSecret: 'strip-sandbox-field',
        },
        env: ['TZ=UTC'],
        snapshotId: 'snapshot-projection',
        expiresAt: '2026-09-19T21:00:00Z',
        editableArgs: false,
        policyVersion: 'approval-policy:projection',
        idempotencyKey: 'approval-codec-projection',
        providerSecret: 'strip-action-field',
      },
    });

    expect(decodeChatStreamEvent(encodeChatStreamEvent(event))).toEqual({
      type: 'tool_result',
      callId: 'call-approval',
      outcome: 'action_required',
      content: 'Approve external operation?',
      action: {
        type: 'approval',
        message: 'Approve external operation?',
        risk: 'low',
        operation: {
          kind: 'other',
          filesTouched: [
            'components/chat/src/lib/session/stream-event-codec-projection-json.test.ts',
          ],
          argsPreview: { target: 'external-system' },
        },
        sandbox: {
          provider: 'codex',
          name: 'read-only',
          workingDir: '/Users/stevekinney/Developer/corvidae',
        },
        env: ['TZ=UTC'],
        snapshotId: 'snapshot-projection',
        expiresAt: '2026-09-19T21:00:00Z',
        editableArgs: false,
        policyVersion: 'approval-policy:projection',
        idempotencyKey: 'approval-codec-projection',
      },
    });
  });

  test('keeps input actions input-only when runtime data includes approval fields', () => {
    const event = hostileEvent({
      type: 'tool_result',
      callId: 'call-input',
      outcome: 'action_required',
      content: 'Need a threshold',
      action: {
        type: 'input',
        message: 'Need a threshold',
        schema: { type: 'object', properties: { threshold: { type: 'number' } } },
        risk: 'high',
        operation: { kind: 'other', argsPreview: { threshold: 5 } },
        policyVersion: 'approval-policy:input',
        idempotencyKey: 'approval-codec-input',
      },
    });

    expect(decodeChatStreamEvent(encodeChatStreamEvent(event))).toEqual({
      type: 'tool_result',
      callId: 'call-input',
      outcome: 'action_required',
      content: 'Need a threshold',
      action: {
        type: 'input',
        message: 'Need a threshold',
        schema: { type: 'object', properties: { threshold: { type: 'number' } } },
      },
    });
  });

  test('encodes the approval action snapshot it validated when getters answer differently', () => {
    const operations = [
      {
        kind: 'other',
        get argsPreview() {
          return { read: 'once' };
        },
      },
      { kind: 'other', argsPreview: { score: Number.NaN } },
    ];
    const action = {
      type: 'approval',
      message: 'Approve getter-backed operation?',
      risk: 'high',
      policyVersion: 'approval-policy:getters',
      idempotencyKey: 'approval-codec-getters',
    } as Record<string, unknown>;
    Object.defineProperty(action, 'operation', {
      enumerable: true,
      get: () => operations.shift() ?? operations[0],
    });
    const event = hostileEvent({
      type: 'tool_result',
      callId: 'call-getter',
      outcome: 'action_required',
      content: 'Approve getter-backed operation?',
      action,
    });

    const decoded = decodeChatStreamEvent(encodeChatStreamEvent(event));
    expect(decoded).toEqual({
      type: 'tool_result',
      callId: 'call-getter',
      outcome: 'action_required',
      content: 'Approve getter-backed operation?',
      action: {
        type: 'approval',
        message: 'Approve getter-backed operation?',
        risk: 'high',
        operation: { kind: 'other', argsPreview: { read: 'once' } },
        policyVersion: 'approval-policy:getters',
        idempotencyKey: 'approval-codec-getters',
      },
    });
  });

  test('rejects encoding a non-finite number nested in a tool result pendingApproval', () => {
    const event = hostileEvent({
      type: 'tool_result',
      callId: 'call-approval',
      outcome: 'action_required',
      content: 'confirm?',
      pendingApproval: { callId: 'call-approval', arguments: { weight: Number.NaN } },
    });
    expect(() => encodeChatStreamEvent(event)).toThrow(
      'Invalid chat stream event: tool result pendingApproval is not a valid JSON value',
    );
  });

  test('rejects encoding a stream block with a negative index', () => {
    const event = hostileEvent({
      type: 'stream:block-start',
      block: { id: 'block-1', type: 'text', index: -1, content: '', complete: false },
      wireVersion: 1,
      sequence: 0,
    });
    expect(() => encodeChatStreamEvent(event)).toThrow(
      'Invalid chat stream event: block index must be a non-negative safe integer',
    );
  });

  test('rejects encoding a nested stream:complete block with a non-finite index', () => {
    const event = hostileEvent({
      type: 'stream:complete',
      state: {
        blocks: [{ id: 'block-1', type: 'text', index: Number.NaN, content: '', complete: false }],
        textContent: '',
        toolCalls: [],
        complete: true,
      },
      wireVersion: 1,
      sequence: 0,
    });
    expect(() => encodeChatStreamEvent(event)).toThrow(
      'Invalid chat stream event: block index must be a non-negative safe integer',
    );
  });

  test('rejects encoding a non-finite stream:usage value', () => {
    const event = hostileEvent({
      type: 'stream:usage',
      usage: { prompt: 1, completion: Number.NaN, total: 1 },
      wireVersion: 1,
      sequence: 0,
    });
    expect(() => encodeChatStreamEvent(event)).toThrow(
      'Invalid chat stream event: usage is not a valid TokenUsage',
    );
  });

  test('rejects encoding a non-finite run.completed usage value', () => {
    const event = hostileEvent({
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
    });
    expect(() => encodeChatStreamEvent(event)).toThrow(
      'Invalid chat stream event: usage is not a valid TokenUsage',
    );
  });

  test('rejects encoding a non-finite number nested in stream:error.error', () => {
    const event = hostileEvent({
      type: 'stream:error',
      error: { message: 'provider failed', code: Number.NaN },
      wireVersion: 1,
      sequence: 0,
    });
    expect(() => encodeChatStreamEvent(event)).toThrow(
      'Invalid chat stream event: stream:error.error is not a valid JSON value',
    );
  });

  test('rejects encoding a non-finite number nested in tool.error.error', () => {
    const event = hostileEvent({
      type: 'tool.error',
      toolCallId: 'call-1',
      toolName: 'lookup',
      error: { message: 'boom', retryAfterMs: Number.POSITIVE_INFINITY },
      wireVersion: 1,
      sequence: 0,
    });
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
