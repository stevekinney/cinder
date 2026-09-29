/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { requiredInstance, setupHappyDom } from '@lostgradient/testing';
import {
  installFakeResizeObserver,
  makeItems,
  renderedRows,
  reportRowSizes,
  restoreResizeObserver,
  rowSnippet,
} from './virtual-list-test-helpers.ts';

setupHappyDom();

const { cleanup, fireEvent, render, waitFor } = await import('@testing-library/svelte');
const { tick } = await import('svelte');
const { default: VirtualList } = await import('./virtual-list.svelte');

afterEach(() => cleanup());

describe('VirtualList — adaptive overscan and settling under row controls', () => {
  afterEach(() => {
    restoreResizeObserver();
    cleanup();
    document.body.replaceChildren();
  });

  // The wiring this used to pin structurally — that the velocity-to-row conversion
  // reads MEASURED row sizes (`averageRowSize`, built from
  // `measurementStore.measuredTotalSize`) rather than the `itemHeight` estimate — is
  // now exercised behaviourally in a real browser, where events carry real
  // timestamps and the velocity tracker actually reports a nonzero value. See
  // `scripts/browser-fixtures/tests/virtual-list.playwright.ts`'s adaptive-overscan
  // suite (COR-376), which drives `dynamicSize` rows to a real measured height well
  // away from the `itemHeight` estimate and asserts the adaptive row count tracks it.
  // The arithmetic itself stays covered in `adaptive-overscan.test.ts`.

  test('leaves a settle pass running when a key comes from a control inside a row', async () => {
    // The list does not claim those keys, so the event scrolls nothing here — and
    // retiring the loop for it cancels a correction the destination is still owed,
    // finishing the jump on a stale estimate.
    installFakeResizeObserver();
    const { container } = render(VirtualList, {
      items: makeItems(100),
      itemHeight: 20,
      height: '200px',
      dynamicSize: true,
      stickyItems: [0],
      row: rowSnippet(),
      'aria-label': 'Feed',
    });

    await waitFor(() => expect(renderedRows(container).length).toBeGreaterThan(0));
    const list = requiredInstance(container.querySelector('.cinder-virtual-list'), HTMLElement);

    const pressed = fireEvent.keyDown(list, { key: 'End' });
    // An ArrowDown from a control inside a row, mid-settle. Same key the list would
    // otherwise claim, but not aimed at the container.
    const rowNode = requiredInstance(renderedRows(container)[0], HTMLElement);
    await fireEvent.keyDown(rowNode, { key: 'ArrowDown', bubbles: true });
    reportRowSizes(new Map([[95, 120]]));
    await pressed;
    await tick();

    // 100 rows at 20px is 2000, plus the 100px that row 95 turned out to be, less a
    // 200px viewport.
    await waitFor(() => expect(list.scrollTop).toBe(1_900));
  });
});
