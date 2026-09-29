import { describe, expect, test } from 'bun:test';
import { createConversationHistory, isStreamingMessage } from '../components/chat/builders.ts';
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
    expect(Object.values(conversation.messages).some(isStreamingMessage)).toBe(false);
  });

  test('synchronizes subscribed stream lifecycle with the controller placeholder', async () => {
    let conversation = createConversationHistory({ id: 'subscribe' });
    const eventsSeen: string[] = [];
    const controller = createChatSessionController({
      getConversation: () => conversation,
      setConversation: (next) => {
        conversation = next;
      },
      transport: async () => events([{ type: 'text', text: 'hello' }]),
    });
    controller.adapter.subscribe?.('subscribe', {
      onMessage: () => undefined,
      onTypingChange: () => undefined,
      onReadReceipt: () => undefined,
      onStreamBegin: (id) => eventsSeen.push(`begin:${id}`),
      onTokenPush: (token) => eventsSeen.push(`token:${token}`),
      onStreamEnd: () => eventsSeen.push('end'),
    });
    await controller.adapter.sendMessage({ role: 'user', content: 'hi' }, []);
    expect(eventsSeen).toEqual([`begin:${conversation.ids[1]}`, 'token:hello', 'end']);
  });

  test('ignores subscriptions for another conversation', async () => {
    let conversation = createConversationHistory({ id: 'current' });
    const controller = createChatSessionController({
      getConversation: () => conversation,
      setConversation: (next) => {
        conversation = next;
      },
      transport: async () => events([{ type: 'text', text: 'hello' }]),
    });
    const unsubscribe = controller.adapter.subscribe?.('another-conversation', {
      onMessage: () => undefined,
      onTypingChange: () => undefined,
      onReadReceipt: () => undefined,
      onStreamBegin: () => {
        throw new Error('wrong conversation received stream events');
      },
      onTokenPush: () => undefined,
      onStreamEnd: () => undefined,
    });

    unsubscribe?.();
    await controller.adapter.sendMessage({ role: 'user', content: 'hi' }, []);
    expect(Object.values(conversation.messages).at(-1)?.content).toBe('hello');
  });

  test('does not continue while any emitted tool call lacks a result', async () => {
    let conversation = createConversationHistory({ id: 'unresolved-tool-call' });
    let calls = 0;
    const controller = createChatSessionController({
      getConversation: () => conversation,
      setConversation: (next) => {
        conversation = next;
      },
      transport: async () => {
        calls += 1;
        return events([
          { type: 'tool_call', id: 'resolved', name: 'read', arguments: {} },
          { type: 'tool_result', callId: 'resolved', outcome: 'success', content: 'ok' },
          { type: 'tool_call', id: 'pending', name: 'external', arguments: {} },
        ]);
      },
    });

    await controller.adapter.sendMessage({ role: 'user', content: 'run tools' }, []);
    expect(calls).toBe(1);
  });

  test('continues an action_required result that has no actionable action descriptor', async () => {
    let conversation = createConversationHistory({ id: 'action-required-without-action' });
    let calls = 0;
    let pendingApproval: unknown;
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
              {
                type: 'tool_result',
                callId: 'call',
                outcome: 'action_required',
                content: null,
                pendingApproval: { approvalToken: 'descriptor' },
              },
            ])
          : events([{ type: 'text', text: 'continued' }]);
      },
      hooks: {
        onToolResult: (result) => {
          pendingApproval = result.pendingApproval;
        },
      },
    });

    await controller.adapter.sendMessage({ role: 'user', content: 'read' }, []);

    expect(calls).toBe(2);
    expect(pendingApproval).toEqual({ approvalToken: 'descriptor' });
    expect(
      Object.values(conversation.messages).some((message) => message.content === 'continued'),
    ).toBe(true);
  });
});
