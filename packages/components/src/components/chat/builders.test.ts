import { describe, expect, test } from 'bun:test';

import {
  appendAssistantMessage,
  appendMessages,
  appendUserMessage,
  createConversation,
} from './builders.ts';
import type { MultiModalContent } from './conversation-model.ts';

describe('chat conversation builders', () => {
  test('createConversation builds an empty compatible conversation snapshot', () => {
    const conversation = createConversation({
      id: 'conversation-builders',
      title: 'Builder coverage',
      status: 'archived',
    });

    expect(conversation).toMatchObject({
      schemaVersion: 4,
      id: 'conversation-builders',
      title: 'Builder coverage',
      status: 'archived',
      metadata: {},
      ids: [],
      messages: {},
    });
    expect(Date.parse(conversation.createdAt)).not.toBeNaN();
    expect(conversation.updatedAt).toBe(conversation.createdAt);
  });

  test('appendMessages is immutable and preserves the original snapshot when no inputs are given', () => {
    const conversation = createConversation({ id: 'conversation-noop' });

    expect(appendMessages(conversation)).toBe(conversation);

    const updated = appendMessages(conversation, {
      role: 'assistant',
      content: 'Hello from the assistant',
    });

    expect(updated).not.toBe(conversation);
    expect(conversation.ids).toEqual([]);
    expect(conversation.messages).toEqual({});
    expect(updated.ids).toHaveLength(1);
    expect(updated.messages[updated.ids[0]!]?.position).toBe(0);
  });

  test('appendMessages materializes metadata, tool fields, and copied multi-modal content', () => {
    const content: MultiModalContent[] = [
      { type: 'text', text: 'Inspect this image' },
      { type: 'image', url: 'https://example.com/image.png' },
    ];
    const conversation = appendMessages(createConversation({ id: 'conversation-tools' }), {
      role: 'tool-call',
      content,
      metadata: { source: 'builder-test' },
      toolCall: {
        id: 'call-1',
        name: 'inspect_image',
        arguments: { depth: 'full' },
      },
      tokenUsage: {
        prompt: 7,
        completion: 11,
        total: 18,
      },
    });

    const message = conversation.messages[conversation.ids[0]!]!;
    content.push({ type: 'text', text: 'Added after append' });

    expect(message.content).toEqual([
      { type: 'text', text: 'Inspect this image' },
      { type: 'image', url: 'https://example.com/image.png' },
    ]);
    expect(message.metadata).toEqual({ source: 'builder-test' });
    expect(message.toolCall?.id).toBe('call-1');
    expect(message.tokenUsage?.total).toBe(18);
    expect(message.hidden).toBe(false);
  });

  test('appendMessages accepts Cinder-style tool-call and tool-result transcripts', () => {
    const conversation = appendMessages(
      createConversation({ id: 'conversation-tool-transcript' }),
      {
        role: 'tool-call',
        content: '',
        toolCall: { id: 'call-1', name: 'lookup', arguments: { package: '@lostgradient/cinder' } },
      },
      {
        role: 'tool-result',
        content: '',
        toolResult: { callId: 'call-1', outcome: 'success', content: { found: true } },
      },
    );

    const [callMessageId, resultMessageId] = conversation.ids;
    const callMessage = conversation.messages[callMessageId!]!;
    const resultMessage = conversation.messages[resultMessageId!]!;

    expect(callMessage.role).toBe('tool-call');
    expect(callMessage.toolCall?.id).toBe('call-1');
    expect(resultMessage.role).toBe('tool-result');
    expect(resultMessage.toolResult?.callId).toBe('call-1');
  });

  test('role-specific append helpers preserve order and assign positions', () => {
    const conversation = appendAssistantMessage(
      appendUserMessage(createConversation({ id: 'conversation-roles' }), 'Hi'),
      'Hello',
    );

    const [firstMessageId, secondMessageId] = conversation.ids;
    const firstMessage = conversation.messages[firstMessageId!]!;
    const secondMessage = conversation.messages[secondMessageId!]!;

    expect(firstMessage.role).toBe('user');
    expect(firstMessage.position).toBe(0);
    expect(secondMessage.role).toBe('assistant');
    expect(secondMessage.position).toBe(1);
    expect(firstMessage.id).not.toBe(secondMessage.id);
  });
});
