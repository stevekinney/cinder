import { describe, expect, it } from 'bun:test';

import type { Message, MultiModalContent } from '../conversation-model.ts';
import { getMessageParts, getMessageRoleLabel, toMultiModalArray } from './utilities.ts';

function message(overrides: Partial<Message> & Pick<Message, 'role'>): Message {
  return {
    id: 'm',
    content: '',
    position: 0,
    createdAt: '2026-06-02T00:00:00.000Z',
    metadata: {},
    hidden: false,
    ...overrides,
  };
}

describe('toMultiModalArray', () => {
  it('wraps a string in a single text part', () => {
    expect(toMultiModalArray('hello')).toEqual([{ type: 'text', text: 'hello' }]);
  });

  it('wraps a single content item in an array', () => {
    const image: MultiModalContent = { type: 'image', url: 'https://example.test/a.png' };
    expect(toMultiModalArray(image)).toEqual([image]);
  });

  it('returns an array as-is', () => {
    const parts: MultiModalContent[] = [
      { type: 'text', text: 'a' },
      { type: 'image', url: 'https://example.test/b.png' },
    ];
    expect(toMultiModalArray(parts)).toBe(parts);
  });
});

describe('getMessageParts', () => {
  it('treats empty/missing content as a single empty text part', () => {
    const parts = getMessageParts({
      id: 'm',
      role: 'assistant',
      content: '',
      position: 0,
      createdAt: '2026-06-02T00:00:00.000Z',
      metadata: {},
      hidden: false,
    });
    expect(parts).toEqual([{ type: 'text', text: '' }]);
  });

  it('passes a readonly content array through without casts', () => {
    const content = [{ type: 'text', text: 'x' }] as const;
    const parts = getMessageParts(message({ role: 'assistant', content }));
    expect(parts).toEqual([{ type: 'text', text: 'x' }]);
  });
});

describe('getMessageRoleLabel', () => {
  // Regression guard for the 'tool-use' → 'tool-call' role rename: the label
  // map must key off the real MessageRole value, or tool-call messages fall
  // back to the raw role string.
  it.each([
    ['user', 'User'],
    ['assistant', 'Assistant'],
    ['system', 'System'],
    ['developer', 'Developer'],
    ['tool-call', 'Tool Call'],
    ['tool-result', 'Tool Result'],
    ['snapshot', 'Snapshot'],
  ] as const)('maps role %s to label %s', (role, label) => {
    expect(getMessageRoleLabel(message({ role }))).toBe(label);
  });
});
