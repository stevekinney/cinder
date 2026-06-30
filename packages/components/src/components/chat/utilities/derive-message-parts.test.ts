/**
 * Unit tests for `deriveMessageParts` — the pure bridge from the published
 * {@link Message} mirror to the cinder-owned {@link ChatMessagePart} render
 * layer. The bridge must mirror the historical role-branch rendering exactly:
 * tool-call / tool-result / markdown bodies, images as trailing parts, stable
 * per-part keys, and streaming-override resolution — all without re-deriving
 * conversation-global pairing.
 */

import { describe, expect, it } from 'bun:test';

import type { Message, MultiModalContent, ToolCallPair } from '../conversation-model.ts';
import { deriveMessageParts } from './utilities.ts';

function message(overrides: Partial<Message> & Pick<Message, 'role'>): Message {
  return {
    id: 'm1',
    content: '',
    position: 0,
    createdAt: '2026-06-02T00:00:00.000Z',
    metadata: {},
    hidden: false,
    ...overrides,
  };
}

describe('deriveMessageParts — markdown body', () => {
  it('derives a single markdown body part from string content', () => {
    const parts = deriveMessageParts(message({ role: 'assistant', content: 'Hello world' }));
    expect(parts).toEqual([
      {
        type: 'markdown',
        key: 'm1:body',
        content: 'Hello world',
        streaming: false,
        expanded: true,
      },
    ]);
  });

  it('keys the body part independently of its text (no remount as it grows)', () => {
    const short = deriveMessageParts(message({ role: 'assistant', content: 'Hi' }));
    const long = deriveMessageParts(message({ role: 'assistant', content: 'Hi there, friend' }));
    expect(short[0]?.key).toBe('m1:body');
    expect(long[0]?.key).toBe('m1:body');
  });

  it('resolves the streaming override into the body content', () => {
    const parts = deriveMessageParts(message({ role: 'assistant', content: 'final' }), {
      overrideContent: 'partial toke',
      streaming: true,
    });
    expect(parts[0]).toMatchObject({ type: 'markdown', content: 'partial toke', streaming: true });
  });

  it('forwards the expanded flag', () => {
    const parts = deriveMessageParts(message({ role: 'assistant', content: 'x' }), {
      expanded: false,
    });
    expect(parts[0]).toMatchObject({ type: 'markdown', expanded: false });
  });

  it('joins text segments of a multi-modal array into one markdown body', () => {
    const content: MultiModalContent[] = [
      { type: 'text', text: 'line one' },
      { type: 'text', text: 'line two' },
    ];
    const parts = deriveMessageParts(message({ role: 'user', content }));
    expect(parts).toHaveLength(1);
    expect(parts[0]).toMatchObject({ type: 'markdown', content: 'line one\nline two' });
  });

  it('renders published thinking content through the reasoning part', () => {
    const content: MultiModalContent[] = [
      { type: 'thinking', thinking: 'private reasoning', signature: 'sig-1' },
      { type: 'text', text: 'final answer' },
    ];
    const parts = deriveMessageParts(message({ role: 'assistant', content }));
    expect(parts.map((part) => part.type)).toEqual(['reasoning', 'markdown']);
    expect(parts[0]).toMatchObject({ type: 'reasoning', content: 'private reasoning' });
    expect(parts[1]).toMatchObject({ type: 'markdown', content: 'final answer' });
  });

  it('honors explicit reasoning suppression for published thinking content', () => {
    const content: MultiModalContent[] = [
      { type: 'thinking', thinking: 'private reasoning', signature: 'sig-1' },
      { type: 'text', text: 'final answer' },
    ];
    const parts = deriveMessageParts(message({ role: 'assistant', content }), { reasoning: '' });
    expect(parts.map((part) => part.type)).toEqual(['markdown']);
    expect(parts[0]).toMatchObject({ type: 'markdown', content: 'final answer' });
  });

  it('renders redacted thinking as a non-secret reasoning placeholder', () => {
    const content: MultiModalContent[] = [
      { type: 'redacted_thinking', data: 'encrypted-payload' },
      { type: 'text', text: 'final answer' },
    ];
    const parts = deriveMessageParts(message({ role: 'assistant', content }));
    expect(parts.map((part) => part.type)).toEqual(['reasoning', 'markdown']);
    expect(parts[0]).toMatchObject({
      type: 'reasoning',
      content: 'Redacted reasoning is preserved in this transcript but cannot be displayed.',
    });
    expect(parts[0]).not.toMatchObject({ content: 'encrypted-payload' });
  });

  it('renders published server tool content as markdown summaries', () => {
    const content: MultiModalContent[] = [
      { type: 'server_tool_use', id: 'tool-1', name: 'web_search', input: { query: 'cinder' } },
      { type: 'web_search_tool_result', tool_use_id: 'tool-1', content: { title: 'Result' } },
      { type: 'container_upload', file_id: 'file-1' },
    ];
    const parts = deriveMessageParts(message({ role: 'assistant', content }));
    expect(parts).toHaveLength(1);
    expect(parts[0]).toMatchObject({ type: 'markdown' });
    const markdown = parts[0];
    expect(markdown?.type).toBe('markdown');
    if (markdown?.type !== 'markdown') throw new Error('expected markdown part');
    expect(markdown.content).toContain('Server tool use: web_search');
    expect(markdown.content).toContain('Web search result: tool-1');
    expect(markdown.content).toContain('Container upload: file-1');
  });
});

describe('deriveMessageParts — images', () => {
  it('emits one image part per image, after the markdown body, keyed by content index', () => {
    const content: MultiModalContent[] = [
      { type: 'text', text: 'caption' },
      { type: 'image', url: 'https://example.test/a.png' },
      { type: 'image', url: 'https://example.test/b.png', text: 'b' },
    ];
    const parts = deriveMessageParts(message({ role: 'user', content }));
    expect(parts.map((part) => part.type)).toEqual(['markdown', 'image', 'image']);
    expect(parts[1]).toEqual({
      type: 'image',
      key: 'm1:image:1',
      image: { type: 'image', url: 'https://example.test/a.png' },
    });
    expect(parts[2]).toMatchObject({ key: 'm1:image:2' });
  });

  it('gives two images with identical urls distinct keys (index-based identity)', () => {
    const content: MultiModalContent[] = [
      { type: 'image', url: 'https://example.test/dup.png' },
      { type: 'image', url: 'https://example.test/dup.png' },
    ];
    const parts = deriveMessageParts(message({ role: 'user', content }));
    const imageKeys = parts.filter((part) => part.type === 'image').map((part) => part.key);
    // No leading text, so the images sit at content indices 0 and 1. Identical
    // urls, distinct keys — identity comes from the content index, not the url.
    expect(imageKeys).toEqual(['m1:image:0', 'm1:image:1']);
    expect(new Set(imageKeys).size).toBe(2);
  });

  it('a string body yields no image parts', () => {
    const parts = deriveMessageParts(message({ role: 'assistant', content: 'no images here' }));
    expect(parts.filter((part) => part.type === 'image')).toHaveLength(0);
  });
});

describe('deriveMessageParts — tool-call body', () => {
  const toolCall = { id: 'call-1', name: 'search', arguments: { q: 'svelte' } };

  it('emits a tool-call part carrying the resolved pair', () => {
    const pair: ToolCallPair = {
      call: toolCall,
      result: { callId: 'call-1', outcome: 'success', content: 'ok' },
    };
    const parts = deriveMessageParts(message({ id: 'tc', role: 'tool-call', toolCall }), {
      toolCallPair: pair,
    });
    expect(parts).toEqual([{ type: 'tool-call', key: 'tc:tool-call:call-1', pair }]);
  });

  it('renders a still-pending call (pair present, result undefined) as a tool-call part', () => {
    // The real container always supplies a pair for a tool-call message; while
    // the result is pending the pair's `result` is undefined. That must still
    // render the card, not fall through to text.
    const pair: ToolCallPair = { call: toolCall };
    const parts = deriveMessageParts(message({ id: 'tc', role: 'tool-call', toolCall }), {
      toolCallPair: pair,
    });
    expect(parts).toEqual([{ type: 'tool-call', key: 'tc:tool-call:call-1', pair }]);
    expect((parts[0] as { pair: ToolCallPair }).pair.result).toBeUndefined();
  });

  it('falls through to the markdown body when no pair was resolved (matches the original guard)', () => {
    // Original behavior: a tool-call message with no matching pair rendered its
    // plain text body, not a pending card. With no `toolCallPair` in context,
    // derive falls through to markdown.
    const parts = deriveMessageParts(
      message({ id: 'tc', role: 'tool-call', toolCall, content: 'raw tool text' }),
    );
    expect(parts).toEqual([
      {
        type: 'markdown',
        key: 'tc:body',
        content: 'raw tool text',
        streaming: false,
        expanded: true,
      },
    ]);
  });

  it('falls back to a markdown body for a tool-call role with no toolCall field', () => {
    const parts = deriveMessageParts(message({ role: 'tool-call', content: 'orphan' }));
    expect(parts[0]).toMatchObject({ type: 'markdown', content: 'orphan' });
  });

  it('appends image parts after the tool-call part (attachments render for tool roles too)', () => {
    const content: MultiModalContent[] = [
      { type: 'text', text: 'see image' },
      { type: 'image', url: 'https://example.test/tool.png' },
    ];
    const parts = deriveMessageParts(message({ id: 'tc', role: 'tool-call', toolCall, content }), {
      toolCallPair: { call: toolCall },
    });
    expect(parts.map((part) => part.type)).toEqual(['tool-call', 'image']);
    expect(parts[1]).toMatchObject({ type: 'image', key: 'tc:image:1' });
  });
});

describe('deriveMessageParts — tool-result body', () => {
  it('emits a tool-result part carrying the structured result, keyed by callId', () => {
    const result = {
      callId: 'call-9',
      outcome: 'error' as const,
      content: null,
      error: {
        code: 'E',
        category: 'internal' as const,
        retryable: false,
        message: 'boom',
      },
    };
    const parts = deriveMessageParts(
      message({ id: 'tr', role: 'tool-result', toolResult: result }),
    );
    expect(parts).toEqual([{ type: 'tool-result', key: 'tr:tool-result:call-9', result }]);
  });

  it('falls back to a markdown body for a tool-result role with no toolResult field', () => {
    const parts = deriveMessageParts(message({ role: 'tool-result', content: 'orphan result' }));
    expect(parts[0]).toMatchObject({ type: 'markdown', content: 'orphan result' });
  });
});

describe('deriveMessageParts — purity', () => {
  it('does not mutate the message or the context', () => {
    const original = message({ role: 'assistant', content: 'stable' });
    const frozen = Object.freeze({ ...original });
    const context = Object.freeze({ streaming: true, expanded: false });
    expect(() => deriveMessageParts(frozen, context)).not.toThrow();
    expect(frozen.content).toBe('stable');
  });

  it('is callable with no context (defaults applied)', () => {
    const parts = deriveMessageParts(message({ role: 'assistant', content: 'x' }));
    expect(parts[0]).toMatchObject({ streaming: false, expanded: true });
  });
});
