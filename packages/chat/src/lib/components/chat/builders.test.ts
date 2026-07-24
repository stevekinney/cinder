import { describe, expect, test } from 'bun:test';

import {
  appendAssistantMessage,
  appendUserMessage,
  buildMessage,
  createConversation,
  createConversationHistory,
  prependMessages,
} from './builders.ts';

describe('chat conversation builders', () => {
  test('uses Conversationalist 0.5 createConversationHistory snapshots', () => {
    const conversation = createConversationHistory({ id: 'conversation-builders' });

    expect(conversation).toMatchObject({
      schemaVersion: 5,
      id: 'conversation-builders',
      metadata: {},
      ids: [],
      messages: {},
    });
  });

  test('keeps createConversation as a migration alias', () => {
    const conversation = createConversation({ id: 'conversation-alias' });

    expect(conversation.schemaVersion).toBe(5);
    expect(conversation.id).toBe('conversation-alias');
  });

  test('re-exports the 0.5 buildMessage and prependMessages helpers', () => {
    const initial = createConversationHistory({ id: 'conversation-prepend' });
    const existing = appendAssistantMessage(initial, 'Existing');
    const prepared = buildMessage({ role: 'user', content: 'First' }, { position: 0 });
    const next = prependMessages(existing, prepared);

    expect(next.ids).toHaveLength(2);
    expect(next.messages[next.ids[0]!]!.content).toBe('First');
    expect(next.messages[next.ids[1]!]!.content).toBe('Existing');
    expect(next.messages[next.ids[0]!]!.position).toBe(0);
    expect(next.messages[next.ids[1]!]!.position).toBe(1);
  });

  test('keeps Chat role helpers aligned with the canonical builder', () => {
    const conversation = appendUserMessage(
      createConversationHistory({ id: 'conversation-role-helper' }),
      'Hello',
    );

    expect(conversation.messages[conversation.ids[0]!]!.role).toBe('user');
    expect(conversation.messages[conversation.ids[0]!]!.content).toBe('Hello');
  });
});
