/** Renderer integration tests for the suggestion message-part owner. */

/// <reference lib="dom" />
import { afterEach, expect, mock, test } from 'bun:test';
import { flushSync } from 'svelte';

import { setupHappyDom } from '@lostgradient/testing';
import type { SuggestionMessagePart } from '../../utilities/types.ts';

setupHappyDom();

const { render, cleanup, fireEvent } = await import('@testing-library/svelte');
const { default: ChatMessagePartsRenderer } = await import('../chat-message-parts-renderer.svelte');

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

test('plain transcript produces no suggestion toolbar', () => {
  const { container } = render(ChatMessagePartsRenderer, {
    props: {
      parts: [
        {
          type: 'markdown',
          key: 'plain:body',
          content: 'A plain assistant message.',
          streaming: false,
          expanded: true,
        },
      ],
    },
  });
  expect(container.querySelector('[data-cinder-suggested-replies]')).toBeNull();
  expect(container.querySelector('[role="toolbar"]')).toBeNull();
});

test('suggestion parts render a toolbar with role="toolbar"', () => {
  const suggestions: SuggestionMessagePart[] = [
    { type: 'suggestion', key: 'msg:suggestion:0', index: 0, label: 'Option A' },
    { type: 'suggestion', key: 'msg:suggestion:1', index: 1, label: 'Option B' },
  ];
  const { container } = render(ChatMessagePartsRenderer, { props: { parts: suggestions } });
  expect(container.querySelector('[role="toolbar"]')).not.toBeNull();
});

test('toolbar has aria-label="Suggested replies"', () => {
  const suggestions: SuggestionMessagePart[] = [
    { type: 'suggestion', key: 'msg:suggestion:0', index: 0, label: 'Chip 1' },
  ];
  const { container } = render(ChatMessagePartsRenderer, { props: { parts: suggestions } });
  expect(container.querySelector('[role="toolbar"]')?.getAttribute('aria-label')).toBe(
    'Suggested replies',
  );
});

test('toolbar has data-cinder-suggested-replies attribute', () => {
  const suggestions: SuggestionMessagePart[] = [
    { type: 'suggestion', key: 'msg:suggestion:0', index: 0, label: 'Test' },
  ];
  const { container } = render(ChatMessagePartsRenderer, { props: { parts: suggestions } });
  expect(container.querySelector('[data-cinder-suggested-replies]')).not.toBeNull();
});

test('each chip renders as a button inside the toolbar', () => {
  const suggestions: SuggestionMessagePart[] = [
    { type: 'suggestion', key: 'msg:suggestion:0', index: 0, label: 'Alpha' },
    { type: 'suggestion', key: 'msg:suggestion:1', index: 1, label: 'Beta' },
    { type: 'suggestion', key: 'msg:suggestion:2', index: 2, label: 'Gamma' },
  ];
  const { container } = render(ChatMessagePartsRenderer, { props: { parts: suggestions } });
  const buttons = container.querySelector('[role="toolbar"]')?.querySelectorAll('button');
  expect(buttons).toHaveLength(3);
  const labels = Array.from(buttons ?? []).map((button) => button.textContent?.trim());
  expect(labels).toContain('Alpha');
  expect(labels).toContain('Beta');
  expect(labels).toContain('Gamma');
});

test('onSuggestionSelect is forwarded to each chip', () => {
  const onSuggestionSelect = mock((label: string) => label);
  const suggestions: SuggestionMessagePart[] = [
    { type: 'suggestion', key: 'msg:suggestion:0', index: 0, label: 'Pick me' },
  ];
  const { container } = render(ChatMessagePartsRenderer, {
    props: { parts: suggestions, onSuggestionSelect },
  });
  fireEvent.click(container.querySelector('button')!);
  flushSync();
  expect(onSuggestionSelect).toHaveBeenCalledWith('Pick me');
});
