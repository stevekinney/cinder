/// <reference lib="dom" />
import { requiredInstance, setupHappyDom } from '@lostgradient/testing';
import { afterEach, describe, expect, test } from 'bun:test';
import { createRawSnippet } from 'svelte';
import { resetScrollLock } from '../../_internal/overlay.ts';
import {
  flushOverflowFadeAnimationFrames,
  installOverflowFadeTestEnvironment,
  OverflowFadeResizeObserver,
  setScrollMeasurements,
} from '../../test/overflow-fade-test-helpers.ts';
import {
  emptySnippet,
  fireNativeClose,
  installModalDialogStubs,
  textSnippet,
} from './modal-test-helpers.ts';

setupHappyDom();
installModalDialogStubs();
const { cleanup, fireEvent, render } = await import('@testing-library/svelte');
const { default: Modal } = await import('./modal.svelte');

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
  resetScrollLock();
});
describe('Modal', () => {
  test('Escape key on dialog fires close event and sets open to false', async () => {
    // The native <dialog> element fires a "close" event when the user presses Escape
    // (the browser handles Escape → close automatically when showModal() is used).
    // happy-dom does not fully emulate this native behaviour, so we fire the close
    // event after dispatching Escape to replicate the browser sequence.
    let openValue = true;
    const { container } = render(Modal, {
      props: {
        get open() {
          return openValue;
        },
        set open(value: boolean) {
          openValue = value;
        },
        title: 'Test Modal',
        children: emptySnippet,
      },
    });

    const dialog = requiredInstance(container.querySelector('dialog'), HTMLDialogElement);
    expect(dialog).not.toBeNull();
    // Simulate the browser sequence: Escape keydown → close event on the dialog.
    await fireEvent.keyDown(dialog, { key: 'Escape', code: 'Escape' });
    await fireNativeClose(dialog);
    expect(openValue).toBe(false);
  });
  test('dialog has role="dialog" via native element', () => {
    const { container } = render(Modal, {
      props: {
        open: true,
        title: 'Test Modal',
        children: emptySnippet,
      },
    });
    // The native <dialog> element carries role="dialog" implicitly;
    // aria-modal and aria-labelledby are set explicitly.
    const dialog = container.querySelector('dialog');
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    expect(dialog?.getAttribute('aria-labelledby')).not.toBeNull();
  });
  test('role prop can emit role="alertdialog"', () => {
    const { container } = render(Modal, {
      props: {
        open: true,
        title: 'Session expired',
        role: 'alertdialog',
        describedById: 'session-description',
        children: emptySnippet,
      },
    });
    const dialog = container.querySelector('dialog');
    expect(dialog?.getAttribute('role')).toBe('alertdialog');
  });
  test('applies custom class prop to root dialog element', () => {
    const { container } = render(Modal, {
      props: {
        open: true,
        title: 'Test Modal',
        class: 'my-custom-class',
        children: emptySnippet,
      },
    });
    const dialog = container.querySelector('dialog');
    expect(dialog?.classList.contains('cinder-modal')).toBe(true);
    expect(dialog?.classList.contains('my-custom-class')).toBe(true);
  });
  test('body container has tabindex="-1" so it can receive programmatic focus', () => {
    const { container } = render(Modal, {
      props: {
        open: true,
        title: 'Test Modal',
        children: emptySnippet,
      },
    });
    const body = container.querySelector('.cinder-modal__body');
    expect(body?.getAttribute('tabindex')).toBe('-1');
  });
  test('overflow fade attachment marks and clears the modal body', () => {
    const cleanupOverflowFade = installOverflowFadeTestEnvironment();
    try {
      const { container } = render(Modal, {
        props: {
          open: true,
          title: 'Test Modal',
          children: textSnippet('Modal body content'),
        },
      });
      const body = requiredInstance(container.querySelector('.cinder-modal__body'), HTMLElement);
      expect(body).not.toBeNull();

      setScrollMeasurements(body, { clientHeight: 100, scrollHeight: 160, scrollTop: 0 });
      OverflowFadeResizeObserver.instances[0]?.trigger();
      flushOverflowFadeAnimationFrames();
      expect(body.hasAttribute('data-cinder-overflows')).toBe(true);

      setScrollMeasurements(body, { clientHeight: 100, scrollHeight: 160, scrollTop: 60 });
      body.dispatchEvent(new Event('scroll'));
      flushOverflowFadeAnimationFrames();
      expect(body.hasAttribute('data-cinder-overflows')).toBe(false);
    } finally {
      cleanupOverflowFade();
    }
  });
  test('body opts into the shared scroll-fade recipe with a surface-colored overlay, never a mask', async () => {
    const css = await Bun.file(new URL('./modal.css', import.meta.url)).text();
    expect(css).toMatch(
      /\.cinder-modal__body\s*\{[^}]*--_cinder-scroll-fade-color:\s*var\(--cinder-surface\)/s,
    );
    expect(css).not.toContain('mask-image:');
    expect(css).not.toMatch(/(?:-webkit-)?mask(?:-[a-z]+)?\s*:/);

    const { container } = render(Modal, {
      props: { open: true, title: 'Test Modal', children: textSnippet('Modal body content') },
    });
    const body = container.querySelector('.cinder-modal__body');
    expect(body?.classList.contains('cinder-_scroll-fade')).toBe(true);
  });
  test('autofocus DOM property on arbitrary child prevents body fallback focus', () => {
    const originalFocus = HTMLElement.prototype.focus;
    const focusTargets: HTMLElement[] = [];
    HTMLElement.prototype.focus = function focus() {
      focusTargets.push(this);
      return originalFocus.call(this);
    };

    try {
      const children = createRawSnippet(() => ({
        render: () => `<a href="/target">Autofocus link</a>`,
        setup: (node: Element) => {
          requiredInstance(node, HTMLElement).autofocus = true;
        },
      }));

      const { container } = render(Modal, {
        props: {
          open: true,
          title: 'Test Modal',
          children,
        },
      });

      const body = requiredInstance(container.querySelector('.cinder-modal__body'), HTMLElement);
      expect(focusTargets).not.toContain(body);
    } finally {
      HTMLElement.prototype.focus = originalFocus;
    }
  });
  test('close button is the last focusable element inside the panel', () => {
    // The close button was deliberately moved to the end of the DOM so the
    // native <dialog>.showModal() autofocus fallback (first focusable) does
    // not land on the X. Visually it stays in the corner via CSS.
    const { container } = render(Modal, {
      props: {
        open: true,
        title: 'Test Modal',
        children: textSnippet('Body content'),
        footer: textSnippet('Footer'),
      },
    });
    const panel = container.querySelector('.cinder-modal__panel');
    const focusables = panel?.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const last = focusables?.[focusables.length - 1];
    expect(last?.classList.contains('cinder-modal__close')).toBe(true);
  });
});
