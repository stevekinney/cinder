import { describe, expect, test } from 'bun:test';
import type { Message } from '../conversation-model.ts';

import { useChatSearch } from './use-chat-search.svelte.ts';

function message(id: string, content: string): Message {
  return {
    id,
    role: 'user',
    content,
    position: 0,
    createdAt: '2026-07-17T12:00:00.000Z',
    metadata: {},
    hidden: false,
  };
}

describe('useChatSearch', () => {
  test('opens, matches case-insensitively, navigates with wrapping, and closes', () => {
    const messages = [
      message('first', 'Alpha one'),
      message('second', 'unrelated'),
      message('third', 'another ALPHA'),
    ];
    const search = useChatSearch({ getMessages: () => messages });

    expect(search.isOpen).toBe(false);
    expect(search.query).toBe('');
    expect(search.matches).toEqual([]);
    expect(search.matchCount).toBe(0);
    expect(search.currentMatch).toBeNull();
    search.nextMatch();
    search.previousMatch();

    search.open();
    search.setQuery(' alpha ');
    expect(search.isOpen).toBe(true);
    expect(search.query).toBe(' alpha ');
    expect(search.matches.map((match) => match.message.id)).toEqual(['first', 'third']);
    expect(search.currentMatch?.message.id).toBe('first');
    expect(search.currentMatchIndex).toBe(0);

    search.nextMatch();
    expect(search.currentMatch?.message.id).toBe('third');
    search.nextMatch();
    expect(search.currentMatch?.message.id).toBe('first');
    search.previousMatch();
    expect(search.currentMatch?.message.id).toBe('third');

    search.close();
    expect(search.isOpen).toBe(false);
    expect(search.query).toBe('');
    expect(search.currentMatchIndex).toBe(0);
  });
});
