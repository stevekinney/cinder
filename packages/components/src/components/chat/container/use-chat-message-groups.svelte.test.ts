import { describe, expect, test } from 'bun:test';
import type { Message } from '../conversation-model.ts';

import {
  buildChatRenderRows,
  buildMessagesWithDateSeparators,
  chatRenderRowKey,
  findPairedToolResultIds,
  findRenderRowIndexByMessageId,
  useChatMessageGroups,
  type MessageItem,
} from './use-chat-message-groups.svelte.ts';

const baseTimestamp = new Date('2026-05-08T12:00:00Z').toISOString();

function userMessage(id: string, content = 'hi'): Message {
  const message: Message = {
    id,
    role: 'user',
    content,
    createdAt: baseTimestamp,
    position: 0,
    metadata: {},
    hidden: false,
  };
  return message;
}

function toolUseMessage(id: string, callId: string, name = 'exports_check'): Message {
  const message: Message = {
    id,
    role: 'tool-call',
    content: '',
    createdAt: baseTimestamp,
    position: 0,
    metadata: {},
    hidden: false,
    toolCall: {
      id: callId,
      name,
      arguments: {},
    },
  };
  return message;
}

function toolResultMessage(
  id: string,
  callId: string,
  outcome: 'success' | 'error' = 'success',
): Message {
  const message: Message = {
    id,
    role: 'tool-result',
    content: '',
    createdAt: baseTimestamp,
    position: 0,
    metadata: {},
    hidden: false,
    toolResult: {
      callId,
      outcome,
      content: { ok: true },
    },
  };
  return message;
}

function messages(items: MessageItem[]) {
  return items.map((item) => item.message.id);
}

describe('useChatMessageGroups paired tool-result filtering', () => {
  test('paired tool-call + tool-result with matching callId: only tool-call renders', () => {
    const conversation = [
      userMessage('m1', 'check it'),
      toolUseMessage('m2', 'call-1'),
      toolResultMessage('m3', 'call-1'),
    ];

    const groups = useChatMessageGroups({ getMessages: () => conversation });

    const messageItems = groups.messagesWithDates.filter(
      (item): item is MessageItem => item.type === 'message',
    );

    expect(messages(messageItems)).toEqual(['m1', 'm2']);
  });

  test('orphan tool-result with no matching tool-call: still renders', () => {
    const conversation = [userMessage('m1'), toolResultMessage('orphan', 'call-missing')];

    const groups = useChatMessageGroups({ getMessages: () => conversation });

    const messageItems = groups.messagesWithDates.filter(
      (item): item is MessageItem => item.type === 'message',
    );

    expect(messages(messageItems)).toEqual(['m1', 'orphan']);
  });

  test('pending tool-call with no result yet: renders normally', () => {
    const conversation = [userMessage('m1'), toolUseMessage('pending', 'call-pending')];

    const groups = useChatMessageGroups({ getMessages: () => conversation });

    const messageItems = groups.messagesWithDates.filter(
      (item): item is MessageItem => item.type === 'message',
    );

    expect(messages(messageItems)).toEqual(['m1', 'pending']);
  });

  test('tool-result paired with an error outcome is also filtered out', () => {
    const conversation = [
      toolUseMessage('m1', 'call-err'),
      toolResultMessage('m2', 'call-err', 'error'),
    ];

    const groups = useChatMessageGroups({ getMessages: () => conversation });

    const messageItems = groups.messagesWithDates.filter(
      (item): item is MessageItem => item.type === 'message',
    );

    expect(messages(messageItems)).toEqual(['m1']);
  });

  test('reactive helper groups multiple visible tool calls by call id', () => {
    const conversation = [
      toolUseMessage('call-a', 'shared-call'),
      toolUseMessage('call-b', 'shared-call'),
      toolResultMessage('result', 'shared-call'),
    ];

    const groups = useChatMessageGroups({ getMessages: () => conversation });

    expect(groups.toolCallPairsByCallId.get('shared-call')).toHaveLength(2);
    expect(groups.pairedToolResultIds.has('result')).toBe(true);
    expect(groups.renderRows.map((row) => row.type)).toEqual(['date', 'message', 'message']);
  });

  test('render rows add unread and typing state without mutating message order', () => {
    const first = userMessage('first');
    const second = { ...userMessage('second'), role: 'assistant' as const };
    const third = {
      ...userMessage('third'),
      createdAt: '2026-05-09T12:00:00.000Z',
    };
    const items = buildMessagesWithDateSeparators(
      [first, second, third],
      findPairedToolResultIds([first, second, third]),
    );

    const rows = buildChatRenderRows(items, {
      firstUnreadId: 'second',
      showTypingIndicator: true,
    });

    expect(rows.map((row) => row.type)).toEqual([
      'date',
      'message',
      'unread-divider',
      'message',
      'date',
      'message',
      'typing',
    ]);
    expect(rows.filter((row) => row.type === 'message').map((row) => row.message.id)).toEqual([
      'first',
      'second',
      'third',
    ]);
    expect(rows.map(chatRenderRowKey)).toEqual([
      'date-2026-05-08T12:00:00.000Z',
      'msg-first',
      'unread-first',
      'msg-second',
      'date-2026-05-09T12:00:00.000Z',
      'msg-third',
      'typing',
    ]);
    expect(findRenderRowIndexByMessageId(rows, 'third')).toBe(5);
    expect(findRenderRowIndexByMessageId(rows, 'missing')).toBe(-1);
  });

  test('invalid timestamps and explicit start unread rows stay render-only', () => {
    const invalid = { ...userMessage('invalid'), createdAt: 'not-a-date' };
    const valid = {
      ...userMessage('valid'),
      createdAt: '2026-05-10T12:00:00.000Z',
    };
    const items = buildMessagesWithDateSeparators([invalid, valid], new Set());
    const rows = buildChatRenderRows(items, { firstUnreadId: 'invalid' });
    const startRows = buildChatRenderRows(buildMessagesWithDateSeparators([valid], new Set()), {
      firstUnreadId: 'valid',
    });

    expect(items.map((item) => item.type)).toEqual(['message', 'date', 'message']);
    expect(rows.map(chatRenderRowKey)).toEqual([
      'msg-invalid',
      'date-2026-05-10T12:00:00.000Z',
      'msg-valid',
    ]);
    expect(startRows.map(chatRenderRowKey)).toEqual([
      'date-2026-05-10T12:00:00.000Z',
      'unread-start',
      'msg-valid',
    ]);
    expect(chatRenderRowKey({ type: 'unread-divider', afterMessageId: null })).toBe('unread-start');
  });
});
