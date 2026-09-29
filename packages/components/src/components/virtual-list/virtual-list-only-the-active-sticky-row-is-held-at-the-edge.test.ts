/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { requiredInstance, setupHappyDom } from '@lostgradient/testing';
import {
  instrumentScrollTop,
  makeItems,
  renderedRows,
  rowSnippet,
} from './virtual-list-test-helpers.ts';

setupHappyDom();

const { cleanup, fireEvent, render, waitFor } = await import('@testing-library/svelte');
const { tick } = await import('svelte');
const { default: VirtualList } = await import('./virtual-list.svelte');

afterEach(() => cleanup());

describe('VirtualList — only the active sticky row is held at the edge', () => {
  afterEach(() => {
    cleanup();
    document.body.replaceChildren();
  });

  test('marks exactly one sticky row active however many are in the window', async () => {
    // The attribute the stylesheet keys on. An overscanned window can hold several
    // headers at once, and sticking all of them put every header the reader had passed
    // at the same inset, stacked on one another.
    const { container } = render(VirtualList, {
      items: makeItems(1_000),
      itemHeight: 20,
      height: '200px',
      overscan: 30,
      stickyItems: [0, 5, 10, 15, 20, 25, 30, 35, 40],
      row: rowSnippet(),
      'aria-label': 'Feed',
    });

    await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));
    const list = requiredInstance(container.querySelector('.cinder-virtual-list'), HTMLElement);
    list.scrollTop = 600;
    await fireEvent.scroll(list);
    await tick();

    // Several sticky rows are mounted together...
    const sticky = container.querySelectorAll('[data-cinder-sticky="true"]');
    expect(sticky.length).toBeGreaterThan(1);

    // ...and exactly one of them is the one being held.
    const active = container.querySelectorAll('[data-cinder-sticky-active="true"]');
    expect(active.length).toBe(1);
    expect(requiredInstance(active[0], HTMLElement).dataset['cinderVirtualIndex']).toBe('30');
  });

  test('leaves a modified navigation key to the browser', async () => {
    // Alt with the arrows is back and forward, and Ctrl or Meta with Home and End is
    // the browser's own. Claiming them moved the list one row and swallowed the
    // shortcut whole — most damagingly in a horizontal list, where Alt+Left and
    // Alt+Right are the keys a reader navigates history with.
    const { container } = render(VirtualList, {
      items: makeItems(1_000),
      itemHeight: 20,
      height: '200px',
      overscan: 0,
      stickyItems: [0],
      row: rowSnippet(),
      'aria-label': 'Feed',
    });

    await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));
    const list = requiredInstance(container.querySelector('.cinder-virtual-list'), HTMLElement);
    const scrollTop = instrumentScrollTop(list);
    list.scrollTop = 4_000;
    await fireEvent.scroll(list);
    await tick();

    for (const modifier of ['altKey', 'ctrlKey', 'metaKey'] as const) {
      for (const key of ['ArrowDown', 'ArrowUp', 'Home', 'End', 'PageDown']) {
        const event = await fireEvent.keyDown(list, { key, [modifier]: true });
        // Not consumed, so the browser still performs its own shortcut...
        expect(event).toBe(true);
      }
    }
    // ...and the list has not moved for any of them.
    expect(scrollTop.value()).toBe(4_000);

    // The same keys unmodified are still claimed, so the guard is not simply off.
    await fireEvent.keyDown(list, { key: 'ArrowDown' });
    await tick();
    expect(scrollTop.value()).not.toBe(4_000);
  });

  test('raises only the active sticky row, which flex layout makes load-bearing', async () => {
    // `z-index` was on every sticky row, on the reasoning that it is inert unless the
    // element is positioned. True in block layout, false under `horizontal`, where the
    // window is a flex container and `z-index` applies to flex items regardless — so
    // an inactive header approaching the edge entered the same stacking level and,
    // being later in DOM order, painted over the held one.
    //
    // A cascade outcome, so the rule's shape is what is assertable here.
    const source = await Bun.file(new URL('./virtual-list.css', import.meta.url).pathname).text();
    const activeRule = source.slice(
      source.indexOf(".cinder-virtual-list__row[data-cinder-sticky-active='true'] {"),
    );
    expect(activeRule.slice(0, activeRule.indexOf('}'))).toContain('z-index: 1');
    // And not on the bare sticky attribute, which every mounted header carries.
    expect(source).not.toContain("[data-cinder-sticky='true'] {\n    z-index: 1;");
  });

  // The cascade outcome this used to pin structurally — that a pinned horizontal
  // row's rule anchors only `inset-block-start`, not both block edges, so the row
  // keeps its own height once it leaves flow — is now exercised behaviourally in a
  // real browser, where `position` and `overflow` actually compute. See
  // `scripts/browser-fixtures/tests/virtual-list.playwright.ts`'s pinned-header suite
  // (COR-376), which scrolls the `horizontal-sticky-header-clip` fixture until its
  // taller header pins and asserts its full box stays visible inside the list's own
  // box.

  test('scopes sticky positioning to the active row', async () => {
    // A cascade outcome, which happy-dom does not compute — the rule's shape is the
    // only thing assertable here. Paired with the test above, which pins that exactly
    // one row carries the attribute this selector matches.
    const source = await Bun.file(new URL('./virtual-list.css', import.meta.url).pathname).text();
    expect(source).toContain("[data-cinder-sticky-active='true'] {\n    position: sticky;");
    // And not on the bare sticky attribute, which every mounted header carries.
    expect(source).not.toContain("[data-cinder-sticky='true'] {\n    position: sticky;");
  });
});
