import { describe, expect, it } from 'bun:test';

import type { Message, MultiModalContent } from '../conversation-model.ts';
import {
  getMessageParts,
  getMessageRoleLabel,
  resolveMessageReasoning,
  resolveMessageSteps,
  resolveMessageSuggestions,
  toMultiModalArray,
} from './utilities.ts';

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

describe('resolveMessageReasoning', () => {
  it('returns undefined for a plain message (no prop, no metadata) — feature absent', () => {
    expect(resolveMessageReasoning(message({ role: 'assistant' }))).toBeUndefined();
  });

  it('reads non-empty cinder:reasoning metadata', () => {
    const m = message({ role: 'assistant', metadata: { 'cinder:reasoning': 'I thought hard' } });
    expect(resolveMessageReasoning(m)).toBe('I thought hard');
  });

  it('treats empty-string metadata as absent', () => {
    const m = message({ role: 'assistant', metadata: { 'cinder:reasoning': '' } });
    expect(resolveMessageReasoning(m)).toBeUndefined();
  });

  it('ignores non-string metadata', () => {
    const m = message({ role: 'assistant', metadata: { 'cinder:reasoning': 42 } });
    expect(resolveMessageReasoning(m)).toBeUndefined();
  });

  it('prefers an explicit prop over metadata', () => {
    const m = message({ role: 'assistant', metadata: { 'cinder:reasoning': 'meta' } });
    expect(resolveMessageReasoning(m, () => 'prop')).toBe('prop');
  });

  it('returns undefined when a throwing callback is given (never breaks render)', () => {
    const m = message({ role: 'assistant', metadata: { 'cinder:reasoning': 'meta' } });
    expect(
      resolveMessageReasoning(m, () => {
        throw new Error('consumer bug');
      }),
    ).toBeUndefined();
  });
});

describe('resolveMessageSteps', () => {
  const validStep = { title: 'Plan', content: 'Do it', status: 'done' as const };

  it('returns undefined for a plain message', () => {
    expect(resolveMessageSteps(message({ role: 'assistant' }))).toBeUndefined();
  });

  it('reads and validates cinder:steps metadata, dropping invalid entries', () => {
    const m = message({
      role: 'assistant',
      metadata: {
        'cinder:steps': [
          validStep,
          { title: 'bad', content: 'x', status: 'nope' },
          { title: 'no-content', status: 'done' },
        ],
      },
    });
    expect(resolveMessageSteps(m)).toEqual([validStep]);
  });

  it('returns undefined when all entries are invalid', () => {
    const m = message({ role: 'assistant', metadata: { 'cinder:steps': [{ bogus: true }] } });
    expect(resolveMessageSteps(m)).toBeUndefined();
  });

  it('prefers an explicit prop over metadata', () => {
    const m = message({ role: 'assistant', metadata: { 'cinder:steps': [validStep] } });
    const other = { title: 'Prop', content: 'c', status: 'running' as const };
    expect(resolveMessageSteps(m, () => [other])).toEqual([other]);
  });

  it('returns undefined when the callback throws', () => {
    expect(
      resolveMessageSteps(message({ role: 'assistant' }), () => {
        throw new Error('consumer bug');
      }),
    ).toBeUndefined();
  });
});

describe('resolveMessageSuggestions', () => {
  it('returns undefined for a plain message', () => {
    expect(resolveMessageSuggestions(message({ role: 'assistant' }))).toBeUndefined();
  });

  it('reads cinder:suggestions metadata, dropping non-strings', () => {
    const m = message({
      role: 'assistant',
      metadata: { 'cinder:suggestions': ['Yes', 7, 'No', null] },
    });
    expect(resolveMessageSuggestions(m)).toEqual(['Yes', 'No']);
  });

  it('returns undefined for an all-invalid array', () => {
    const m = message({ role: 'assistant', metadata: { 'cinder:suggestions': [1, 2, 3] } });
    expect(resolveMessageSuggestions(m)).toBeUndefined();
  });

  it('prefers an explicit prop over metadata', () => {
    const m = message({ role: 'assistant', metadata: { 'cinder:suggestions': ['meta'] } });
    expect(resolveMessageSuggestions(m, () => ['prop'])).toEqual(['prop']);
  });

  it('returns undefined when the callback throws', () => {
    expect(
      resolveMessageSuggestions(message({ role: 'assistant' }), () => {
        throw new Error('consumer bug');
      }),
    ).toBeUndefined();
  });
});
