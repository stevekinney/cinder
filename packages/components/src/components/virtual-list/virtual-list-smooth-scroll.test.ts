/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { requiredInstance, setupHappyDom } from '@lostgradient/testing';
import { makeItems, renderedRows, rowSnippet } from './virtual-list-test-helpers.ts';

import type { VirtualListRef } from './virtual-list.types.ts';

setupHappyDom();

const { cleanup, render, waitFor } = await import('@testing-library/svelte');
const { tick } = await import('svelte');
const { default: VirtualList } = await import('./virtual-list.svelte');

afterEach(() => cleanup());

describe('VirtualList — smoothScroll', () => {
  function renderWithRef(extra: Record<string, unknown>) {
    let listRef: VirtualListRef | undefined;
    const rendered = render(VirtualList, {
      items: makeItems(1_000),
      itemHeight: 20,
      height: '200px',
      row: rowSnippet(),
      'aria-label': 'Feed',
      ...extra,
      get ref() {
        return listRef;
      },
      set ref(next: VirtualListRef | undefined) {
        listRef = next;
      },
    });
    return { ...rendered, getRef: () => listRef };
  }

  test('animates scrollToIndex by default when smoothScroll is on', async () => {
    const behaviors: (string | undefined)[] = [];
    const { container, getRef } = renderWithRef({ smoothScroll: true });
    await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));

    const list = requiredInstance(container.querySelector('.cinder-virtual-list'), HTMLElement);
    Object.defineProperty(list, 'scrollTo', {
      configurable: true,
      value: (options: ScrollToOptions) => {
        behaviors.push(options?.behavior);
      },
    });

    getRef()?.scrollToIndex(400, { align: 'start' });
    await tick();
    expect(behaviors).toContain('smooth');
  });

  test('an explicit behavior in the call still wins', async () => {
    const behaviors: (string | undefined)[] = [];
    const { container, getRef } = renderWithRef({ smoothScroll: true });
    await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));

    const list = requiredInstance(container.querySelector('.cinder-virtual-list'), HTMLElement);
    Object.defineProperty(list, 'scrollTo', {
      configurable: true,
      value: (options: ScrollToOptions) => {
        behaviors.push(options?.behavior);
      },
    });

    getRef()?.scrollToIndex(400, { align: 'start', behavior: 'auto' });
    await tick();
    expect(behaviors).not.toContain('smooth');
  });

  test('does not animate when smoothScroll is off', async () => {
    const behaviors: (string | undefined)[] = [];
    const { container, getRef } = renderWithRef({});
    await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));

    const list = requiredInstance(container.querySelector('.cinder-virtual-list'), HTMLElement);
    Object.defineProperty(list, 'scrollTo', {
      configurable: true,
      value: (options: ScrollToOptions) => {
        behaviors.push(options?.behavior);
      },
    });

    getRef()?.scrollToIndex(400, { align: 'start' });
    await tick();
    expect(behaviors).not.toContain('smooth');
  });
});
