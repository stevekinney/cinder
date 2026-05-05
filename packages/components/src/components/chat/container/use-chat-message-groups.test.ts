import { describe, expect, test } from 'bun:test';
import type { Message } from 'conversationalist';

import {
  buildMessagesWithDateSeparators,
  findPairedToolResultIds,
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
        role: 'tool-use',
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
        role: 'tool-use',
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
});
