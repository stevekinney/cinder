import { throwingRejectionOf } from '@lostgradient/testing';
import { describe, expect, test } from 'bun:test';
import {
  appendAssistantMessage,
  appendToolCall,
  appendToolResult,
  createConversationHistory,
} from '../components/chat/builders.ts';
import type { ConversationHistory } from '../components/chat/conversation-model.ts';
import { createChatSessionController } from './session-controller.ts';
import type { ChatStreamEvent } from './stream-event-codec.ts';

async function* events(values: ChatStreamEvent[]): AsyncGenerator<ChatStreamEvent> {
  yield* values;
}

describe('chat session controller', () => {
  test('resolves a persisted orphan approval without inventing a user owner', async () => {
    let conversation = appendToolResult(
      appendToolCall(
        appendAssistantMessage(createConversationHistory({ id: 'orphan-approval' }), 'Working.'),
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
    let calls = 0;
    const controller = createChatSessionController({
      getConversation: () => conversation,
      setConversation: (next) => {
        conversation = next;
      },
      transport: async () => {
        calls += 1;
        return events([{ type: 'text', text: 'unexpected' }]);
      },
      hooks: {
        resolveToolApproval: async (toolCallId) => ({
          callId: toolCallId,
          outcome: 'success',
          content: 'allowed',
        }),
      },
    });

    await controller.adapter.resolveToolApproval?.('call', {
      decision: 'approve',
      remember: false,
    });

    expect(calls).toBe(0);
  });

  test('does not continue when action_required is followed by success in one batch', async () => {
    let conversation = createConversationHistory({ id: 'mixed-batch' });
    let calls = 0;
    const controller = createChatSessionController({
      getConversation: () => conversation,
      setConversation: (next) => {
        conversation = next;
      },
      transport: async () => {
        calls += 1;
        return events([
          { type: 'tool_call', id: 'a', name: 'write', arguments: {} },
          {
            type: 'tool_result',
            callId: 'a',
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
          { type: 'tool_call', id: 'b', name: 'read', arguments: {} },
          { type: 'tool_result', callId: 'b', outcome: 'success', content: 'late' },
        ]);
      },
    });
    await controller.adapter.sendMessage({ role: 'user', content: 'write' }, []);
    expect(calls).toBe(1);
  });

  test('rolls back partial output on a non-abort stream failure', async () => {
    let conversation = createConversationHistory({ id: 'rollback' });
    const controller = createChatSessionController({
      getConversation: () => conversation,
      setConversation: (next) => {
        conversation = next;
      },
      transport: async function* () {
        yield { type: 'text', text: 'partial' } as const;
        throw new Error('broken stream');
      },
    });
    await Promise.resolve(
      expect(
        await throwingRejectionOf(
          controller.adapter.sendMessage({ role: 'user', content: 'hi' }, []),
        ),
      ).toThrow('broken stream'),
    );
    expect(Object.values(conversation.messages).map((message) => message.content)).toEqual(['hi']);
    expect(Object.values(conversation.messages)[0]?.metadata['_deliveryStatus']).toBe('failed');
  });

  test('retry removes incomplete tool rows from the failed owning turn', async () => {
    let conversation = createConversationHistory({ id: 'retry-tools' });
    let calls = 0;
    let retriedHistory: ConversationHistory | undefined;
    const controller = createChatSessionController({
      getConversation: () => conversation,
      setConversation: (next) => {
        conversation = next;
      },
      transport: async ({ conversation: history }) => {
        calls += 1;
        if (calls === 1)
          return (async function* () {
            yield { type: 'tool_call', id: 'dangling', name: 'write', arguments: {} } as const;
            throw new Error('interrupted');
          })();
        retriedHistory = history;
        return events([{ type: 'text', text: 'retried' }]);
      },
    });
    await Promise.resolve(
      expect(
        await throwingRejectionOf(
          controller.adapter.sendMessage({ role: 'user', content: 'write' }, []),
        ),
      ).toThrow('interrupted'),
    );
    await controller.adapter.retryMessage?.(conversation.ids[0]!);
    expect(
      retriedHistory?.ids.some((id) => retriedHistory?.messages[id]?.role === 'tool-call'),
    ).toBe(false);
  });

  test('passes attachments to the transport', async () => {
    let conversation = createConversationHistory({ id: 'attachments' });
    let received = 0;
    const controller = createChatSessionController({
      getConversation: () => conversation,
      setConversation: (next) => {
        conversation = next;
      },
      transport: async ({ attachments }) => {
        received = attachments.length;
        return events([{ type: 'text', text: 'ok' }]);
      },
    });
    await controller.adapter.sendMessage({ role: 'user', content: 'hi' }, [
      {
        id: 'attachment-1',
        file: new File(['x'], 'x.txt', { type: 'text/plain' }),
        previewUrl: 'blob:attachment-1',
        kind: 'document',
        status: 'ready',
      },
    ]);
    expect(received).toBe(1);
  });
});
