import { describe, expect, test } from 'bun:test';
import { createConversationHistory } from '../components/chat/builders.ts';
import type { ConversationHistory } from '../components/chat/conversation-model.ts';
import { createChatSessionController } from './session-controller.ts';
import type { ChatStreamEvent } from './stream-event-codec.ts';

async function* events(values: ChatStreamEvent[]): AsyncGenerator<ChatStreamEvent> {
  yield* values;
}

describe('chat session controller', () => {
  test('sends and finalizes a streamed assistant response', async () => {
    let conversation = createConversationHistory({ id: 'test' });
    const controller = createChatSessionController({
      getConversation: () => conversation,
      setConversation: (next) => {
        conversation = next;
      },
      transport: async () => events([{ type: 'text', text: 'hello' }]),
    });
    await controller.adapter.sendMessage({ role: 'user', content: 'hi' }, []);
    expect(Object.values(conversation.messages).map((message) => message.content)).toEqual([
      'hi',
      'hello',
    ]);
    expect(
      Object.values(conversation.messages).some(
        (message) => message.metadata['streaming'] === true,
      ),
    ).toBe(false);
  });

  test('marks the initiating message failed when transport rejects', async () => {
    let conversation: ConversationHistory = createConversationHistory({ id: 'test' });
    const controller = createChatSessionController({
      getConversation: () => conversation,
      setConversation: (next) => {
        conversation = next;
      },
      transport: async () => {
        throw new Error('offline');
      },
    });
    await expect(
      controller.adapter.sendMessage({ role: 'user', content: 'hi' }, []),
    ).rejects.toThrow('offline');
    expect(Object.values(conversation.messages)[0]?.metadata['_deliveryStatus']).toBe('failed');
  });

  test('retries a failed message and clears its delivery marker', async () => {
    let conversation = createConversationHistory({ id: 'retry' });
    let attempts = 0;
    const controller = createChatSessionController({
      getConversation: () => conversation,
      setConversation: (next) => {
        conversation = next;
      },
      transport: async () => {
        attempts += 1;
        if (attempts === 1) throw new Error('offline');
        return events([{ type: 'text', text: 'back' }]);
      },
    });
    await expect(
      controller.adapter.sendMessage({ role: 'user', content: 'hi' }, []),
    ).rejects.toThrow();
    const messageId = conversation.ids[0]!;
    await controller.adapter.retryMessage?.(messageId);
    expect(conversation.messages[messageId]?.metadata['_deliveryStatus']).toBeUndefined();
  });

  test('rewinds an edited message and discards its superseded branch', async () => {
    let conversation = createConversationHistory({ id: 'edit' });
    const controller = createChatSessionController({
      getConversation: () => conversation,
      setConversation: (next) => {
        conversation = next;
      },
      transport: async () => events([{ type: 'text', text: 'new reply' }]),
    });
    await controller.adapter.sendMessage({ role: 'user', content: 'old' }, []);
    const oldId = conversation.ids[0]!;
    await controller.adapter.editMessage?.({ messageId: oldId, content: 'new' });
    expect(Object.values(conversation.messages).map((message) => message.content)).toEqual([
      'new',
      'new reply',
    ]);
  });

  test('stop cancels the active stream and transitions streaming hooks', async () => {
    let conversation = createConversationHistory({ id: 'stop' });
    const transitions: boolean[] = [];
    const controller = createChatSessionController({
      getConversation: () => conversation,
      setConversation: (next) => {
        conversation = next;
      },
      transport: async ({ signal }) => {
        async function* partial(): AsyncGenerator<ChatStreamEvent> {
          yield { type: 'text', text: 'partial' };
          await new Promise<void>((resolve) => {
            signal.addEventListener('abort', () => resolve(), { once: true });
          });
        }
        return partial();
      },
      hooks: { onStreamingChange: (value) => transitions.push(value) },
    });
    const pending = controller.adapter.sendMessage({ role: 'user', content: 'hi' }, []);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    await controller.adapter.stopGenerating?.(conversation.ids[0]!);
    await pending;
    await controller.stop();
    expect(transitions).toEqual([true, false]);
    expect(Object.values(conversation.messages).at(-1)?.content).toBe('partial');
  });

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
        approveToolCall: async (id) => {
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
              { type: 'tool_result', callId: 'call', outcome: 'action_required', content: null },
            ])
          : events([{ type: 'text', text: 'approved' }]);
      },
      hooks: {
        approveToolCall: async (toolCallId) => ({
          callId: toolCallId,
          outcome: 'success',
          content: 'allowed',
        }),
      },
    });
    await controller.adapter.sendMessage({ role: 'user', content: 'write' }, []);
    expect(calls).toBe(1);
    await controller.adapter.approveToolCall?.('call');
    expect(calls).toBe(2);
    expect(
      Object.values(conversation.messages).some((message) => message.content === 'approved'),
    ).toBe(true);
  });

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
            ? '{"type":"tool_call","id":"call","name":"delete","arguments":{}}\n{"type":"tool_result","callId":"call","outcome":"action_required","content":null}\n'
            : '{"type":"text","text":"denied"}\n',
          { headers: { 'Content-Type': 'application/x-ndjson' } },
        ),
      hooks: {
        denyToolCall: async (toolCallId) => ({
          callId: toolCallId,
          outcome: 'error',
          content: null,
          error: { code: 'denied', category: 'permission', retryable: false, message: 'Denied' },
        }),
      },
    });
    await controller.adapter.sendMessage({ role: 'user', content: 'delete' }, []);
    await controller.adapter.denyToolCall?.('call');
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
    await expect(
      controller.adapter.sendMessage({ role: 'user', content: 'run' }, []),
    ).rejects.toThrow('continuation limit');
    expect(errors).toHaveLength(1);
    controller.dispose();
    await expect(
      controller.adapter.sendMessage({ role: 'user', content: 'again' }, []),
    ).rejects.toThrow('disposed');
  });
});
