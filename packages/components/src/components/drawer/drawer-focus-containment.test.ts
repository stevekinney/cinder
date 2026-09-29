/// <reference lib="dom" />
import { requiredInstance, setupHappyDom } from '@lostgradient/testing';
import { afterAll, afterEach, describe, expect, test } from 'bun:test';
import { createRawSnippet, tick } from 'svelte';
import { resetEscapeStack, resetScrollLock } from '../../_internal/overlay.ts';
import { installDrawerDialogStubs, installDrawerStyleProbe } from './drawer-test-helpers.ts';

setupHappyDom();
installDrawerDialogStubs();
const restoreDrawerStyles = installDrawerStyleProbe();
const { cleanup, fireEvent, render } = await import('@testing-library/svelte');
const { default: Drawer } = await import('./drawer.svelte');
function makeSnippetWithInput() {
  return createRawSnippet(() => ({
    render: () => '<input type="text" data-testid="drawer-input" />',
    setup: () => {},
  }));
}

afterAll(() => {
  restoreDrawerStyles();
});
afterEach(() => {
  cleanup();
  document.body.replaceChildren();
  resetScrollLock();
  resetEscapeStack();
});
describe('Drawer focus containment', () => {
  test('Tab from the last focusable element wraps to the first and prevents default', async () => {
    const { container } = render(Drawer, {
      props: {
        open: true,
        title: 'Test Drawer',
        children: makeSnippetWithInput(),
      },
    });
    await tick();

    const panel = requiredInstance(container.querySelector('.cinder-drawer__panel'), HTMLElement);
    const closeButton = requiredInstance(
      container.querySelector('.cinder-drawer__close'),
      HTMLElement,
    );
    const input = requiredInstance(
      container.querySelector('input[data-testid="drawer-input"]'),
      HTMLElement,
    );
    expect(panel).not.toBeNull();
    expect(closeButton).not.toBeNull();
    expect(input).not.toBeNull();

    // The input is the LAST tabbable (close button is first, in the header).
    input.focus();
    expect(document.activeElement).toBe(input);

    const result = await fireEvent.keyDown(panel, { key: 'Tab', shiftKey: false });

    // Trap intercepted the boundary Tab and wrapped focus to the first tabbable.
    expect(result).toBe(false); // fireEvent returns false when preventDefault was called
    expect(document.activeElement).toBe(closeButton);
  });
  test('Shift+Tab from the first focusable element wraps to the last and prevents default', async () => {
    const { container } = render(Drawer, {
      props: {
        open: true,
        title: 'Test Drawer',
        children: makeSnippetWithInput(),
      },
    });
    await tick();

    const panel = requiredInstance(container.querySelector('.cinder-drawer__panel'), HTMLElement);
    const closeButton = requiredInstance(
      container.querySelector('.cinder-drawer__close'),
      HTMLElement,
    );
    const input = requiredInstance(
      container.querySelector('input[data-testid="drawer-input"]'),
      HTMLElement,
    );

    // The close button is the FIRST tabbable (header precedes the body input).
    closeButton.focus();
    expect(document.activeElement).toBe(closeButton);

    const result = await fireEvent.keyDown(panel, { key: 'Tab', shiftKey: true });

    expect(result).toBe(false);
    expect(document.activeElement).toBe(input);
  });
  test('document.body never receives focus while tabbing inside an open drawer', async () => {
    const { container } = render(Drawer, {
      props: {
        open: true,
        title: 'Test Drawer',
        children: makeSnippetWithInput(),
      },
    });
    await tick();

    const panel = requiredInstance(container.querySelector('.cinder-drawer__panel'), HTMLElement);
    const input = requiredInstance(
      container.querySelector('input[data-testid="drawer-input"]'),
      HTMLElement,
    );
    input.focus();

    // Tab repeatedly from the boundary — focus must never escape to the body.
    for (let i = 0; i < 5; i++) {
      await fireEvent.keyDown(panel, { key: 'Tab', shiftKey: false });
      expect(document.activeElement).not.toBe(document.body);
      expect(panel.contains(document.activeElement)).toBe(true);
    }
  });

  // ---------------------------------------------------------------------------
  // Escape-stack hygiene (ported from the former Sheet suite).
  //
  // Documents that successive open/close cycles do not leak escape-stack
  // entries. If the drawer's no-op marker handler were not released on close,
  // it would stay above this sibling handler and prevent Escape from routing
  // back to the sibling overlay after the drawer closes.
  // ---------------------------------------------------------------------------
});
