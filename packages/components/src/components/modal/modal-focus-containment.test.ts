/// <reference lib="dom" />
import { requiredInstance, setupHappyDom } from '@lostgradient/testing';
import { afterEach, describe, expect, test } from 'bun:test';
import { createRawSnippet, tick } from 'svelte';
import { resetScrollLock } from '../../_internal/overlay.ts';
import { emptySnippet, installModalDialogStubs } from './modal-test-helpers.ts';

setupHappyDom();
installModalDialogStubs();
const { cleanup, fireEvent, render } = await import('@testing-library/svelte');
const { default: Modal } = await import('./modal.svelte');

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
  resetScrollLock();
});
describe('Modal focus containment', () => {
  test('panel is rendered while open', () => {
    const { container } = render(Modal, {
      props: { open: true, title: 'Focus test', children: emptySnippet },
    });
    expect(container.querySelector('.cinder-modal__panel')).not.toBeNull();
  });
  test('dialog carries aria-modal="true" to signal focus containment to AT', () => {
    const { container } = render(Modal, {
      props: { open: true, title: 'Focus test', children: emptySnippet },
    });
    expect(container.querySelector('dialog')?.getAttribute('aria-modal')).toBe('true');
  });
  test('Tab on the last focusable element wraps back to the first (focus moves + default prevented)', async () => {
    // The trap attaches a keydown listener to the panel that intercepts Tab when
    // document.activeElement is the last tabbable element. Asserting BOTH that
    // preventDefault() fired AND that focus actually landed on the first tabbable
    // makes this fail if the trap is removed or wraps to the wrong boundary —
    // `defaultPrevented` alone would still pass with a no-op handler that never
    // moves focus.
    const childrenWithButtons = createRawSnippet(() => ({
      render: () =>
        `<div><button id="inner-first">First</button><button id="inner-second">Second</button></div>`,
      setup: () => {},
    }));

    const { container } = render(Modal, {
      props: { open: true, title: 'Trap test', children: childrenWithButtons },
    });
    // Drain the deferred initial-focus microtask (tick().then → body focus)
    // BEFORE positioning focus, or it races in during the awaited fireEvent
    // and clobbers the wrap destination.
    await tick();

    const panel = requiredInstance(container.querySelector('.cinder-modal__panel'), HTMLElement);
    expect(panel).not.toBeNull();

    const firstButton = requiredInstance(
      container.querySelector('#inner-first'),
      HTMLButtonElement,
    );
    // The close button is rendered last in DOM order, so it is the LAST tabbable.
    const closeButton = requiredInstance(
      container.querySelector('.cinder-modal__close'),
      HTMLButtonElement,
    );
    expect(firstButton).not.toBeNull();
    expect(closeButton).not.toBeNull();

    // Move focus to the close button (last tabbable element) and Tab forward.
    closeButton.focus();
    expect(document.activeElement).toBe(closeButton);

    const result = await fireEvent.keyDown(panel, { key: 'Tab' });

    // fireEvent returns false when the handler called preventDefault().
    expect(result).toBe(false);
    // Focus wrapped to the first tabbable, never escaping to <body>.
    expect(document.activeElement).toBe(firstButton);
  });
  test('Shift+Tab on the first focusable element wraps to the last (focus moves + default prevented)', async () => {
    // Children render two buttons; with the close button rendered last, the tab
    // order is inner-first → inner-second → close. Shift+Tab from inner-first
    // (the first tabbable) must wrap to the close button (the last tabbable).
    const childrenWithButtons = createRawSnippet(() => ({
      render: () =>
        `<div><button id="inner-first">First</button><button id="inner-second">Second</button></div>`,
      setup: () => {},
    }));

    const { container } = render(Modal, {
      props: { open: true, title: 'Trap test', children: childrenWithButtons },
    });
    // Drain the deferred initial-focus microtask before positioning focus.
    await tick();

    const panel = requiredInstance(container.querySelector('.cinder-modal__panel'), HTMLElement);
    expect(panel).not.toBeNull();

    // The body container has tabindex="-1" and is not in the tabbable set.
    const firstButton = requiredInstance(
      container.querySelector('#inner-first'),
      HTMLButtonElement,
    );
    const closeButton = requiredInstance(
      container.querySelector('.cinder-modal__close'),
      HTMLButtonElement,
    );
    expect(firstButton).not.toBeNull();
    expect(closeButton).not.toBeNull();

    // Move focus to the first tabbable element and Shift+Tab backward.
    firstButton.focus();
    expect(document.activeElement).toBe(firstButton);

    const result = await fireEvent.keyDown(panel, { key: 'Tab', shiftKey: true });

    expect(result).toBe(false);
    // Focus wrapped to the last tabbable (the close button).
    expect(document.activeElement).toBe(closeButton);
  });
  test('focus trap is inactive when modal is closed — Tab events are not intercepted', async () => {
    // When open=false, the panel is unmounted and the trap is torn down. A Tab event
    // dispatched before opening must pass through without preventDefault().
    const { container } = render(Modal, {
      props: { open: false, title: 'Trap test', children: emptySnippet },
    });

    // With open=false the panel is absent — no focus trap is active.
    const panel = container.querySelector('.cinder-modal__panel');
    expect(panel).toBeNull();
  });
  test('focus trap wraps even when modal has no explicit children buttons (uses close button)', async () => {
    // The close button is always the last tabbable element. The body (tabindex=-1) is programmatically
    // focusable but not tabbable. So with no children buttons, the close button IS both first and last.
    const { container } = render(Modal, {
      props: { open: true, title: 'Trap test', children: emptySnippet },
    });

    const panel = requiredInstance(container.querySelector('.cinder-modal__panel'), HTMLElement);
    const closeButton = requiredInstance(
      container.querySelector('.cinder-modal__close'),
      HTMLButtonElement,
    );
    expect(closeButton).not.toBeNull();

    // Focus the only tabbable element (close button).
    closeButton.focus();

    // Tab forward should wrap (preventDefault), since close is also the first element.
    const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    panel.dispatchEvent(tabEvent);

    expect(tabEvent.defaultPrevented).toBe(true);
  });
});
