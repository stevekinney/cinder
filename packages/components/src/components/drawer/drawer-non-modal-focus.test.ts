/// <reference lib="dom" />
import { requiredInstance, setupHappyDom } from '@lostgradient/testing';
import { afterAll, afterEach, describe, expect, test } from 'bun:test';
import { tick } from 'svelte';
import { pushEscapeHandler, resetEscapeStack, resetScrollLock } from '../../_internal/overlay.ts';
import {
  emptySnippet,
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
  test('modal=false close restores focus to triggerRef', async () => {
    const trigger = document.createElement('button');
    trigger.textContent = 'Open inspector';
    document.body.appendChild(trigger);
    trigger.focus();

    let openValue = true;
    const props = () => ({
      modal: false,
      triggerRef: trigger,
      get open() {
        return openValue;
      },
      set open(value: boolean) {
        openValue = value;
      },
      title: 'Inspector',
      children: emptySnippet,
    });
    const { container, rerender } = render(Drawer, { props: props() });
    await tick();

    const closeButton = requiredInstance(
      container.querySelector('.cinder-drawer__close'),
      HTMLButtonElement,
    );
    closeButton.focus();
    await fireEvent.click(closeButton);
    await rerender(props());
    await tick();

    expect(openValue).toBe(false);
    expect(container.querySelector('aside.cinder-drawer')).toBeNull();
    expect(document.activeElement).toBe(trigger);

    document.body.removeChild(trigger);
  });
  test('modal=false does not steal focus from a different surface on close', async () => {
    const trigger = document.createElement('button');
    const outside = document.createElement('button');
    document.body.append(trigger, outside);
    trigger.focus();

    let openValue = true;
    const props = () => ({
      modal: false,
      triggerRef: trigger,
      get open() {
        return openValue;
      },
      set open(value: boolean) {
        openValue = value;
      },
      title: 'Inspector',
      children: emptySnippet,
    });
    const { container, rerender } = render(Drawer, { props: props() });
    outside.focus();
    openValue = false;
    await rerender(props());
    await tick();

    expect(document.activeElement).toBe(outside);
    expect(container.querySelector('aside')).toBeNull();
    trigger.remove();
    outside.remove();
  });
  test('modal=false restores focus to the trigger when unmounted while open', async () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();
    const { unmount } = render(Drawer, {
      props: {
        modal: false,
        open: true,
        triggerRef: trigger,
        title: 'Inspector',
        children: emptySnippet,
      },
    });

    const panel = requiredInstance(document.querySelector('.cinder-drawer__panel'), HTMLElement);
    requiredInstance(panel.querySelector('.cinder-drawer__close'), HTMLElement).focus();
    unmount();

    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });
  test('switching an open drawer from modal to non-modal releases modal coordination state', async () => {
    const trigger = document.createElement('button');
    trigger.textContent = 'Open inspector';
    document.body.appendChild(trigger);
    trigger.focus();

    let openValue = true;
    let modalValue = true;
    const props = () => ({
      get modal() {
        return modalValue;
      },
      triggerRef: trigger,
      get open() {
        return openValue;
      },
      set open(value: boolean) {
        openValue = value;
      },
      title: 'Inspector',
      children: emptySnippet,
    });
    const { container, rerender } = render(Drawer, { props: props() });
    expect(container.querySelector('dialog')).not.toBeNull();
    expect(document.body.style.overflow).toBe('hidden');

    modalValue = false;
    await rerender(props());
    await tick();

    expect(openValue).toBe(true);
    expect(document.body.style.overflow).toBe('');
    expect(container.querySelector('dialog')).toBeNull();
    expect(container.querySelector('aside.cinder-drawer')).not.toBeNull();

    document.body.removeChild(trigger);
  });
  test('modal=false uses the escape stack while open', async () => {
    let openValue = true;
    let siblingEscapeCount = 0;
    const releaseSiblingEscape = pushEscapeHandler(() => {
      siblingEscapeCount += 1;
    });

    const { rerender } = render(Drawer, {
      props: {
        modal: false,
        get open() {
          return openValue;
        },
        set open(value: boolean) {
          openValue = value;
        },
        title: 'Inspector',
        children: emptySnippet,
      },
    });

    await fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    expect(openValue).toBe(false);
    expect(siblingEscapeCount).toBe(0);

    await rerender({
      modal: false,
      open: false,
      title: 'Inspector',
      children: emptySnippet,
    });
    await fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    expect(siblingEscapeCount).toBe(1);
    releaseSiblingEscape();
  });

  // ---- Additional: footer renders when provided ----
});
