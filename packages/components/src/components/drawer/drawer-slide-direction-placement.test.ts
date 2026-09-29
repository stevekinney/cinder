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
  test('left-side drawer opens with data-cinder-placement="left"', () => {
    const { container } = render(Drawer, {
      props: { open: true, title: 'Test', placement: 'left', children: emptySnippet },
    });
    const panel = requiredInstance(container.querySelector('.cinder-drawer__panel'), HTMLElement);
    expect(panel.getAttribute('data-cinder-placement')).toBe('left');
  });

  // 6. Right-side drawer (default) closes with data-cinder-placement='right' throughout.
  test('side change while open does not affect data-cinder-placement until the next open cycle', async () => {
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

    // Change the side while the drawer remains open.
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

    // Panel should still report the open-cycle side ('right'), not 'left'.
    expect(panel.getAttribute('data-cinder-placement')).toBe('right');
  });

  // 2. Side change while closed takes effect on the next open.
  test('side change while closed is reflected on the next open', async () => {
    let openValue = false;
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

    // First open — right side.
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

    const panel = requiredInstance(container.querySelector('.cinder-drawer__panel'), HTMLElement);
    expect(panel.getAttribute('data-cinder-placement')).toBe('right');

    // Close the drawer fully.
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
    await finishCloseTransition(container);

    // Change side while closed.
    placementValue = 'left';

    // Reopen — the new side should now be snapshotted.
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

    const newPanel = requiredInstance(
      container.querySelector('.cinder-drawer__panel'),
      HTMLElement,
    );
    expect(newPanel.getAttribute('data-cinder-placement')).toBe('left');
  });

  // 3. Close transition keeps data-cinder-placement stable even if side prop changes
  //    mid-transition (e.g. the user queues a new side while the exit plays).
});
