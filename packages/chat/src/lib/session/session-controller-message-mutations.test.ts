import { throwingRejectionOf } from '@lostgradient/testing';
import { describe, expect, test } from 'bun:test';
import {
  appendToolCall,
  appendToolResult,
  appendUserMessage,
  createConversationHistory,
} from '../components/chat/builders.ts';
import type { ConversationHistory } from '../components/chat/conversation-model.ts';
import { createChatSessionController } from './session-controller.ts';
import type { ChatStreamEvent } from './stream-event-codec.ts';

async function* events(values: ChatStreamEvent[]): AsyncGenerator<ChatStreamEvent> {
  yield* values;
}

describe('chat session controller', () => {
  test('cleans retained incomplete tool rows before a fresh send', async () => {
    let conversation = appendToolCall(
      appendUserMessage(createConversationHistory({ id: 'send-tools' }), 'previous'),
      { id: 'dangling', name: 'write', arguments: {} },
    );
    let transportConversation: ConversationHistory | undefined;
    const controller = createChatSessionController({
      getConversation: () => conversation,
      setConversation: (next) => {
        conversation = next;
      },
      transport: async ({ conversation: history }) => {
        transportConversation = history;
        return events([{ type: 'text', text: 'fresh response' }]);
      },
    });

    await controller.adapter.sendMessage({ role: 'user', content: 'fresh' }, []);

    expect(transportConversation?.messages['dangling']).toBeUndefined();
    expect(Object.values(conversation.messages).map((message) => message.content)).toEqual([
      'previous',
      'fresh',
      'fresh response',
    ]);
  });

  test('rejects retrying a turn that is not currently failed', async () => {
    let conversation = createConversationHistory({ id: 'retry-validity' });
    let calls = 0;
    const controller = createChatSessionController({
      getConversation: () => conversation,
      setConversation: (next) => {
        conversation = next;
      },
      transport: async () => {
        calls += 1;
        return events([{ type: 'text', text: 'ok' }]);
      },
    });
    await controller.adapter.sendMessage({ role: 'user', content: 'already succeeded' }, []);
    const before = conversation;

    await Promise.resolve(
      expect(
        await throwingRejectionOf(controller.adapter.retryMessage?.(conversation.ids[0]!)),
      ).toThrow('failed'),
    );
    expect(calls).toBe(1);
    expect(conversation).toBe(before);
  });

  test('rejects editing stale and non-user message ids before mutating the transcript', async () => {
    let conversation = createConversationHistory({ id: 'edit-validity' });
    const controller = createChatSessionController({
      getConversation: () => conversation,
      setConversation: (next) => {
        conversation = next;
      },
      transport: async () => events([{ type: 'text', text: 'reply' }]),
    });
    await controller.adapter.sendMessage({ role: 'user', content: 'original' }, []);
    const before = conversation;
    const assistantId = conversation.ids[1]!;

    await Promise.resolve(
      expect(
        await throwingRejectionOf(
          controller.adapter.editMessage?.({ messageId: 'stale', content: 'edited' }),
        ),
      ).toThrow('user message'),
    );
    await Promise.resolve(
      expect(
        await throwingRejectionOf(
          controller.adapter.editMessage?.({ messageId: assistantId, content: 'edited' }),
        ),
      ).toThrow('user message'),
    );
    expect(conversation).toBe(before);
  });

  test('retries the latest user turn when retained tool rows follow it', async () => {
    let conversation = createConversationHistory({ id: 'retry-retained-tools' });
    let attempts = 0;
    const controller = createChatSessionController({
      getConversation: () => conversation,
      setConversation: (next) => {
        conversation = next;
      },
      transport: async () => {
        attempts += 1;
        if (attempts === 1) throw new Error('failed after tool execution');
        return events([{ type: 'text', text: 'recovered' }]);
      },
    });
    await Promise.resolve(
      expect(
        await throwingRejectionOf(
          controller.adapter.sendMessage({ role: 'user', content: 'run' }, []),
        ),
      ).toThrow('failed after tool execution'),
    );
    const userMessageId = conversation.ids[0]!;
    conversation = appendToolResult(
      appendToolCall(conversation, { id: 'retained-call', name: 'read', arguments: {} }),
      { callId: 'retained-call', outcome: 'success', content: 'retained' },
    );

    await controller.adapter.retryMessage?.(userMessageId);

    expect(Object.values(conversation.messages).at(-1)?.content).toBe('recovered');
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
});
