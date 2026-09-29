import { describe, expect, test } from 'bun:test';
import { hostileEvent } from './stream-event-codec-test-helpers.ts';
import { decodeChatStreamEvent, encodeChatStreamEvent } from './stream-event-codec.ts';

const completeApprovalAction = {
  type: 'approval' as const,
  message: 'Approve file write?',
  risk: 'medium' as const,
  operation: {
    kind: 'file-write' as const,
    filesTouched: ['components/chat/src/lib/session/stream-event-codec-tool-events.test.ts'],
    argsPreview: { bytes: 512, overwrite: false },
  },
  sandbox: {
    provider: 'codex',
    name: 'workspace-write',
    workingDir: '/Users/stevekinney/Developer/corvidae/components/chat',
  },
  env: ['TZ=UTC'],
  snapshotId: 'snapshot-tool-settled',
  expiresAt: '2026-09-19T13:00:00Z',
  editableArgs: false,
  policyVersion: 'approval-policy:tool-settled',
  idempotencyKey: 'approval-codec-tool-settled',
};

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
    const event = hostileEvent({
      type: 'stream:usage',
      usage,
      wireVersion: 1,
      sequence: 3,
    });
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
        action: {
          type: 'approval' as const,
          message: 'Save this note?',
          risk: 'high' as const,
          operation: {
            kind: 'command' as const,
            command: 'echo approval',
            argsPreview: { ok: true },
          },
          policyVersion: 'test-policy',
          idempotencyKey: 'test-approval',
        },
      },
      wireVersion: 1 as const,
      sequence: 2,
    };
    expect(decodeChatStreamEvent(encodeChatStreamEvent(event))).toEqual(event);
  });

  test('preserves complete approval metadata on a nested tool.settled result', () => {
    const event = {
      type: 'tool.settled' as const,
      toolCallId: 'call-1',
      toolName: 'write_file',
      result: {
        callId: 'call-1',
        outcome: 'action_required' as const,
        content: 'Approve file write?',
        action: completeApprovalAction,
      },
      wireVersion: 1 as const,
      sequence: 3,
    };

    expect(decodeChatStreamEvent(encodeChatStreamEvent(event))).toEqual(event);
  });

  test('rejects malformed nested approval array metadata before encoding', () => {
    const event = hostileEvent({
      type: 'tool.settled',
      toolCallId: 'call-1',
      toolName: 'write_file',
      result: {
        callId: 'call-1',
        outcome: 'action_required',
        content: 'Approve file write?',
        action: {
          ...completeApprovalAction,
          env: ['TZ=UTC', false],
          operation: {
            ...completeApprovalAction.operation,
            filesTouched: ['file.ts', null],
          },
        },
      },
      wireVersion: 1,
      sequence: 4,
    });

    expect(() => encodeChatStreamEvent(event)).toThrow(
      /action\.operation\.filesTouched\[1\] must be a string/,
    );
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
    expect(() => encodeChatStreamEvent(hostileEvent(event))).not.toThrow();
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
    const decoded = decodeChatStreamEvent(encodeChatStreamEvent(hostileEvent(other)));
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
    const decoded = decodeChatStreamEvent(encodeChatStreamEvent(hostileEvent(event)));
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
