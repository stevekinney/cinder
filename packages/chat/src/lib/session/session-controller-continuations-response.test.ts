import { throwingRejectionOf } from '@lostgradient/testing';
import { describe, expect, test } from 'bun:test';
import { createConversationHistory } from '../components/chat/builders.ts';
import type { ChatAttachment } from '../components/chat/input/chat-attachment.ts';
import { createChatSessionController } from './session-controller.ts';
import type { ChatStreamEvent } from './stream-event-codec.ts';

async function* events(values: ChatStreamEvent[]): AsyncGenerator<ChatStreamEvent> {
  yield* values;
}

describe('chat session controller', () => {
  test('decodes Response transports and resumes through denial hooks', async () => {
    let conversation = createConversationHistory({ id: 'denial' });
    let calls = 0;
    const controller = createChatSessionController({
      getConversation: () => conversation,
      setConversation: (next) => {
        conversation = next;
      },
      transport: async () =>
        new Response(
          calls++ === 0
            ? '{"type":"tool_call","id":"call","name":"delete","arguments":{}}\n{"type":"tool_result","callId":"call","outcome":"action_required","content":null,"action":{"type":"approval","risk":"high","operation":{"kind":"command","command":"echo approval","argsPreview":{"ok":true}},"policyVersion":"test-policy","idempotencyKey":"test-approval"}}\n'
            : '{"type":"text","text":"denied"}\n',
          { headers: { 'Content-Type': 'application/x-ndjson' } },
        ),
      hooks: {
        resolveToolApproval: async (toolCallId) => ({
          callId: toolCallId,
          outcome: 'error',
          content: null,
          error: { code: 'denied', category: 'permission', retryable: false, message: 'Denied' },
        }),
      },
    });
    await controller.adapter.sendMessage({ role: 'user', content: 'delete' }, []);
    await controller.adapter.resolveToolApproval?.('call', { decision: 'deny', remember: false });
    expect(calls).toBe(2);
    expect(
      Object.values(conversation.messages).some((message) => message.content === 'denied'),
    ).toBe(true);
  });

  test('fails after the bounded continuation limit and disposes future commands', async () => {
    let conversation = createConversationHistory({ id: 'limit' });
    const errors: unknown[] = [];
    const controller = createChatSessionController({
      getConversation: () => conversation,
      setConversation: (next) => {
        conversation = next;
      },
      maxContinuationTurns: 1,
      transport: async () =>
        events([
          { type: 'tool_call', id: 'call', name: 'read', arguments: {} },
          { type: 'tool_result', callId: 'call', outcome: 'success', content: 'ok' },
        ]),
      hooks: { onError: (error) => errors.push(error) },
    });
    await Promise.resolve(
      expect(
        await throwingRejectionOf(
          controller.adapter.sendMessage({ role: 'user', content: 'run' }, []),
        ),
      ).toThrow('continuation limit'),
    );
    expect(errors).toHaveLength(1);
    controller.dispose();
    await Promise.resolve(
      expect(
        await throwingRejectionOf(
          controller.adapter.sendMessage({ role: 'user', content: 'again' }, []),
        ),
      ).toThrow('disposed'),
    );
  });

  test('clears a stale delivery failure after approval recovery succeeds', async () => {
    let conversation = createConversationHistory({ id: 'approval-recovery' });
    let calls = 0;
    const controller = createChatSessionController({
      getConversation: () => conversation,
      setConversation: (next) => {
        conversation = next;
      },
      transport: async () =>
        calls++ === 0
          ? events([
              { type: 'tool_call', id: 'call', name: 'write', arguments: {} },
              {
                type: 'tool_result',
                callId: 'call',
                outcome: 'action_required',
                content: null,
                action: {
                  type: 'approval',
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
          : events([{ type: 'text', text: 'recovered' }]),
      hooks: {
        resolveToolApproval: async (id) => ({ callId: id, outcome: 'success', content: 'allowed' }),
      },
    });
    await controller.adapter.sendMessage({ role: 'user', content: 'write' }, []);
    const userId = conversation.ids[0]!;
    conversation = {
      ...conversation,
      messages: {
        ...conversation.messages,
        [userId]: {
          ...conversation.messages[userId]!,
          metadata: { ...conversation.messages[userId]!.metadata, _deliveryStatus: 'failed' },
        },
      },
    };
    await controller.adapter.resolveToolApproval?.('call', {
      decision: 'approve',
      remember: false,
    });
    expect(conversation.messages[userId]?.metadata['_deliveryStatus']).toBeUndefined();
  });

  test('stores attachments under an edited replacement id for retry', async () => {
    let conversation = createConversationHistory({ id: 'edit-attachments' });
    let calls = 0;
    const attachment = {
      id: 'attachment-1',
      file: new File(['x'], 'note.txt', { type: 'text/plain' }),
      previewUrl: 'blob:attachment-1',
      kind: 'document',
      status: 'ready',
    } satisfies ChatAttachment;
    const received: number[] = [];
    const controller = createChatSessionController({
      getConversation: () => conversation,
      setConversation: (next) => {
        conversation = next;
      },
      transport: async ({ attachments }) => {
        received.push(attachments.length);
        if (calls++ === 1) throw new Error('failed edit');
        return events([{ type: 'text', text: 'ok' }]);
      },
    });
    await controller.adapter.sendMessage({ role: 'user', content: 'old' }, [attachment]);
    const originalId = conversation.ids[0]!;
    await Promise.resolve(
      expect(
        await throwingRejectionOf(
          controller.adapter.editMessage?.({ messageId: originalId, content: 'edited' }),
        ),
      ).toThrow('failed edit'),
    );
    const replacementId = conversation.ids[0]!;
    await controller.adapter.retryMessage?.(replacementId);
    expect(received).toEqual([1, 1, 1]);
  });

  test('retains attachments for every editable user owner and prunes removed turns', async () => {
    let conversation = createConversationHistory({ id: 'attachment-owners' });
    const received: number[] = [];
    const controller = createChatSessionController({
      getConversation: () => conversation,
      setConversation: (next) => {
        conversation = next;
      },
      transport: async ({ attachments }) => {
        received.push(attachments.length);
        return events([{ type: 'text', text: 'reply' }]);
      },
    });
    const firstAttachment = {
      id: 'first-attachment',
      file: new File(['1'], 'first.txt', { type: 'text/plain' }),
      previewUrl: 'blob:first-attachment',
      kind: 'document',
      status: 'ready',
    } satisfies ChatAttachment;
    const secondAttachment = {
      id: 'second-attachment',
      file: new File(['2'], 'second.txt', { type: 'text/plain' }),
      previewUrl: 'blob:second-attachment',
      kind: 'document',
      status: 'ready',
    } satisfies ChatAttachment;
    await controller.adapter.sendMessage({ role: 'user', content: 'first' }, [firstAttachment]);
    const firstId = conversation.ids[0]!;
    await controller.adapter.sendMessage({ role: 'user', content: 'second' }, [secondAttachment]);
    await controller.adapter.editMessage?.({ messageId: firstId, content: 'edited first' });
    expect(received).toEqual([1, 1, 1]);
    expect(
      conversation.ids.filter((id) => conversation.messages[id]?.role === 'user'),
    ).toHaveLength(1);
  });
});
