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
  test('retains attachments after a tool result resolves', async () => {
    let conversation = createConversationHistory({ id: 'tool-result-attachments' });
    const received: number[] = [];
    let transportCall = 0;
    const controller = createChatSessionController({
      getConversation: () => conversation,
      setConversation: (next) => {
        conversation = next;
      },
      transport: async ({ attachments }) => {
        received.push(attachments.length);
        transportCall += 1;
        return transportCall === 1
          ? events([
              { type: 'tool_call', id: 'call', name: 'inspect', arguments: {} },
              { type: 'tool_result', callId: 'call', outcome: 'success', content: 'done' },
            ])
          : events([{ type: 'text', text: 'continued' }]);
      },
    });
    const attachment: ChatAttachment = {
      id: 'attachment-1',
      file: new File(['x'], 'x.txt', { type: 'text/plain' }),
      previewUrl: 'blob:attachment-1',
      kind: 'document',
      status: 'ready',
    };

    await controller.adapter.sendMessage({ role: 'user', content: 'inspect this' }, [attachment]);

    expect(received).toEqual([1, 1]);
  });

  test('preserves attachments when editing the latest retryable turn', async () => {
    let conversation = createConversationHistory({ id: 'edit-attachments' });
    const received: number[] = [];
    const controller = createChatSessionController({
      getConversation: () => conversation,
      setConversation: (next) => {
        conversation = next;
      },
      transport: async ({ attachments }) => {
        received.push(attachments.length);
        return events([{ type: 'text', text: 'ok' }]);
      },
    });
    const attachment: ChatAttachment = {
      id: 'attachment-1',
      file: new File(['x'], 'x.txt', { type: 'text/plain' }),
      previewUrl: 'blob:attachment-1',
      kind: 'document',
      status: 'ready',
    };
    await controller.adapter.sendMessage({ role: 'user', content: 'first' }, [attachment]);
    await controller.adapter.editMessage?.({ messageId: conversation.ids[0]!, content: 'edited' });

    expect(received).toEqual([1, 1]);
  });

  test('marks the initiating user message when approval continuation fails', async () => {
    let conversation = createConversationHistory({ id: 'approval-failure' });
    const controller = createChatSessionController({
      getConversation: () => conversation,
      setConversation: (next) => {
        conversation = next;
      },
      transport: async () =>
        events([
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
        ]),
      hooks: {
        resolveToolApproval: async () => {
          throw new Error('approval unavailable');
        },
      },
    });
    await controller.adapter.sendMessage({ role: 'user', content: 'write' }, []);
    await Promise.resolve(
      expect(
        await throwingRejectionOf(
          controller.adapter.resolveToolApproval?.('call', {
            decision: 'approve',
            remember: false,
          }),
        ),
      ).toThrow('approval unavailable'),
    );
    expect(Object.values(conversation.messages)[0]?.metadata['_deliveryStatus']).toBeUndefined();
  });

  test('marks the initiating user message when denial continuation fails', async () => {
    let conversation = createConversationHistory({ id: 'denial-failure' });
    const controller = createChatSessionController({
      getConversation: () => conversation,
      setConversation: (next) => {
        conversation = next;
      },
      transport: async () =>
        events([
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
        ]),
      hooks: {
        resolveToolApproval: async () => {
          throw new Error('denial unavailable');
        },
      },
    });
    await controller.adapter.sendMessage({ role: 'user', content: 'write' }, []);
    await Promise.resolve(
      expect(
        await throwingRejectionOf(
          controller.adapter.resolveToolApproval?.('call', { decision: 'deny', remember: false }),
        ),
      ).toThrow('denial unavailable'),
    );
    expect(Object.values(conversation.messages)[0]?.metadata['_deliveryStatus']).toBeUndefined();
  });

  test('rejects every mutating adapter command after disposal without changing history', async () => {
    let conversation = createConversationHistory({ id: 'disposed' });
    const controller = createChatSessionController({
      getConversation: () => conversation,
      setConversation: (next) => {
        conversation = next;
      },
      transport: async () => events([{ type: 'text', text: 'unexpected' }]),
      hooks: { resolveToolApproval: async () => undefined },
    });
    const original = conversation;
    controller.dispose();
    await Promise.resolve(
      expect(
        await throwingRejectionOf(
          controller.adapter.sendMessage({ role: 'user', content: 'x' }, []),
        ),
      ).toThrow('disposed'),
    );
    await Promise.resolve(
      expect(await throwingRejectionOf(controller.adapter.retryMessage?.('missing'))).toThrow(
        'disposed',
      ),
    );
    await Promise.resolve(
      expect(
        await throwingRejectionOf(
          controller.adapter.editMessage?.({ messageId: 'missing', content: 'x' }),
        ),
      ).toThrow('disposed'),
    );
    await Promise.resolve(
      expect(
        await throwingRejectionOf(
          controller.adapter.resolveToolApproval?.('missing', {
            decision: 'approve',
            remember: false,
          }),
        ),
      ).toThrow('disposed'),
    );
    await Promise.resolve(
      expect(
        await throwingRejectionOf(
          controller.adapter.resolveToolApproval?.('missing', {
            decision: 'deny',
            remember: false,
          }),
        ),
      ).toThrow('disposed'),
    );
    await Promise.resolve(
      expect(await throwingRejectionOf(controller.adapter.stopGenerating?.('missing'))).toThrow(
        'disposed',
      ),
    );
    expect(conversation).toBe(original);
  });
});
