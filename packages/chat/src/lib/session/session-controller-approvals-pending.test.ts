import { throwingRejectionOf } from '@lostgradient/testing';
import { describe, expect, test } from 'bun:test';
import {
  appendToolCall,
  appendToolResult,
  appendUserMessage,
  createConversationHistory,
} from '../components/chat/builders.ts';
import type {
  ConversationHistory,
  ToolAction,
  ToolResult,
} from '../components/chat/conversation-model.ts';
import { createChatSessionController } from './session-controller.ts';
import type { ChatStreamEvent } from './stream-event-codec.ts';

async function* events(values: ChatStreamEvent[]): AsyncGenerator<ChatStreamEvent> {
  yield* values;
}

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
};

function deferred<T>(): Deferred<T> {
  let resolveDeferred!: (value: T) => void;
  let rejectDeferred!: (error: unknown) => void;
  const promise = new Promise<T>((resolve, reject) => {
    resolveDeferred = resolve;
    rejectDeferred = reject;
  });
  return { promise, resolve: resolveDeferred, reject: rejectDeferred };
}

function approvalAction(
  overrides: Partial<Extract<ToolAction, { type: 'approval' }>> = {},
): Extract<ToolAction, { type: 'approval' }> {
  return {
    type: 'approval',
    message: 'Approve this tool call',
    risk: 'high',
    operation: { kind: 'command', command: 'echo approval', argsPreview: { ok: true } },
    policyVersion: 'test-policy',
    idempotencyKey: 'test-approval',
    ...overrides,
  };
}

function approvalConversation(
  id: string,
  action: Extract<ToolAction, { type: 'approval' }> = approvalAction(),
): ConversationHistory {
  return appendToolResult(
    appendToolCall(appendUserMessage(createConversationHistory({ id }), 'write'), {
      id: 'call',
      name: 'write',
      arguments: {},
    }),
    {
      callId: 'call',
      outcome: 'action_required',
      content: null,
      action,
    },
  );
}

function currentToolResult(history: ConversationHistory): ToolResult | undefined {
  return Object.values(history.messages).find(
    (message) => message.role === 'tool-result' && message.toolResult?.callId === 'call',
  )?.toolResult;
}

describe('chat session controller', () => {
  test('continues after a tool result and invokes approval hooks', async () => {
    let conversation = createConversationHistory({ id: 'tools' });
    let calls = 0;
    let approved = '';
    const controller = createChatSessionController({
      getConversation: () => conversation,
      setConversation: (next) => {
        conversation = next;
      },
      transport: async () => {
        calls += 1;
        return calls === 1
          ? events([
              { type: 'tool_call', id: 'call', name: 'read', arguments: {} },
              { type: 'tool_result', callId: 'call', outcome: 'success', content: 'ok' },
            ])
          : events([{ type: 'text', text: 'done' }]);
      },
      hooks: {
        resolveToolApproval: async (id) => {
          approved = id;
          return undefined;
        },
      },
    });
    await controller.adapter.sendMessage({ role: 'user', content: 'run' }, []);
    expect(calls).toBe(2);
    expect(approved).toBe('');
    expect(Object.values(conversation.messages).some((message) => message.content === 'done')).toBe(
      true,
    );
  });

  test('waits for approval before continuing a tool turn', async () => {
    let conversation = createConversationHistory({ id: 'approval' });
    let calls = 0;
    const controller = createChatSessionController({
      getConversation: () => conversation,
      setConversation: (next) => {
        conversation = next;
      },
      transport: async () => {
        calls += 1;
        return calls === 1
          ? events([
              { type: 'tool_call', id: 'call', name: 'write', arguments: {} },
              {
                type: 'tool_result',
                callId: 'call',
                outcome: 'action_required',
                content: null,
                action: {
                  type: 'approval',
                  message: 'Approve this tool call',
                  risk: 'high',
                  operation: {
                    kind: 'command',
                    command: 'echo approval',
                    argsPreview: { ok: true },
                  },
                  policyVersion: 'test-policy',
                  idempotencyKey: 'test-approval',
                },
              },
            ])
          : events([{ type: 'text', text: 'approved' }]);
      },
      hooks: {
        resolveToolApproval: async (toolCallId) => ({
          callId: toolCallId,
          outcome: 'success',
          content: 'allowed',
        }),
      },
    });
    await controller.adapter.sendMessage({ role: 'user', content: 'write' }, []);
    expect(calls).toBe(1);
    await controller.adapter.resolveToolApproval?.('call', {
      decision: 'approve',
      remember: false,
    });
    expect(calls).toBe(2);
    expect(
      Object.values(conversation.messages).some((message) => message.content === 'approved'),
    ).toBe(true);
  });

  test('forwards approve_with_edits payload unchanged and continues exactly once', async () => {
    let conversation = appendToolResult(
      appendToolCall(
        appendUserMessage(createConversationHistory({ id: 'approval-edits' }), 'write'),
        { id: 'call', name: 'write', arguments: { text: 'before' } },
      ),
      {
        callId: 'call',
        outcome: 'action_required',
        content: null,
        action: {
          type: 'approval',
          risk: 'high',
          operation: { kind: 'command', command: 'echo approval', argsPreview: { text: 'before' } },
          policyVersion: 'test-policy',
          idempotencyKey: 'test-approval',
          editableArgs: true,
        },
      },
    );
    const resolutions: unknown[] = [];
    let continuations = 0;
    const controller = createChatSessionController({
      getConversation: () => conversation,
      setConversation: (next) => {
        conversation = next;
      },
      transport: async () => {
        continuations += 1;
        return events([{ type: 'text', text: 'continued after edits' }]);
      },
      hooks: {
        resolveToolApproval: async (toolCallId, resolution) => {
          resolutions.push({ toolCallId, resolution });
          return { callId: toolCallId, outcome: 'success', content: { saved: true } };
        },
      },
    });

    await controller.adapter.resolveToolApproval?.('call', {
      decision: 'approve_with_edits',
      editedArgs: { text: 'after' },
      remember: true,
      reason: 'fix argument',
    });

    expect(resolutions).toEqual([
      {
        toolCallId: 'call',
        resolution: {
          decision: 'approve_with_edits',
          editedArgs: { text: 'after' },
          remember: true,
          reason: 'fix argument',
        },
      },
    ]);
    expect(continuations).toBe(1);
  });

  test('forwards cancel payload unchanged exactly once', async () => {
    let conversation = appendToolResult(
      appendToolCall(
        appendUserMessage(createConversationHistory({ id: 'approval-cancel' }), 'write'),
        { id: 'call', name: 'write', arguments: {} },
      ),
      {
        callId: 'call',
        outcome: 'action_required',
        content: null,
        action: {
          type: 'approval',
          risk: 'high',
          operation: { kind: 'command', command: 'echo approval', argsPreview: { ok: true } },
          policyVersion: 'test-policy',
          idempotencyKey: 'test-approval',
        },
      },
    );
    const resolutions: unknown[] = [];
    const controller = createChatSessionController({
      getConversation: () => conversation,
      setConversation: (next) => {
        conversation = next;
      },
      transport: async () => events([]),
      hooks: {
        resolveToolApproval: async (toolCallId, resolution) => {
          resolutions.push({ toolCallId, resolution });
          return {
            callId: toolCallId,
            outcome: 'error',
            content: null,
            error: {
              code: 'CANCELLED',
              category: 'permission',
              retryable: false,
              message: 'Cancelled',
            },
          };
        },
      },
    });

    await controller.adapter.resolveToolApproval?.('call', {
      decision: 'cancel',
      reason: 'not now',
      remember: false,
    });

    expect(resolutions).toEqual([
      {
        toolCallId: 'call',
        resolution: { decision: 'cancel', reason: 'not now', remember: false },
      },
    ]);
  });

  test('blocks a fresh send while an approval is pending', async () => {
    let conversation = createConversationHistory({ id: 'approval-send-branch' });
    let calls = 0;
    const controller = createChatSessionController({
      getConversation: () => conversation,
      setConversation: (next) => {
        conversation = next;
      },
      transport: async () => {
        calls += 1;
        return events([
          { type: 'tool_call', id: 'call', name: 'write', arguments: {} },
          {
            type: 'tool_result',
            callId: 'call',
            outcome: 'action_required',
            content: null,
            action: {
              type: 'approval',
              risk: 'high',
              operation: { kind: 'command', command: 'echo approval', argsPreview: { ok: true } },
              policyVersion: 'test-policy',
              idempotencyKey: 'test-approval',
            },
          },
        ]);
      },
      hooks: {
        resolveToolApproval: async () => ({
          callId: 'call',
          outcome: 'success',
          content: 'allowed',
        }),
      },
    });
    await controller.adapter.sendMessage({ role: 'user', content: 'write' }, []);
    const before = conversation;

    await Promise.resolve(
      expect(
        await throwingRejectionOf(
          controller.adapter.sendMessage({ role: 'user', content: 'new branch' }, []),
        ),
      ).toThrow('approval'),
    );
    expect(calls).toBe(1);
    expect(conversation).toBe(before);
  });

  test('keeps a repeated approval request pending and reports that state to Chat', async () => {
    let conversation = appendToolResult(
      appendToolCall(
        appendUserMessage(createConversationHistory({ id: 'repeated-approval' }), 'deploy'),
        { id: 'call', name: 'deploy', arguments: {} },
      ),
      {
        callId: 'call',
        outcome: 'action_required',
        content: null,
        action: {
          type: 'approval',
          message: 'Approve staging?',
          risk: 'high',
          operation: { kind: 'command', command: 'echo approval', argsPreview: { ok: true } },
          policyVersion: 'test-policy',
          idempotencyKey: 'test-approval',
        },
      },
    );
    const controller = createChatSessionController({
      getConversation: () => conversation,
      setConversation: (next) => {
        conversation = next;
      },
      transport: async () => events([]),
      hooks: {
        resolveToolApproval: async (callId) => ({
          callId,
          outcome: 'action_required',
          content: null,
          action: {
            type: 'approval',
            message: 'Approve production?',
            risk: 'high',
            operation: { kind: 'command', command: 'echo approval', argsPreview: { ok: true } },
            policyVersion: 'test-policy',
            idempotencyKey: 'test-approval',
          },
        }),
      },
    });

    await Promise.resolve(
      expect(
        await controller.adapter.resolveToolApproval?.('call', {
          decision: 'approve',
          remember: false,
        }),
      ).toBe('pending'),
    );
    expect(
      Object.values(conversation.messages).find(
        (message) => message.role === 'tool-result' && message.toolResult?.callId === 'call',
      )?.toolResult?.action,
    ).toMatchObject({ type: 'approval', message: 'Approve production?' });
  });

  test('keeps a repeated denial request pending and reports that state to Chat', async () => {
    let conversation = appendToolResult(
      appendToolCall(
        appendUserMessage(createConversationHistory({ id: 'repeated-denial' }), 'deploy'),
        { id: 'call', name: 'deploy', arguments: {} },
      ),
      {
        callId: 'call',
        outcome: 'action_required',
        content: null,
        action: {
          type: 'approval',
          message: 'Approve staging?',
          risk: 'high',
          operation: { kind: 'command', command: 'echo approval', argsPreview: { ok: true } },
          policyVersion: 'test-policy',
          idempotencyKey: 'test-approval',
        },
      },
    );
    const controller = createChatSessionController({
      getConversation: () => conversation,
      setConversation: (next) => {
        conversation = next;
      },
      transport: async () => events([]),
      hooks: {
        resolveToolApproval: async (callId) => ({
          callId,
          outcome: 'action_required',
          content: null,
          action: {
            type: 'approval',
            message: 'Request an exception?',
            risk: 'high',
            operation: { kind: 'command', command: 'echo approval', argsPreview: { ok: true } },
            policyVersion: 'test-policy',
            idempotencyKey: 'test-approval',
          },
        }),
      },
    });

    await Promise.resolve(
      expect(
        await controller.adapter.resolveToolApproval?.('call', {
          decision: 'deny',
          remember: false,
        }),
      ).toBe('pending'),
    );
    expect(
      Object.values(conversation.messages).find(
        (message) => message.role === 'tool-result' && message.toolResult?.callId === 'call',
      )?.toolResult?.action,
    ).toMatchObject({ type: 'approval', message: 'Request an exception?' });
  });

  test('drops a stale approval success after invalidation without continuing', async () => {
    let conversation = approvalConversation('approval-invalidated');
    const hookResult = deferred<ToolResult>();
    let continuations = 0;
    const controller = createChatSessionController({
      getConversation: () => conversation,
      setConversation: (next) => {
        conversation = next;
      },
      transport: async () => {
        continuations += 1;
        return events([{ type: 'text', text: 'should not continue' }]);
      },
      hooks: {
        resolveToolApproval: async () => hookResult.promise,
      },
    });

    const resolution = controller.adapter.resolveToolApproval?.('call', {
      decision: 'approve',
      remember: false,
    });
    controller.invalidate();
    hookResult.resolve({ callId: 'call', outcome: 'success', content: 'allowed' });

    expect(await resolution).toBe('pending');
    expect(currentToolResult(conversation)?.outcome).toBe('action_required');
    expect(continuations).toBe(0);
  });

  test('drops a stale approval failure after invalidation without reporting an error', async () => {
    let conversation = approvalConversation('approval-invalidated-failure');
    const hookResult = deferred<ToolResult>();
    const errors: unknown[] = [];
    const controller = createChatSessionController({
      getConversation: () => conversation,
      setConversation: (next) => {
        conversation = next;
      },
      transport: async () => events([]),
      hooks: {
        resolveToolApproval: async () => hookResult.promise,
        onError: (error) => errors.push(error),
      },
    });

    const resolution = controller.adapter.resolveToolApproval?.('call', {
      decision: 'approve',
      remember: false,
    });
    controller.invalidate();
    hookResult.reject(new Error('old owner failed'));

    expect(await resolution).toBe('pending');
    expect(errors).toEqual([]);
    expect(currentToolResult(conversation)?.outcome).toBe('action_required');
  });

  test('does not let a stale approval success replace a reused tool call id', async () => {
    let conversation = approvalConversation(
      'approval-reused-id',
      approvalAction({
        message: 'Approve first request',
        idempotencyKey: 'test-approval-1',
      }),
    );
    const hookResult = deferred<ToolResult>();
    let continuations = 0;
    const replacementAction = approvalAction({
      message: 'Approve replacement request',
      idempotencyKey: 'test-approval-2',
      operation: { kind: 'other', argsPreview: { replacement: true } },
    });
    const controller = createChatSessionController({
      getConversation: () => conversation,
      setConversation: (next) => {
        conversation = next;
      },
      transport: async () => {
        continuations += 1;
        return events([{ type: 'text', text: 'should not continue' }]);
      },
      hooks: {
        resolveToolApproval: async () => hookResult.promise,
      },
    });

    const resolution = controller.adapter.resolveToolApproval?.('call', {
      decision: 'approve',
      remember: false,
    });
    conversation = approvalConversation('approval-reused-id', replacementAction);
    hookResult.resolve({ callId: 'call', outcome: 'success', content: 'allowed' });

    expect(await resolution).toBe('pending');
    expect(currentToolResult(conversation)?.action).toEqual(replacementAction);
    expect(continuations).toBe(0);
  });

  test('rejects a mismatched approval result without mutating the pending result', async () => {
    let conversation = approvalConversation('approval-mismatched-result');
    let hookCalls = 0;
    const controller = createChatSessionController({
      getConversation: () => conversation,
      setConversation: (next) => {
        conversation = next;
      },
      transport: async () => events([]),
      hooks: {
        resolveToolApproval: async () => {
          hookCalls += 1;
          return { callId: 'other-call', outcome: 'success', content: 'wrong call' };
        },
      },
    });

    expect(
      await throwingRejectionOf(
        controller.adapter.resolveToolApproval?.('call', { decision: 'approve', remember: false }),
      ),
    ).toThrow('different tool call');
    expect(hookCalls).toBe(1);
    expect(currentToolResult(conversation)?.outcome).toBe('action_required');
  });

  test('rejects duplicate terminal approval resolutions before invoking the hook again', async () => {
    let conversation = approvalConversation('approval-duplicate-terminal');
    let hookCalls = 0;
    const controller = createChatSessionController({
      getConversation: () => conversation,
      setConversation: (next) => {
        conversation = next;
      },
      transport: async () => events([]),
      hooks: {
        resolveToolApproval: async (toolCallId) => {
          hookCalls += 1;
          return { callId: toolCallId, outcome: 'success', content: 'allowed' };
        },
      },
    });

    expect(
      await controller.adapter.resolveToolApproval?.('call', {
        decision: 'approve',
        remember: false,
      }),
    ).toBe('resolved');
    expect(
      await throwingRejectionOf(
        controller.adapter.resolveToolApproval?.('call', { decision: 'deny', remember: false }),
      ),
    ).toThrow('not pending');
    expect(hookCalls).toBe(1);
    expect(currentToolResult(conversation)?.outcome).toBe('success');
  });

  test('rejects missing current approvals before invoking the hook', async () => {
    let conversation = createConversationHistory({ id: 'approval-missing-current' });
    let hookCalls = 0;
    const controller = createChatSessionController({
      getConversation: () => conversation,
      setConversation: (next) => {
        conversation = next;
      },
      transport: async () => events([]),
      hooks: {
        resolveToolApproval: async (toolCallId) => {
          hookCalls += 1;
          return { callId: toolCallId, outcome: 'success', content: 'allowed' };
        },
      },
    });

    expect(
      await throwingRejectionOf(
        controller.adapter.resolveToolApproval?.('call', { decision: 'approve', remember: false }),
      ),
    ).toThrow('not pending');
    expect(hookCalls).toBe(0);
  });

  test('drops an approval success whose request left the conversation while the hook ran', async () => {
    let conversation = approvalConversation('approval-removed-mid-hook');
    const hookResult = deferred<ToolResult>();
    let continuations = 0;
    const controller = createChatSessionController({
      getConversation: () => conversation,
      setConversation: (next) => {
        conversation = next;
      },
      transport: async () => {
        continuations += 1;
        return events([{ type: 'text', text: 'should not continue' }]);
      },
      hooks: {
        resolveToolApproval: async () => hookResult.promise,
      },
    });

    const resolution = controller.adapter.resolveToolApproval?.('call', {
      decision: 'approve',
      remember: false,
    });
    conversation = appendUserMessage(
      createConversationHistory({ id: 'approval-removed-mid-hook' }),
      'write',
    );
    hookResult.resolve({ callId: 'call', outcome: 'success', content: 'allowed' });

    expect(await resolution).toBe('pending');
    expect(currentToolResult(conversation)).toBeUndefined();
    expect(continuations).toBe(0);
  });

  test('rejects a pending input request as an approval before invoking the hook', async () => {
    let conversation = appendToolResult(
      appendToolCall(
        appendUserMessage(createConversationHistory({ id: 'approval-input-action' }), 'write'),
        { id: 'call', name: 'write', arguments: {} },
      ),
      {
        callId: 'call',
        outcome: 'action_required',
        content: null,
        action: { type: 'input', message: 'Which file?' },
      },
    );
    let hookCalls = 0;
    const controller = createChatSessionController({
      getConversation: () => conversation,
      setConversation: (next) => {
        conversation = next;
      },
      transport: async () => events([]),
      hooks: {
        resolveToolApproval: async (toolCallId) => {
          hookCalls += 1;
          return { callId: toolCallId, outcome: 'success', content: 'allowed' };
        },
      },
    });

    expect(
      await throwingRejectionOf(
        controller.adapter.resolveToolApproval?.('call', { decision: 'approve', remember: false }),
      ),
    ).toThrow('without a current approval action');
    expect(hookCalls).toBe(0);
    expect(currentToolResult(conversation)?.outcome).toBe('action_required');
  });

  test('rejects an approval whose action cannot be fingerprinted before invoking the hook', async () => {
    // The builders bound every preview to a string, so only a history the host
    // assembled itself can carry an action that JSON cannot serialize.
    const cyclicPreview: Record<string, unknown> = {};
    cyclicPreview['self'] = cyclicPreview;
    const built = approvalConversation('approval-unserializable-action');
    const resultId = built.ids.find((id) => built.messages[id]?.role === 'tool-result')!;
    const builtResult = built.messages[resultId]!.toolResult!;
    const unserializableAction = {
      ...approvalAction(),
      operation: { kind: 'command', command: 'echo approval', argsPreview: cyclicPreview },
    } as unknown as ToolAction;
    let conversation: ConversationHistory = {
      ...built,
      messages: {
        ...built.messages,
        [resultId]: {
          ...built.messages[resultId]!,
          toolResult: { ...builtResult, action: unserializableAction },
        },
      },
    };
    let hookCalls = 0;
    const controller = createChatSessionController({
      getConversation: () => conversation,
      setConversation: (next) => {
        conversation = next;
      },
      transport: async () => events([]),
      hooks: {
        resolveToolApproval: async (toolCallId) => {
          hookCalls += 1;
          return { callId: toolCallId, outcome: 'success', content: 'allowed' };
        },
      },
    });

    expect(
      await throwingRejectionOf(
        controller.adapter.resolveToolApproval?.('call', { decision: 'approve', remember: false }),
      ),
    ).toThrow('without a current approval action');
    expect(hookCalls).toBe(0);
  });
});
