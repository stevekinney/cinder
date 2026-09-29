/** Unit and derivation tests for suggestion message parts. */

/// <reference lib="dom" />
import { afterEach, describe, expect, mock, test } from 'bun:test';
import { flushSync } from 'svelte';

import { setupHappyDom } from '@lostgradient/testing';
import type { SuggestionMessagePart } from '../../utilities/types.ts';

setupHappyDom();

const { render, cleanup, fireEvent } = await import('@testing-library/svelte');
const { default: SuggestionPart } = await import('./suggestion-part.svelte');

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

function makeSuggestion(
  label = 'Tell me more',
  index = 0,
  overrides?: Partial<SuggestionMessagePart>,
): SuggestionMessagePart {
  return {
    type: 'suggestion',
    key: `m1:suggestion:${index}`,
    index,
    label,
    ...overrides,
  };
}

// Component rendering
// ==========================================================================

describe('SuggestionPart — button rendering', () => {
  test('renders as a button element', () => {
    const { container } = render(SuggestionPart, { props: { part: makeSuggestion() } });
    const button = container.querySelector('button');
    expect(button).not.toBeNull();
  });

  test('button type is "button"', () => {
    const { container } = render(SuggestionPart, { props: { part: makeSuggestion() } });
    const button = container.querySelector('button');
    expect(button?.getAttribute('type')).toBe('button');
  });

  test('button text matches the suggestion label', () => {
    const { container } = render(SuggestionPart, {
      props: { part: makeSuggestion('Explain RAG in simple terms') },
    });
    const button = container.querySelector('button');
    expect(button?.textContent?.trim()).toBe('Explain RAG in simple terms');
  });

  test('has data-cinder-suggestion attribute', () => {
    const { container } = render(SuggestionPart, { props: { part: makeSuggestion() } });
    const button = container.querySelector('[data-cinder-suggestion]');
    expect(button).not.toBeNull();
  });

  test('long labels are still present as the button accessible name', () => {
    const longLabel = 'A '.repeat(80).trim();
    const { container } = render(SuggestionPart, {
      props: { part: makeSuggestion(longLabel) },
    });
    const button = container.querySelector('button');
    // The full text must be in the DOM even if CSS clips it visually
    expect(button?.textContent?.trim()).toBe(longLabel);
  });
});

// ==========================================================================
// Callback behaviour
// ==========================================================================

describe('SuggestionPart — callback', () => {
  test('clicking calls onSuggestionSelect with the label', () => {
    const onSuggestionSelect = mock((label: string) => label);
    const { container } = render(SuggestionPart, {
      props: { part: makeSuggestion('Tell me more'), onSuggestionSelect },
    });
    const button = container.querySelector('button')!;
    fireEvent.click(button);
    flushSync();
    expect(onSuggestionSelect).toHaveBeenCalledTimes(1);
    expect(onSuggestionSelect).toHaveBeenCalledWith('Tell me more');
  });

  test('clicking without a callback does not throw', () => {
    const { container } = render(SuggestionPart, { props: { part: makeSuggestion() } });
    const button = container.querySelector('button')!;
    expect(() => {
      fireEvent.click(button);
      flushSync();
    }).not.toThrow();
  });

  test('different suggestions call onSuggestionSelect with their own label', () => {
    const onSuggestionSelect = mock((label: string) => label);
    const { container: c1 } = render(SuggestionPart, {
      props: { part: makeSuggestion('Alpha', 0), onSuggestionSelect },
    });
    const { container: c2 } = render(SuggestionPart, {
      props: { part: makeSuggestion('Beta', 1), onSuggestionSelect },
    });

    fireEvent.click(c1.querySelector('button')!);
    fireEvent.click(c2.querySelector('button')!);
    flushSync();

    expect(onSuggestionSelect).toHaveBeenCalledTimes(2);
    expect(onSuggestionSelect).toHaveBeenNthCalledWith(1, 'Alpha');
    expect(onSuggestionSelect).toHaveBeenNthCalledWith(2, 'Beta');
  });
});

// ==========================================================================
// deriveMessageParts integration
// ==========================================================================

describe('SuggestionPart — derive integration', () => {
  test('plain message without suggestions produces no suggestion parts', async () => {
    const { deriveMessageParts } = await import('../../utilities/utilities.ts');
    const message = {
      id: 'plain-msg',
      role: 'assistant' as const,
      content: 'Hello, world!',
      position: 0,
      metadata: {},
      hidden: false,
      createdAt: new Date().toISOString(),
    };
    const parts = deriveMessageParts(message, {});
    expect(parts.some((part) => part.type === 'suggestion')).toBe(false);
  });

  test('absent suggestions context produces no suggestion parts', async () => {
    const { deriveMessageParts } = await import('../../utilities/utilities.ts');
    const message = {
      id: 'no-ctx-msg',
      role: 'assistant' as const,
      content: 'Answer here.',
      position: 0,
      metadata: {},
      hidden: false,
      createdAt: new Date().toISOString(),
    };
    // Context has no suggestions field at all
    const parts = deriveMessageParts(message);
    expect(parts.some((part) => part.type === 'suggestion')).toBe(false);
  });

  test('empty suggestions array produces no suggestion parts', async () => {
    const { deriveMessageParts } = await import('../../utilities/utilities.ts');
    const message = {
      id: 'empty-suggestions-msg',
      role: 'assistant' as const,
      content: 'Answer.',
      position: 0,
      metadata: {},
      hidden: false,
      createdAt: new Date().toISOString(),
    };
    const parts = deriveMessageParts(message, { suggestions: [] });
    expect(parts.some((part) => part.type === 'suggestion')).toBe(false);
  });

  test('suggestions are emitted after the markdown part and before images', async () => {
    const { deriveMessageParts } = await import('../../utilities/utilities.ts');
    const message = {
      id: 'msg-with-suggestions',
      role: 'assistant' as const,
      content: 'Final answer.',
      position: 0,
      metadata: {},
      hidden: false,
      createdAt: new Date().toISOString(),
    };
    const parts = deriveMessageParts(message, {
      suggestions: ['Option A', 'Option B', 'Option C'],
    });

    const markdownIndex = parts.findIndex((part) => part.type === 'markdown');
    const suggestionIndexes = parts
      .map((part, index) => ({ type: part.type, index }))
      .filter((entry) => entry.type === 'suggestion')
      .map((entry) => entry.index);

    expect(suggestionIndexes).toHaveLength(3);
    for (const suggestionIndex of suggestionIndexes) {
      expect(suggestionIndex).toBeGreaterThan(markdownIndex);
    }
  });

  test('suggestion parts carry correct index and label', async () => {
    const { deriveMessageParts } = await import('../../utilities/utilities.ts');
    const message = {
      id: 'msg-suggestion-fields',
      role: 'assistant' as const,
      content: 'Answer.',
      position: 0,
      metadata: {},
      hidden: false,
      createdAt: new Date().toISOString(),
    };
    const parts = deriveMessageParts(message, {
      suggestions: ['Alpha', 'Beta'],
    });

    const suggestionParts = parts.filter((part) => part.type === 'suggestion');
    expect(suggestionParts).toHaveLength(2);

    expect(suggestionParts[0]).toMatchObject({
      type: 'suggestion',
      index: 0,
      label: 'Alpha',
    });
    expect(suggestionParts[1]).toMatchObject({
      type: 'suggestion',
      index: 1,
      label: 'Beta',
    });
  });

  test('suggestion parts have stable keys based on message id and index', async () => {
    const { deriveMessageParts } = await import('../../utilities/utilities.ts');
    const message = {
      id: 'msg-stable-keys',
      role: 'assistant' as const,
      content: 'Answer.',
      position: 0,
      metadata: {},
      hidden: false,
      createdAt: new Date().toISOString(),
    };
    const parts = deriveMessageParts(message, { suggestions: ['A', 'B'] });
    const suggestionParts = parts.filter((part) => part.type === 'suggestion');

    expect(suggestionParts[0]?.key).toBe('msg-stable-keys:suggestion:0');
    expect(suggestionParts[1]?.key).toBe('msg-stable-keys:suggestion:1');
  });
});

// ==========================================================================
// toRenderUnits grouping
// ==========================================================================

describe('SuggestionPart — toRenderUnits grouping', () => {
  test('consecutive suggestion parts collapse into a single suggestions unit', async () => {
    const { toRenderUnits } = await import('../chat-message-parts.ts');
    const suggestions: SuggestionMessagePart[] = [
      { type: 'suggestion', key: 'm1:suggestion:0', index: 0, label: 'A' },
      { type: 'suggestion', key: 'm1:suggestion:1', index: 1, label: 'B' },
      { type: 'suggestion', key: 'm1:suggestion:2', index: 2, label: 'C' },
    ];
    const units = toRenderUnits(suggestions);
    expect(units).toHaveLength(1);
    expect(units[0]).toMatchObject({ kind: 'suggestions', suggestions });
  });

  test('suggestion parts separated by a non-suggestion part produce two units', async () => {
    const { toRenderUnits } = await import('../chat-message-parts.ts');
    const suggestionA: SuggestionMessagePart = {
      type: 'suggestion',
      key: 'm1:suggestion:0',
      index: 0,
      label: 'A',
    };
    const markdown = {
      type: 'markdown' as const,
      key: 'm1:body',
      content: 'between',
      streaming: false,
      expanded: true,
    };
    const suggestionB: SuggestionMessagePart = {
      type: 'suggestion',
      key: 'm1:suggestion:1',
      index: 1,
      label: 'B',
    };
    const units = toRenderUnits([suggestionA, markdown, suggestionB]);
    expect(units.map((unit) => unit.kind)).toEqual(['suggestions', 'part', 'suggestions']);
  });
});

// ==========================================================================
