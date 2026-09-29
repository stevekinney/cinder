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
const { cleanup, fireEvent, render } = await import('@testing-library/svelte');
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
describe('Drawer', () => {
  test('reopen while closing re-applies body focus instead of stranding focus on document.body', async () => {
    let openValue = true;
    const props = {
      get open() {
        return openValue;
      },
      set open(value: boolean) {
        openValue = value;
      },
      title: 'Test',
      children: emptySnippet,
    };
    const { container, rerender } = render(Drawer, { props });
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Begin closing (panel goes inert, focus falls back to document.body)…
    openValue = false;
    await rerender(props);
    // …then reopen BEFORE the exit transition finishes.
    openValue = true;
    await rerender(props);
    await new Promise((resolve) => setTimeout(resolve, 0));

    const body = requiredInstance(container.querySelector('.cinder-drawer__body'), HTMLElement);
    expect(body).not.toBeNull();
    expect(document.activeElement).toBe(body);
  });
  test('focus restores to capturedFocus when triggerRef is unmounted before close', async () => {
    const previouslyFocused = document.createElement('button');
    previouslyFocused.id = 'drawer-prev-focus';
    document.body.appendChild(previouslyFocused);
    previouslyFocused.focus();

    const triggerEl = document.createElement('button');
    triggerEl.id = 'drawer-transient-trigger';
    document.body.appendChild(triggerEl);

    let openValue = true;
    const { container } = render(Drawer, {
      props: {
        get open() {
          return openValue;
        },
        set open(value: boolean) {
          openValue = value;
        },
        title: 'Test',
        triggerRef: triggerEl,
        children: emptySnippet,
      },
    });

    // Remove the trigger while the drawer is open.
    document.body.removeChild(triggerEl);

    const closeButton = requiredInstance(
      container.querySelector('.cinder-drawer__close'),
      HTMLButtonElement,
    );
    await fireEvent.click(closeButton);
    await finishCloseTransition(container);
    expect(document.activeElement).toBe(previouslyFocused);

    document.body.removeChild(previouslyFocused);
  });
  test('no focus is forced when both triggerRef and capturedFocus are gone', async () => {
    const triggerEl = document.createElement('button');
    document.body.appendChild(triggerEl);

    let openValue = true;
    const { container } = render(Drawer, {
      props: {
        get open() {
          return openValue;
        },
        set open(value: boolean) {
          openValue = value;
        },
        title: 'Test',
        triggerRef: triggerEl,
        children: emptySnippet,
      },
    });

    document.body.removeChild(triggerEl);

    const closeButton = requiredInstance(
      container.querySelector('.cinder-drawer__close'),
      HTMLButtonElement,
    );
    await fireEvent.click(closeButton);
    await finishCloseTransition(container);
    expect(document.activeElement).not.toBe(triggerEl);
  });
});
