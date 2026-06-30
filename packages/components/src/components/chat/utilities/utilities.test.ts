import { describe, expect, it } from 'bun:test';

import type { Message, MultiModalContent } from '../conversation-model.ts';
import {
  getMessageParts,
  getMessageRoleLabel,
  getMessageText,
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

describe('getMessageText', () => {
  it('serializes published server tool content blocks instead of dropping them', () => {
    const content: MultiModalContent[] = [
      { type: 'server_tool_use', id: 'tool-1', name: 'web_search', input: { query: 'cinder' } },
      { type: 'web_search_tool_result', tool_use_id: 'tool-1', content: { title: 'Result' } },
      {
        type: 'code_execution_tool_result',
        tool_use_id: 'tool-2',
        content: { stdout: 'ok' },
      },
      { type: 'container_upload', file_id: 'file-1' },
    ];

    expect(getMessageText(message({ role: 'assistant', content }))).toContain(
      'Server tool use: web_search',
    );
    expect(getMessageText(message({ role: 'assistant', content }))).toContain(
      'Web search result: tool-1',
    );
    expect(getMessageText(message({ role: 'assistant', content }))).toContain(
      'Server tool result: tool-2',
    );
    expect(getMessageText(message({ role: 'assistant', content }))).toContain(
      'Container upload: file-1',
    );
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

  it('a throwing callback never breaks render and falls back to metadata', () => {
    const m = message({ role: 'assistant', metadata: { 'cinder:reasoning': 'meta' } });
    // A buggy/throwing callback is treated as "no opinion" — it must not crash
    // the render, and it must not suppress valid metadata.
    expect(
      resolveMessageReasoning(m, () => {
        throw new Error('consumer bug');
      }),
    ).toBe('meta');
  });

  it('a callback returning undefined falls back to cinder:reasoning metadata', () => {
    const m = message({ role: 'assistant', metadata: { 'cinder:reasoning': 'meta' } });
    expect(resolveMessageReasoning(m, () => undefined)).toBe('meta');
  });

  it('a callback returning an empty string suppresses reasoning (does NOT fall back)', () => {
    const m = message({ role: 'assistant', metadata: { 'cinder:reasoning': 'meta' } });
    expect(resolveMessageReasoning(m, () => '')).toBeUndefined();
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

  it('a throwing callback falls back to metadata (never breaks render)', () => {
    const m = message({ role: 'assistant', metadata: { 'cinder:steps': [validStep] } });
    expect(
      resolveMessageSteps(m, () => {
        throw new Error('consumer bug');
      }),
    ).toEqual([validStep]);
  });

  it('a callback returning undefined falls back to cinder:steps metadata', () => {
    const m = message({ role: 'assistant', metadata: { 'cinder:steps': [validStep] } });
    expect(resolveMessageSteps(m, () => undefined)).toEqual([validStep]);
  });

  it('a prop returning an empty array suppresses steps even when metadata has valid entries', () => {
    const m = message({ role: 'assistant', metadata: { 'cinder:steps': [validStep] } });
    expect(resolveMessageSteps(m, () => [])).toBeUndefined();
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

  it('a throwing callback falls back to metadata (never breaks render)', () => {
    const m = message({ role: 'assistant', metadata: { 'cinder:suggestions': ['meta'] } });
    expect(
      resolveMessageSuggestions(m, () => {
        throw new Error('consumer bug');
      }),
    ).toEqual(['meta']);
  });

  it('a callback returning undefined falls back to cinder:suggestions metadata', () => {
    const m = message({ role: 'assistant', metadata: { 'cinder:suggestions': ['meta'] } });
    expect(resolveMessageSuggestions(m, () => undefined)).toEqual(['meta']);
  });

  it('a callback returning an empty array suppresses suggestions (does NOT fall back)', () => {
    const m = message({ role: 'assistant', metadata: { 'cinder:suggestions': ['meta'] } });
    expect(resolveMessageSuggestions(m, () => [])).toBeUndefined();
  });
});
