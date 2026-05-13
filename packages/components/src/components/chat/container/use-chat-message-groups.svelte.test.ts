import { describe, expect, test } from 'bun:test';
import type { Message } from 'conversationalist';

import { useChatMessageGroups, type MessageItem } from './use-chat-message-groups.svelte.ts';

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
    role: 'tool-use',
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
  test('paired tool-use + tool-result with matching callId: only tool-use renders', () => {
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

  test('orphan tool-result with no matching tool-use: still renders', () => {
    const conversation = [userMessage('m1'), toolResultMessage('orphan', 'call-missing')];

    const groups = useChatMessageGroups({ getMessages: () => conversation });

    const messageItems = groups.messagesWithDates.filter(
      (item): item is MessageItem => item.type === 'message',
    );

    expect(messages(messageItems)).toEqual(['m1', 'orphan']);
  });

  test('pending tool-use with no result yet: renders normally', () => {
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
});
