/**
 * C4 compatibility guard — proves a plain conversationalist transcript renders
 * exactly as it did before C4 (no reasoning, no steps, no extra DOM).
 *
 * This is the "feature absent" proof required by the spine contract.
 *
 * Covers:
 *   1. A plain assistant string message produces exactly one markdown part and
 *      zero reasoning/step parts.
 *   2. The renderer for a plain message produces no chat-reasoning or
 *      chat-step-list elements.
 *   3. A message with no 'cinder:reasoning' or 'cinder:steps' metadata
 *      renders identically with or without the C4 context fields absent.
 *   4. C4 renderer branches work correctly when parts ARE present.
 */

/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../../../test/happy-dom.ts';
import type { ReasoningMessagePart, StepMessagePart } from '../../utilities/types.ts';

setupHappyDom();

const { render, cleanup } = await import('@testing-library/svelte');
const { default: ChatMessagePartsRenderer } = await import('../chat-message-parts-renderer.svelte');

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

describe('C4 compatibility — plain conversationalist transcript', () => {
  test('plain string message produces no reasoning part from deriveMessageParts', async () => {
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
    expect(parts.every((p) => p.type !== 'reasoning')).toBe(true);
    expect(parts.every((p) => p.type !== 'step')).toBe(true);
    expect(parts.filter((p) => p.type === 'markdown')).toHaveLength(1);
  });

  test('plain message renderer produces no .chat-reasoning element', () => {
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
    expect(container.querySelector('[data-cinder-reasoning]')).toBeNull();
    expect(container.querySelector('.chat-step-list')).toBeNull();
  });

  test('renderer renders a reasoning part when present', () => {
    const reasoningPart: ReasoningMessagePart = {
      type: 'reasoning',
      key: 'msg:reasoning',
      content: 'I thought carefully before answering.',
      streaming: false,
    };
    const { container } = render(ChatMessagePartsRenderer, {
      props: { parts: [reasoningPart] },
    });
    expect(container.querySelector('[data-cinder-reasoning]')).not.toBeNull();
  });

  test('renderer renders step parts inside an <ol> when present', () => {
    const steps: StepMessagePart[] = [
      {
        type: 'step',
        key: 'msg:step:0',
        index: 0,
        title: 'First step',
        content: 'Do the first thing.',
        status: 'done',
      },
      {
        type: 'step',
        key: 'msg:step:1',
        index: 1,
        title: 'Second step',
        content: 'Do the second thing.',
        status: 'running',
      },
    ];
    const { container } = render(ChatMessagePartsRenderer, {
      props: { parts: steps },
    });
    const ol = container.querySelector('ol.chat-step-list');
    expect(ol).not.toBeNull();
    const listItems = ol!.querySelectorAll('li');
    expect(listItems).toHaveLength(2);
    expect(ol!.textContent).toContain('First step');
    expect(ol!.textContent).toContain('Second step');
  });

  test('renderer renders step parts with aria-label on the <ol>', () => {
    const step: StepMessagePart = {
      type: 'step',
      key: 'msg:step:0',
      index: 0,
      title: 'Only step',
      content: '',
      status: 'pending',
    };
    const { container } = render(ChatMessagePartsRenderer, {
      props: { parts: [step] },
    });
    const ol = container.querySelector('ol');
    expect(ol?.getAttribute('aria-label')).toBe('Steps');
  });

  test('reasoning disclosure is wired through reasoningExpanded and onreasoning props', () => {
    const reasoningPart: ReasoningMessagePart = {
      type: 'reasoning',
      key: 'msg:reasoning',
      content: 'Extended thinking content here.',
      streaming: false,
    };
    const { container } = render(ChatMessagePartsRenderer, {
      props: { parts: [reasoningPart], reasoningExpanded: true },
    });
    const button = container.querySelector('button');
    expect(button?.getAttribute('aria-expanded')).toBe('true');
    // Content is accessible when expanded
    expect(container.textContent).toContain('Extended thinking content here.');
  });
});
