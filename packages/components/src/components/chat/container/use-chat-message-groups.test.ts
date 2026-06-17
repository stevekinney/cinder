import { describe, expect, test } from 'bun:test';
import type { Message } from '../conversation-model.ts';

import {
  buildChatRenderRows,
  buildMessagesWithDateSeparators,
  chatRenderRowKey,
  findPairedToolResultIds,
  findRenderRowIndexByMessageId,
} from './use-chat-message-groups.svelte.ts';

function message(overrides: Partial<Message> & Pick<Message, 'id' | 'role'>): Message {
  return {
    content: '',
    createdAt: '2026-05-04T12:00:00.000Z',
    hidden: false,
    metadata: {},
    position: 1,
    ...overrides,
  } satisfies Message;
}

describe('chat message grouping', () => {
  test('hides paired tool results while keeping unpaired results visible', () => {
    const messages = [
      message({
        id: 'call',
        role: 'tool-call',
        toolCall: { id: 'call-1', name: 'read_file', arguments: { path: 'README.md' } },
      }),
      message({
        id: 'paired-result',
        role: 'tool-result',
        toolResult: { callId: 'call-1', outcome: 'success', content: { ok: true } },
      }),
      message({
        id: 'unpaired-result',
        role: 'tool-result',
        toolResult: { callId: 'missing-call', outcome: 'success', content: { ok: true } },
      }),
    ];

    const pairedResultIds = findPairedToolResultIds(messages);
    const visibleMessageIds = buildMessagesWithDateSeparators(messages, pairedResultIds)
      .filter((item) => item.type === 'message')
      .map((item) => item.message.id);

    expect(pairedResultIds.has('paired-result')).toBe(true);
    expect(visibleMessageIds).toEqual(['call', 'unpaired-result']);
  });

  test('does not emit date separators for hidden paired-only result days', () => {
    const messages = [
      message({
        id: 'call',
        role: 'tool-call',
        createdAt: '2026-05-04T12:00:00.000Z',
        toolCall: { id: 'call-1', name: 'read_file', arguments: { path: 'README.md' } },
      }),
      message({
        id: 'paired-result',
        role: 'tool-result',
        createdAt: '2026-05-05T12:00:00.000Z',
        toolResult: { callId: 'call-1', outcome: 'success', content: { ok: true } },
      }),
      message({
        id: 'assistant',
        role: 'assistant',
        createdAt: '2026-05-06T12:00:00.000Z',
        content: 'Done.',
      }),
    ];

    const items = buildMessagesWithDateSeparators(messages, findPairedToolResultIds(messages));
    const dates = items
      .filter((item) => item.type === 'date')
      .map((item) => item.date.toISOString().slice(0, 10));

    expect(dates).toEqual(['2026-05-04', '2026-05-06']);
  });

  test('skips invalid timestamps and starts a new separator on valid day changes', () => {
    const messages = [
      message({ id: 'invalid', role: 'user', createdAt: 'not-a-date' }),
      message({ id: 'first-day', role: 'assistant', createdAt: '2026-05-04T12:00:00.000Z' }),
      message({ id: 'second-day', role: 'user', createdAt: '2026-05-05T12:00:00.000Z' }),
    ];

    const items = buildMessagesWithDateSeparators(messages, findPairedToolResultIds(messages));

    expect(items.map((item) => item.type)).toEqual([
      'message',
      'date',
      'message',
      'date',
      'message',
    ]);
    expect(
      items
        .filter((item) => item.type === 'date')
        .map((item) => item.date.toISOString().slice(0, 10)),
    ).toEqual(['2026-05-04', '2026-05-05']);
  });
});

describe('chat render rows', () => {
  test('inserts unread and typing rows without changing message rows', () => {
    const messages = [
      message({ id: 'first', role: 'user' }),
      message({ id: 'second', role: 'assistant' }),
    ];
    const rows = buildChatRenderRows(
      buildMessagesWithDateSeparators(messages, findPairedToolResultIds(messages)),
      { firstUnreadId: 'second', showTypingIndicator: true },
    );

    expect(rows.map((row) => row.type)).toEqual([
      'date',
      'message',
      'unread-divider',
      'message',
      'typing',
    ]);
    expect(rows.filter((row) => row.type === 'message').map((row) => row.message.id)).toEqual([
      'first',
      'second',
    ]);
    expect(rows.map(chatRenderRowKey)).toEqual([
      'date-2026-05-04T12:00:00.000Z',
      'msg-first',
      'unread-first',
      'msg-second',
      'typing',
    ]);
    expect(findRenderRowIndexByMessageId(rows, 'second')).toBe(3);
    expect(findRenderRowIndexByMessageId(rows, 'missing')).toBe(-1);
  });

  test('uses a start unread divider before the first unread message and ignores missing ids', () => {
    const messages = [
      message({ id: 'first', role: 'user' }),
      message({ id: 'second', role: 'assistant' }),
    ];
    const items = buildMessagesWithDateSeparators(messages, findPairedToolResultIds(messages));

    expect(buildChatRenderRows(items, { firstUnreadId: 'first' }).map(chatRenderRowKey)).toEqual([
      'date-2026-05-04T12:00:00.000Z',
      'unread-start',
      'msg-first',
      'msg-second',
    ]);
    expect(buildChatRenderRows(items, { firstUnreadId: 'missing' }).map((row) => row.type)).toEqual(
      ['date', 'message', 'message'],
    );
  });

  test('keys a start unread divider when callers provide one explicitly', () => {
    expect(chatRenderRowKey({ type: 'unread-divider', afterMessageId: null })).toBe('unread-start');
  });
});
