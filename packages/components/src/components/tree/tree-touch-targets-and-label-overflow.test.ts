import { setupHappyDom } from '@lostgradient/testing';
/// <reference lib="dom" />

import { describe, expect, test } from 'bun:test';
import { treeItem, treeItemsSnippet } from './tree-test-helpers.ts';

setupHappyDom();
const { render } = await import('@testing-library/svelte');
const { default: Tree } = await import('./tree.svelte');

describe('Tree touch targets and label overflow', () => {
  const LONG_LABEL =
    'Quarterly financial reports and supporting appendices for the audit committee';

  test('each item row carries the touch-target row class', () => {
    const { container } = render(Tree, {
      props: {
        'aria-label': 'T',
        children: treeItemsSnippet([{ id: 'a', label: 'Alpha' }]),
      },
    });
    const item = treeItem(container, 'Alpha');
    expect(item?.querySelector('.cinder-tree-item__row')).not.toBeNull();
  });

  test('the visible label carries the overflow/truncation class', () => {
    const { container } = render(Tree, {
      props: {
        'aria-label': 'T',
        children: treeItemsSnippet([{ id: 'a', label: LONG_LABEL }]),
      },
    });
    const item = treeItem(container, LONG_LABEL);
    const label = item?.querySelector<HTMLElement>('.cinder-tree-item__label');
    expect(label).not.toBeNull();
    // Visible label is aria-hidden so the truncated text is never announced.
    expect(label?.getAttribute('aria-hidden')).toBe('true');
  });

  test('the full label text remains available to assistive tech regardless of visual truncation', () => {
    const { container } = render(Tree, {
      props: {
        'aria-label': 'T',
        children: treeItemsSnippet([{ id: 'a', label: LONG_LABEL }]),
      },
    });
    // The visually-hidden label span (which labels the treeitem) holds the
    // complete, untruncated text.
    const srLabel = [...container.querySelectorAll<HTMLElement>('.cinder-sr-only')].find(
      (element) => element.textContent === LONG_LABEL,
    );
    expect(srLabel).not.toBeUndefined();
    const item = treeItem(container, LONG_LABEL);
    expect(item?.getAttribute('aria-labelledby')).toBe(srLabel?.id);
  });
});
