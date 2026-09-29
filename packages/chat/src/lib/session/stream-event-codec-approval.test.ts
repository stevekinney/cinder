import { describe, expect, test } from 'bun:test';
import {
  appendToolCall,
  appendToolResult,
  appendUserMessage,
  createConversationHistory,
  isConversationHistory,
} from 'conversationalist';
import { hostileEvent } from './stream-event-codec-test-helpers.ts';
import { encodeChatStreamEvent } from './stream-event-codec.ts';

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
      },
    );

    const result = {
      callId: 'call_1',
      outcome: 'action_required' as const,
      content: null,
      action: {
        type: 'approval' as const,
        message: 'Save this note?',
        risk: 'high',
        operation: { kind: 'command', command: 'echo approval', argsPreview: { ok: true } },
        policyVersion: 'test-policy',
        idempotencyKey: 'test-approval',
      },
    };
    Object.defineProperty(result, 'pendingApproval', {
      value: { toolName: 'remember_note', arguments: { text: 'x' }, approvalToken: 'a'.repeat(64) },
      enumerable: true,
    });
    const withResult = appendToolResult(history, result);

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
      },
    );

    const result = {
      callId: 'call_1',
      outcome: 'action_required' as const,
      content: null,
      action: {
        type: 'approval' as const,
        message: 'Save this note?',
        risk: 'high',
        operation: { kind: 'command', command: 'echo approval', argsPreview: { ok: true } },
        policyVersion: 'test-policy',
        idempotencyKey: 'test-approval',
      },
    };
    Object.defineProperty(result, 'pendingApproval', {
      value: { toolName: 'remember_note', arguments: { text: 'x' }, approvalToken: 'a'.repeat(64) },
      enumerable: true,
    });
    const withResult = appendToolResult(history, result);

    const event = hostileEvent({
      type: 'run.completed',
      conversation: withResult,
      content: 'paused',
      usage: { prompt: 1, completion: 1, total: 2 },
      finishReason: 'stop',
      wireVersion: 1,
      sequence: 1,
    });

    expect(() => encodeChatStreamEvent(event)).not.toThrow();
    expect(encodeChatStreamEvent(event)).not.toContain('approvalToken');
  });
});
