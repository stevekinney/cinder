/**
 * C5 compatibility guard — proves a plain conversationalist transcript renders
 * exactly as it did before C5 (no suggestions, no extra DOM).
 *
 * This is the "feature absent" proof required by the spine contract.
 *
 * Covers:
 *   1. A plain assistant string message produces exactly one markdown part and
 *      zero suggestion parts.
 *   2. The renderer for a plain message produces no [data-cinder-suggested-replies]
 *      element.
 *   3. A message with no 'cinder:suggestions' metadata renders identically with
 *      or without the C5 context field absent.
 *   4. C5 renderer branch works correctly when suggestion parts ARE present.
 *   5. A tool-call or tool-result message (non-default branch) produces no
 *      suggestion parts — suggestions are only emitted in the markdown/default branch.
 */

/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../../../test/happy-dom.ts';
import type { SuggestionMessagePart } from '../../utilities/types.ts';

setupHappyDom();

const { render, cleanup } = await import('@testing-library/svelte');
const { default: ChatMessagePartsRenderer } = await import('../chat-message-parts-renderer.svelte');

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

describe('C5 compatibility — plain conversationalist transcript', () => {
  test('plain string message produces no suggestion parts from deriveMessageParts', async () => {
    const { deriveMessageParts } = await import('../../utilities/utilities.ts');
    const message = {
      id: 'plain-msg',
      role: 'assistant' as const,
      content: 'Hello, I am an assistant.',
      position: 0,
      metadata: {},
      hidden: false,
      createdAt: new Date().toISOString(),
    };
    const parts = deriveMessageParts(message);
    expect(parts.every((part) => part.type !== 'suggestion')).toBe(true);
    expect(parts.filter((part) => part.type === 'markdown')).toHaveLength(1);
  });

  test('plain message renderer produces no [data-cinder-suggested-replies] element', () => {
    const { container } = render(ChatMessagePartsRenderer, {
      props: {
        parts: [
          {
            type: 'markdown',
            key: 'plain:body',
            content: 'Hello, I am an assistant.',
            streaming: false,
            expanded: true,
          },
        ],
      },
    });
    expect(container.querySelector('[data-cinder-suggested-replies]')).toBeNull();
    expect(container.querySelector('[role="toolbar"]')).toBeNull();
  });

  test('message with no cinder:suggestions metadata produces no suggestion parts', async () => {
    const { deriveMessageParts } = await import('../../utilities/utilities.ts');
    const message = {
      id: 'no-meta-msg',
      role: 'assistant' as const,
      content: 'A plain answer.',
      position: 0,
      metadata: { 'cinder:reasoning': 'Some reasoning.' },
      hidden: false,
      createdAt: new Date().toISOString(),
    };
    const parts = deriveMessageParts(message);
    expect(parts.some((part) => part.type === 'suggestion')).toBe(false);
  });

  test('tool-call branch produces no suggestion parts even with suggestions context', async () => {
    const { deriveMessageParts } = await import('../../utilities/utilities.ts');
    const toolCall = { id: 'call-1', name: 'run_tests', arguments: {} };
    const message = {
      id: 'tool-call-msg',
      role: 'tool-call' as const,
      content: '',
      position: 0,
      metadata: {},
      hidden: false,
      toolCall,
      createdAt: new Date().toISOString(),
    };
    const parts = deriveMessageParts(message, {
      toolCallPair: { call: toolCall, result: undefined },
      suggestions: ['Suggestion A', 'Suggestion B'],
    });
    // tool-call branch returns early — no suggestion parts
    expect(parts.some((part) => part.type === 'suggestion')).toBe(false);
    expect(parts.some((part) => part.type === 'tool-call')).toBe(true);
  });

  test('renderer renders suggestion chips when suggestion parts ARE present', () => {
    const parts: SuggestionMessagePart[] = [
      { type: 'suggestion', key: 'msg:suggestion:0', index: 0, label: 'Option A' },
      { type: 'suggestion', key: 'msg:suggestion:1', index: 1, label: 'Option B' },
    ];
    const { container } = render(ChatMessagePartsRenderer, {
      props: { parts },
    });
    const toolbar = container.querySelector('[data-cinder-suggested-replies]');
    expect(toolbar).not.toBeNull();
    const buttons = toolbar!.querySelectorAll('button');
    expect(buttons).toHaveLength(2);
    const labels = Array.from(buttons).map((button) => button.textContent?.trim());
    expect(labels).toContain('Option A');
    expect(labels).toContain('Option B');
  });
});
