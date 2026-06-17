/**
 * Tests for reasoning-part.svelte (C4).
 *
 * Covers:
 *   1. Renders a disclosure button with aria-expanded=false by default.
 *   2. Expanded=true reveals the reasoning content.
 *   3. Clicking the toggle fires ontoggle.
 *   4. aria-expanded matches the expanded prop.
 *   5. aria-controls points to the content region.
 *   6. While streaming, the toggle button is disabled.
 *   7. While streaming, a pulsing dot is present.
 *   8. While streaming, the content region has aria-live="off".
 *   9. While streaming=false and expanded=true, a "Reasoning complete." polite region is present.
 *  10. Empty content edge case: still renders (caller is responsible for guarding).
 *  11. Token count is shown in the label.
 *  12. data-cinder-reasoning attribute is present.
 *  13. data-cinder-streaming is set/absent based on streaming prop.
 *  14. data-cinder-expanded is set/absent based on expanded prop.
 *  15. PROVE absent by default: a plain message without reasoning context produces
 *      no reasoning part (via deriveMessageParts).
 */

/// <reference lib="dom" />
import { afterEach, describe, expect, mock, test } from 'bun:test';
import { flushSync } from 'svelte';

import { setupHappyDom } from '../../../../test/happy-dom.ts';
import type { ReasoningMessagePart } from '../../utilities/types.ts';

setupHappyDom();

const { render, cleanup, fireEvent } = await import('@testing-library/svelte');
const { default: ReasoningPart } = await import('./reasoning-part.svelte');

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

function makePart(overrides?: Partial<ReasoningMessagePart>): ReasoningMessagePart {
  return {
    type: 'reasoning',
    key: 'm1:reasoning',
    content: 'This is my extended reasoning about the problem.',
    streaming: false,
    ...overrides,
  };
}

describe('ReasoningPart — collapsed state (default)', () => {
  test('renders a disclosure button', () => {
    const { container } = render(ReasoningPart, { props: { part: makePart() } });
    const button = container.querySelector('button');
    expect(button).not.toBeNull();
  });

  test('aria-expanded is false when expanded prop is false', () => {
    const { container } = render(ReasoningPart, {
      props: { part: makePart(), expanded: false },
    });
    const button = container.querySelector('button');
    expect(button?.getAttribute('aria-expanded')).toBe('false');
  });

  test('has data-cinder-reasoning attribute', () => {
    const { container } = render(ReasoningPart, { props: { part: makePart() } });
    expect(container.querySelector('[data-cinder-reasoning]')).not.toBeNull();
  });

  test('data-cinder-expanded is absent when collapsed', () => {
    const { container } = render(ReasoningPart, {
      props: { part: makePart(), expanded: false },
    });
    const root = container.querySelector('[data-cinder-reasoning]');
    expect(root?.hasAttribute('data-cinder-expanded')).toBe(false);
  });

  test('clicking the toggle fires ontoggle', () => {
    const ontoggle = mock(() => {});
    const { container } = render(ReasoningPart, {
      props: { part: makePart(), expanded: false, ontoggle },
    });
    const button = container.querySelector('button');
    expect(button).not.toBeNull();
    button && fireEvent.click(button);
    flushSync();
    expect(ontoggle).toHaveBeenCalledTimes(1);
  });

  test('button has aria-controls pointing to the content region', () => {
    const { container } = render(ReasoningPart, { props: { part: makePart() } });
    const button = container.querySelector('button');
    const controlsId = button?.getAttribute('aria-controls');
    expect(controlsId).toBeTruthy();
    const controlled = controlsId ? container.querySelector(`#${controlsId}`) : null;
    expect(controlled).not.toBeNull();
  });
});

describe('ReasoningPart — expanded state', () => {
  test('aria-expanded is true when expanded prop is true', () => {
    const { container } = render(ReasoningPart, {
      props: { part: makePart(), expanded: true },
    });
    const button = container.querySelector('button');
    expect(button?.getAttribute('aria-expanded')).toBe('true');
  });

  test('data-cinder-expanded is present when expanded', () => {
    const { container } = render(ReasoningPart, {
      props: { part: makePart(), expanded: true },
    });
    const root = container.querySelector('[data-cinder-reasoning]');
    expect(root?.hasAttribute('data-cinder-expanded')).toBe(true);
  });

  test('content is in the DOM when expanded', () => {
    const { container } = render(ReasoningPart, {
      props: { part: makePart(), expanded: true },
    });
    expect(container.textContent).toContain('This is my extended reasoning about the problem.');
  });

  test('"Reasoning complete." polite region is present when expanded and not streaming', () => {
    const { container } = render(ReasoningPart, {
      props: { part: makePart({ streaming: false }), expanded: true },
    });
    // There should be an aria-live="polite" region with "Reasoning complete."
    const liveRegions = container.querySelectorAll('[aria-live="polite"]');
    const hasComplete = Array.from(liveRegions).some((el) =>
      el.textContent?.includes('Reasoning complete.'),
    );
    expect(hasComplete).toBe(true);
  });
});

describe('ReasoningPart — streaming state', () => {
  test('toggle button is disabled when streaming', () => {
    const { container } = render(ReasoningPart, {
      props: { part: makePart({ streaming: true }) },
    });
    const button = container.querySelector('button');
    expect(button?.disabled).toBe(true);
  });

  test('clicking disabled toggle does not fire ontoggle', () => {
    const ontoggle = mock(() => {});
    const { container } = render(ReasoningPart, {
      props: { part: makePart({ streaming: true }), ontoggle },
    });
    const button = container.querySelector('button');
    button && fireEvent.click(button);
    flushSync();
    expect(ontoggle).toHaveBeenCalledTimes(0);
  });

  test('data-cinder-streaming is present when streaming', () => {
    const { container } = render(ReasoningPart, {
      props: { part: makePart({ streaming: true }) },
    });
    const root = container.querySelector('[data-cinder-reasoning]');
    expect(root?.hasAttribute('data-cinder-streaming')).toBe(true);
  });

  test('data-cinder-streaming is absent when not streaming', () => {
    const { container } = render(ReasoningPart, {
      props: { part: makePart({ streaming: false }) },
    });
    const root = container.querySelector('[data-cinder-reasoning]');
    expect(root?.hasAttribute('data-cinder-streaming')).toBe(false);
  });

  test('content region has aria-live="off" while streaming', () => {
    const { container } = render(ReasoningPart, {
      props: { part: makePart({ streaming: true }), expanded: true },
    });
    const button = container.querySelector('button');
    const contentId = button?.getAttribute('aria-controls');
    const contentEl = contentId ? container.querySelector(`#${contentId}`) : null;
    expect(contentEl?.getAttribute('aria-live')).toBe('off');
  });

  test('content region has no aria-live when not streaming', () => {
    const { container } = render(ReasoningPart, {
      props: { part: makePart({ streaming: false }), expanded: true },
    });
    const button = container.querySelector('button');
    const contentId = button?.getAttribute('aria-controls');
    const contentEl = contentId ? container.querySelector(`#${contentId}`) : null;
    expect(contentEl?.getAttribute('aria-live')).toBeNull();
  });

  test('pulsing dot is present in the label when streaming', () => {
    const { container } = render(ReasoningPart, {
      props: { part: makePart({ streaming: true }) },
    });
    // The dot has class chat-reasoning-dot
    expect(container.querySelector('.chat-reasoning-dot')).not.toBeNull();
  });

  test('pulsing dot is absent when not streaming', () => {
    const { container } = render(ReasoningPart, {
      props: { part: makePart({ streaming: false }) },
    });
    expect(container.querySelector('.chat-reasoning-dot')).toBeNull();
  });
});

describe('ReasoningPart — token count display', () => {
  test('shows approximate token count in the label for non-empty content', () => {
    // 40 chars → ~10 tokens
    const part = makePart({ content: 'a'.repeat(40) });
    const { container } = render(ReasoningPart, { props: { part } });
    const label = container.querySelector('.chat-reasoning-label');
    // Should contain the approximate token count (10)
    expect(label?.textContent).toContain('10');
  });
});

describe('ReasoningPart — stable DOM under content updates', () => {
  test('updating content does not remount the disclosure button', () => {
    const { container, rerender } = render(ReasoningPart, {
      props: { part: makePart({ content: 'first token', streaming: true }) },
    });
    const button1 = container.querySelector('button');

    rerender({ part: makePart({ content: 'first token second', streaming: true }) });
    flushSync();

    const button2 = container.querySelector('button');
    // Same DOM node — no remount
    expect(button1).toBe(button2);
  });
});

describe('ReasoningPart — absence for plain messages', () => {
  test('deriveMessageParts without reasoning context produces no reasoning part', async () => {
    const { deriveMessageParts } = await import('../../utilities/utilities.ts');
    const message = {
      id: 'msg-plain',
      role: 'assistant' as const,
      content: 'Hello, world!',
      position: 0,
      metadata: {},
      hidden: false,
      createdAt: new Date().toISOString(),
    };
    const parts = deriveMessageParts(message, {});
    const hasReasoning = parts.some((p) => p.type === 'reasoning');
    expect(hasReasoning).toBe(false);
  });

  test('deriveMessageParts with empty string reasoning produces no reasoning part', async () => {
    const { deriveMessageParts } = await import('../../utilities/utilities.ts');
    const message = {
      id: 'msg-empty-reasoning',
      role: 'assistant' as const,
      content: 'Answer here.',
      position: 0,
      metadata: {},
      hidden: false,
      createdAt: new Date().toISOString(),
    };
    const parts = deriveMessageParts(message, { reasoning: '' });
    const hasReasoning = parts.some((p) => p.type === 'reasoning');
    expect(hasReasoning).toBe(false);
  });

  test('deriveMessageParts with non-empty reasoning emits a reasoning part before markdown', async () => {
    const { deriveMessageParts } = await import('../../utilities/utilities.ts');
    const message = {
      id: 'msg-with-reasoning',
      role: 'assistant' as const,
      content: 'Final answer.',
      position: 0,
      metadata: {},
      hidden: false,
      createdAt: new Date().toISOString(),
    };
    const parts = deriveMessageParts(message, { reasoning: 'I thought about it carefully.' });
    const reasoningIndex = parts.findIndex((p) => p.type === 'reasoning');
    const markdownIndex = parts.findIndex((p) => p.type === 'markdown');
    expect(reasoningIndex).toBeGreaterThanOrEqual(0);
    expect(markdownIndex).toBeGreaterThanOrEqual(0);
    expect(reasoningIndex).toBeLessThan(markdownIndex);
  });
});
