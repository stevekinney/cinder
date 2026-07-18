import { describe, expect, test } from 'bun:test';

import type { ConversationHistory, Message } from '../chat/conversation-model.ts';
import { conversationSummaryTimestamp, deriveConversationSummary } from './conversation-summary.ts';

function message(
  id: string,
  content: string,
  createdAt: string,
  role: Message['role'] = 'assistant',
): Message {
  return {
    id,
    role,
    content,
    position: 0,
    createdAt,
    metadata: {},
    hidden: false,
  };
}

function conversation(messages: Message[]): ConversationHistory {
  return {
    schemaVersion: 4,
    id: 'conversation-1',
    title: 'Launch support',
    status: 'active',
    metadata: { _unreadCount: 3, _participantNames: ['Ada', 'Grace', 'Lin'] },
    ids: messages.map((item) => item.id),
    messages: Object.fromEntries(
      messages.map((item, index) => [item.id, { ...item, position: index }]),
    ),
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:10:00.000Z',
  };
}

describe('deriveConversationSummary', () => {
  test('derives list/header fields from a compatible ConversationHistory snapshot', () => {
    const summary = deriveConversationSummary(
      conversation([
        message('m1', 'Earlier message', '2026-06-01T00:01:00.000Z'),
        message('m2', 'Latest message', '2026-06-01T00:02:00.000Z'),
      ]),
    );

    expect(summary).toMatchObject({
      id: 'conversation-1',
      title: 'Launch support',
      status: 'active',
      messageCount: 2,
      unreadCount: 3,
      lastMessageId: 'm2',
      lastMessageText: 'Latest message',
      lastMessageAt: '2026-06-01T00:02:00.000Z',
      participantNames: ['Ada', 'Grace', 'Lin'],
    });
  });

  test('falls back to the last message text when no title exists', () => {
    const snapshot = conversation([message('m1', 'Untitled preview', '2026-06-01T00:01:00.000Z')]);
    const summary = deriveConversationSummary({ ...snapshot, title: undefined });

    expect(summary.title).toBe('Untitled preview');
  });

  test('uses an untitled fallback when the conversation has no visible messages', () => {
    const summary = deriveConversationSummary({ ...conversation([]), title: '   ' });

    expect(summary).toMatchObject({
      title: 'Untitled conversation',
      messageCount: 0,
      unreadCount: 3,
    });
    expect(summary.lastMessageId).toBeUndefined();
  });

  test('normalizes fallback titles, participant metadata, and unread counts', () => {
    const longText = `  ${'word '.repeat(20)}  `;
    const summary = deriveConversationSummary({
      ...conversation([message('m1', longText, '2026-06-01T00:01:00.000Z', 'user')]),
      title: undefined,
      metadata: {
        _unreadCount: -2,
        _participantNames: [' Ada ', '', 42, 'Grace'],
      },
    });

    expect(summary.title).toHaveLength(64);
    expect(summary.title.endsWith('...')).toBe(true);
    expect(summary.unreadCount).toBe(0);
    expect(summary.lastMessageRole).toBe('user');
    expect(summary.participantNames).toEqual([' Ada ', 'Grace']);
  });

  test('uses last message time before updated time and falls back to zero for invalid dates', () => {
    const summary = deriveConversationSummary(
      conversation([message('m1', 'Latest', '2026-06-01T00:05:00.000Z')]),
    );

    expect(conversationSummaryTimestamp(summary)).toBe(Date.parse('2026-06-01T00:05:00.000Z'));
    const {
      lastMessageAt: _lastMessageAt,
      lastMessageId: _lastMessageId,
      lastMessageRole: _lastMessageRole,
      lastMessageText: _lastMessageText,
      ...summaryWithoutLastMessage
    } = summary;
    expect(
      conversationSummaryTimestamp({
        ...summaryWithoutLastMessage,
        updatedAt: 'invalid-date',
        createdAt: 'also-invalid',
      }),
    ).toBe(0);
  });
});
