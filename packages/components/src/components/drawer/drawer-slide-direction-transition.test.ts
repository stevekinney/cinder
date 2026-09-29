/// <reference lib="dom" />
import { requiredInstance, setupHappyDom } from '@lostgradient/testing';
import { afterAll, afterEach, describe, expect, test } from 'bun:test';
import { resetEscapeStack, resetScrollLock } from '../../_internal/overlay.ts';
import {
  emptySnippet,
  finishCloseTransition,
  installDrawerDialogStubs,
  installDrawerStyleProbe,
} from './drawer-test-helpers.ts';

setupHappyDom();
installDrawerDialogStubs();
const restoreDrawerStyles = installDrawerStyleProbe();
const { cleanup, render } = await import('@testing-library/svelte');
const { default: Drawer } = await import('./drawer.svelte');
afterAll(() => {
  restoreDrawerStyles();
});
afterEach(() => {
  cleanup();
  document.body.replaceChildren();
  resetScrollLock();
  resetEscapeStack();
});
describe('Drawer slide direction lifecycle', () => {
  test('right-side drawer exit transition preserves data-cinder-placement="right"', async () => {
    let openValue = true;
    const { container, rerender } = render(Drawer, {
      props: {
        get open() {
          return openValue;
        },
        set open(value: boolean) {
          openValue = value;
        },
        title: 'Test',
        children: emptySnippet,
      },
    });

    const panel = requiredInstance(container.querySelector('.cinder-drawer__panel'), HTMLElement);
    expect(panel.getAttribute('data-cinder-placement')).toBe('right');

    openValue = false;
    await rerender({
      get open() {
        return openValue;
      },
      set open(value: boolean) {
        openValue = value;
      },
      title: 'Test',
      children: emptySnippet,
    });

    // During the close transition, direction must still be 'right'.
    expect(panel.getAttribute('data-cinder-placement')).toBe('right');
    expect(panel.getAttribute('data-cinder-closing')).toBe('');

    await finishCloseTransition(container);
    expect(container.querySelector('.cinder-drawer__panel')).toBeNull();
  });

  // Same-tick open + side change: a consumer that does `open = true; side = 'left'`
  // in one event handler batches both writes into a single reactive update. The
  // open-handling effect must read the NEW side when it snapshots activePlacement, so
  // the fresh panel slides from the correct edge.
  test('open=false→true with a simultaneous side change snapshots the new side', async () => {
    let openValue = false;
    let placementValue: 'left' | 'right' | 'bottom' = 'right';

    const props = () => ({
      get open() {
        return openValue;
      },
      set open(value: boolean) {
        openValue = value;
      },
      get placement() {
        return placementValue;
      },
      title: 'Test',
      children: emptySnippet,
    });

    const { container, rerender } = render(Drawer, { props: props() });
    expect(container.querySelector('.cinder-drawer__panel')).toBeNull();

    // Flip both atomically before the single rerender (one reactive batch).
    openValue = true;
    placementValue = 'left';
    await rerender(props());

    const panel = requiredInstance(container.querySelector('.cinder-drawer__panel'), HTMLElement);
    expect(panel).not.toBeNull();
    expect(panel.getAttribute('data-cinder-placement')).toBe('left');
  });

  // The drawer's <dialog> is gated behind a `hydrated` $state set inside an
  // $effect, which never runs on the server. Keep this as a source-level contract
  // so the invariant is checked without paying a full server compile inside the
  // large coverage suite.
  test('side change during a close transition does not flip data-cinder-placement mid-transition', async () => {
    let openValue = true;
    let placementValue: 'left' | 'right' | 'bottom' = 'right';

    const { container, rerender } = render(Drawer, {
      props: {
        get open() {
          return openValue;
        },
        set open(value: boolean) {
          openValue = value;
        },
        get placement() {
          return placementValue;
        },
        title: 'Test',
        children: emptySnippet,
      },
    });

    const panel = requiredInstance(container.querySelector('.cinder-drawer__panel'), HTMLElement);
    expect(panel.getAttribute('data-cinder-placement')).toBe('right');

    // Begin closing.
    openValue = false;
    await rerender({
      get open() {
        return openValue;
      },
      set open(value: boolean) {
        openValue = value;
      },
      get placement() {
        return placementValue;
      },
      title: 'Test',
      children: emptySnippet,
    });

    // Panel should be in closing state.
    expect(panel.getAttribute('data-cinder-closing')).toBe('');
    // Side must still be the open-cycle side, not whatever side is now.
    expect(panel.getAttribute('data-cinder-placement')).toBe('right');

    // Change side prop while transition is running.
    placementValue = 'left';
    await rerender({
      get open() {
        return openValue;
      },
      set open(value: boolean) {
        openValue = value;
      },
      get placement() {
        return placementValue;
      },
      title: 'Test',
      children: emptySnippet,
    });

    // data-cinder-placement must remain 'right' throughout the transition.
    expect(panel.getAttribute('data-cinder-placement')).toBe('right');

    // Transition completes — panel unmounts.
    await finishCloseTransition(container);
    expect(container.querySelector('.cinder-drawer__panel')).toBeNull();
  });

  // 4. Quick-close then reopen: if side changed before the reopen, the new
  //    side is snapshotted and used for the re-entry animation.
  test('quick-reopen after mid-close-side-change uses the new side', async () => {
    let openValue = true;
    let placementValue: 'left' | 'right' | 'bottom' = 'right';

    const { container, rerender } = render(Drawer, {
      props: {
        get open() {
          return openValue;
        },
        set open(value: boolean) {
          openValue = value;
        },
        get placement() {
          return placementValue;
        },
        title: 'Test',
        children: emptySnippet,
      },
    });

    // Close — transition starts.
    openValue = false;
    placementValue = 'left'; // side changes while closing
    await rerender({
      get open() {
        return openValue;
      },
      set open(value: boolean) {
        openValue = value;
      },
      get placement() {
        return placementValue;
      },
      title: 'Test',
      children: emptySnippet,
    });

    // Panel is still mounted mid-transition.
    const panel = requiredInstance(container.querySelector('.cinder-drawer__panel'), HTMLElement);
    expect(panel.getAttribute('data-cinder-closing')).toBe('');

    // Reopen before the transition completes (quick-reopen scenario).
    openValue = true;
    await rerender({
      get open() {
        return openValue;
      },
      set open(value: boolean) {
        openValue = value;
      },
      get placement() {
        return placementValue;
      },
      title: 'Test',
      children: emptySnippet,
    });

    // After quick-reopen, isClosing should be cleared and the new side snapshot applies.
    expect(panel.getAttribute('data-cinder-closing')).toBeNull();
    expect(panel.getAttribute('data-cinder-placement')).toBe('left');
  });

  // 5. Opening with side='left' from the start uses left entry.
});
