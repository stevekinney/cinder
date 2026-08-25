/// <reference lib="dom" />
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { createRawSnippet, tick } from 'svelte';

import { _resetScrollLock } from '../../_internal/overlay.ts';
import { setupHappyDom } from '../../test/happy-dom.ts';
import {
  flushOverflowFadeAnimationFrames,
  installOverflowFadeTestEnvironment,
  OverflowFadeResizeObserver,
  setScrollMeasurements,
} from '../../test/overflow-fade-test-helpers.ts';

setupHappyDom();

// happy-dom does not implement HTMLDialogElement.showModal / close — stub them
// so the $effect inside modal.svelte doesn't throw when open=true.
if (typeof HTMLDialogElement !== 'undefined') {
  if (!HTMLDialogElement.prototype.showModal) {
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      value: function () {
        this.setAttribute('open', '');
      },
      configurable: true,
      writable: true,
    });
  }
  if (!HTMLDialogElement.prototype.close) {
    Object.defineProperty(HTMLDialogElement.prototype, 'close', {
      value: function () {
        this.removeAttribute('open');
      },
      configurable: true,
      writable: true,
    });
  }
}

const { cleanup, render, fireEvent, waitFor } = await import('@testing-library/svelte');
const { default: Modal } = await import('./modal.svelte');

function textSnippet(text: string) {
  return createRawSnippet(() => ({
    render: () => `<span>${text}</span>`,
    setup: () => {},
  }));
}

const emptySnippet = createRawSnippet(() => ({
  render: () => `<span></span>`,
  setup: () => {},
}));

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
  _resetScrollLock();
});

describe('Modal', () => {
  test('keeps dialog-owned anchored surfaces outside the dialog clipping boundary', () => {
    const css = readFileSync(new URL('./modal.css', import.meta.url), 'utf8');

    // Anchored overlays are portaled to the open dialog (the native top layer),
    // so the dialog itself must not clip their resolved bounds. Ordinary modal
    // content remains clipped by the panel below.
    expect(css).toMatch(/\.cinder-modal\s*\{[^}]*overflow:\s*visible;/s);
    expect(css).toMatch(/\.cinder-modal__panel\s*\{[^}]*overflow:\s*hidden;/s);
  });

  test('body uses the panel surface beneath header and footer', async () => {
    const css = await Bun.file(new URL('./modal.css', import.meta.url)).text();
    expect(css).toMatch(/\.cinder-modal__body\s*\{[^}]*background:\s*var\(--cinder-surface\)/s);
  });

  // Regression guard: the backdrop previously had no `transition` at all (it
  // snapped in AND out instantly), and the panel's entrance used a
  // one-directional `@keyframes` animation with no matching exit — so the
  // modal appeared but had zero exit animation. Both are now driven by
  // `transition` + `@starting-style`, the same mechanism Drawer/Sheet use,
  // so `waitForTransitionCompletion` (shared via `createSlidingDialogState`)
  // can observe completion and defer the real `dialogElement.close()`.
  test('modal.css replaces the one-directional keyframe entrance with a symmetric transition + starting-style', async () => {
    const css = await Bun.file(new URL('./modal.css', import.meta.url)).text();

    expect(css).not.toContain('@keyframes cinder-modal-enter');
    expect(css).not.toContain('animation: cinder-modal-enter');

    const backdropRuleStart = css.indexOf('.cinder-modal::backdrop {');
    const backdropRuleEnd = css.indexOf('}', backdropRuleStart);
    const backdropRule = css.slice(backdropRuleStart, backdropRuleEnd);
    expect(backdropRule).toContain('backdrop-filter');
    expect(backdropRule).toContain('transition-behavior: allow-discrete;');
    expect(css).toContain('.cinder-modal[data-cinder-closing]::backdrop');

    const panelRuleStart = css.indexOf('.cinder-modal__panel {');
    const panelRuleEnd = css.indexOf('}', panelRuleStart);
    const panelRule = css.slice(panelRuleStart, panelRuleEnd);
    expect(panelRule).toContain('transition:');
    expect(css).toContain('.cinder-modal__panel[data-cinder-closing]');

    // Modal declares two separate `@starting-style` blocks (backdrop, then
    // panel) — assert each independently rather than assuming they're
    // adjacent in the source.
    const startingStyleBlocks = Array.from(
      css.matchAll(/@starting-style\s*\{[\s\S]*?\n {2}\}/g),
    ).map((match) => match[0]);
    expect(startingStyleBlocks.length).toBe(2);
    expect(startingStyleBlocks.some((block) => block.includes('.cinder-modal::backdrop'))).toBe(
      true,
    );
    expect(startingStyleBlocks.some((block) => block.includes('.cinder-modal__panel'))).toBe(true);
  });

  test('dialog is in the DOM but has no open attribute when open=false (client-side)', () => {
    // In a browser context $effect runs, setting mounted=true, so the <dialog> is always
    // present client-side. The dialog is closed (no 'open' attribute) but not torn down,
    // which allows dialogElement.close() to fire correctly on programmatic close.
    // In SSR (no $effect), mounted stays false, so the element is absent from HTML output.
    const { container } = render(Modal, {
      props: {
        open: false,
        title: 'Test Modal',
        children: emptySnippet,
      },
    });
    const dialog = container.querySelector('dialog');
    expect(dialog).not.toBeNull();
    expect(dialog?.hasAttribute('open')).toBe(false);
  });

  test('renders a dialog element when open=true', () => {
    const { container } = render(Modal, {
      props: {
        open: true,
        title: 'Test Modal',
        children: emptySnippet,
      },
    });
    expect(container.querySelector('dialog')).not.toBeNull();
  });

  test('renders the title inside the dialog', () => {
    const { container } = render(Modal, {
      props: {
        open: true,
        title: 'My Dialog Title',
        children: emptySnippet,
      },
    });
    const title = container.querySelector('.cinder-modal__title');
    expect(title).not.toBeNull();
    expect(title?.textContent).toContain('My Dialog Title');
  });

  test('renders children content inside the body', () => {
    const { container } = render(Modal, {
      props: {
        open: true,
        title: 'Test Modal',
        children: textSnippet('Modal body content'),
      },
    });
    const body = container.querySelector('.cinder-modal__body');
    expect(body?.textContent).toContain('Modal body content');
  });

  test('renders footer snippet when provided', () => {
    const { container } = render(Modal, {
      props: {
        open: true,
        title: 'Test Modal',
        children: emptySnippet,
        footer: textSnippet('Footer content'),
      },
    });
    const footer = container.querySelector('.cinder-modal__footer');
    expect(footer).not.toBeNull();
    expect(footer?.textContent).toContain('Footer content');
  });

  test('footer is absent when footer prop is not provided', () => {
    const { container } = render(Modal, {
      props: {
        open: true,
        title: 'Test Modal',
        children: emptySnippet,
      },
    });
    expect(container.querySelector('.cinder-modal__footer')).toBeNull();
  });

  test('close button has aria-label="Close dialog"', () => {
    const { container } = render(Modal, {
      props: {
        open: true,
        title: 'Test Modal',
        children: emptySnippet,
      },
    });
    const closeButton = container.querySelector('.cinder-modal__close');
    expect(closeButton?.getAttribute('aria-label')).toBe('Close dialog');
  });

  test('closeButtonVisible=false omits the close button', () => {
    const { container } = render(Modal, {
      props: {
        open: true,
        title: 'Sticky Modal',
        closeButtonVisible: false,
        children: emptySnippet,
      },
    });

    expect(container.querySelector('.cinder-modal__close')).toBeNull();
  });

  test('clicking the close button sets open to false', async () => {
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

    const closeButton = container.querySelector('.cinder-modal__close') as HTMLButtonElement;
    expect(closeButton).not.toBeNull();
    await fireEvent.click(closeButton);
    expect(openValue).toBe(false);
  });

  test('keeps the panel mounted with data-cinder-closing until its exit transition finishes', async () => {
    // Stub a real (non-zero) transition duration for `.cinder-modal__panel` so
    // `waitForTransitionCompletion` (shared with Drawer/Sheet via
    // `createSlidingDialogState`) takes its transitionend-listening path
    // instead of resolving on the next microtask — this is the only way to
    // observe the intermediate "closing but still mounted, dialog still
    // native-open" state that proves a real exit path now exists.
    const originalGetComputedStyle = window.getComputedStyle.bind(window);
    window.getComputedStyle = ((target: Element) => {
      if (target instanceof HTMLElement && target.classList.contains('cinder-modal__panel')) {
        return {
          transitionProperty: 'opacity, translate',
          transitionDuration: '80ms, 80ms',
          transitionDelay: '0ms, 0ms',
        } as CSSStyleDeclaration;
      }
      return originalGetComputedStyle(target);
    }) as typeof window.getComputedStyle;

    try {
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

      const dialog = container.querySelector('dialog') as HTMLDialogElement;
      const closeButton = container.querySelector('.cinder-modal__close') as HTMLButtonElement;
      await fireEvent.click(closeButton);

      // The bound `open` prop flips synchronously (consumers must see this
      // immediately), but the native <dialog> itself and the panel's DOM
      // node must both survive the exit transition instead of vanishing in
      // the same tick — that was the original bug (no exit animation could
      // ever play).
      expect(openValue).toBe(false);
      expect(dialog.hasAttribute('open')).toBe(true);
      const panel = container.querySelector('.cinder-modal__panel');
      expect(panel).not.toBeNull();
      expect(panel?.hasAttribute('data-cinder-closing')).toBe(true);
      expect(dialog.hasAttribute('data-cinder-closing')).toBe(true);

      for (const propertyName of ['opacity', 'translate']) {
        const event = new Event('transitionend');
        Object.defineProperty(event, 'propertyName', { value: propertyName });
        panel?.dispatchEvent(event);
      }

      await waitFor(() => {
        expect(dialog.hasAttribute('open')).toBe(false);
        expect(container.querySelector('.cinder-modal__panel')).toBeNull();
      });
    } finally {
      window.getComputedStyle = originalGetComputedStyle;
    }
  });

  test('onExitComplete fires only once the exit transition genuinely finishes, not when open first flips false', async () => {
    // Same real-transition stub as the test above — this is the only way to
    // observe that onExitComplete is NOT called merely because `open` went
    // false; it must wait for the actual transitionend-driven completion.
    const originalGetComputedStyle = window.getComputedStyle.bind(window);
    window.getComputedStyle = ((target: Element) => {
      if (target instanceof HTMLElement && target.classList.contains('cinder-modal__panel')) {
        return {
          transitionProperty: 'opacity, translate',
          transitionDuration: '80ms, 80ms',
          transitionDelay: '0ms, 0ms',
        } as CSSStyleDeclaration;
      }
      return originalGetComputedStyle(target);
    }) as typeof window.getComputedStyle;

    try {
      let openValue = true;
      let exitCompleteCount = 0;
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
          onExitComplete: () => {
            exitCompleteCount++;
          },
        },
      });

      const closeButton = container.querySelector('.cinder-modal__close') as HTMLButtonElement;
      await fireEvent.click(closeButton);
      expect(openValue).toBe(false);
      // Still mounted, still mid-transition — onExitComplete must not have
      // fired yet.
      expect(exitCompleteCount).toBe(0);

      const panel = container.querySelector('.cinder-modal__panel');
      for (const propertyName of ['opacity', 'translate']) {
        const event = new Event('transitionend');
        Object.defineProperty(event, 'propertyName', { value: propertyName });
        panel?.dispatchEvent(event);
      }

      await waitFor(() => {
        expect(container.querySelector('.cinder-modal__panel')).toBeNull();
      });
      expect(exitCompleteCount).toBe(1);
    } finally {
      window.getComputedStyle = originalGetComputedStyle;
    }
  });

  test('onExitComplete fires immediately under reduced motion (transition collapsed to zero)', async () => {
    // No getComputedStyle stub here — happy-dom's default (zero) transition
    // duration is exactly the reduced-motion-collapsed path
    // waitForTransitionCompletion takes, resolving via queueMicrotask.
    let openValue = true;
    let exitCompleteCount = 0;
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
        onExitComplete: () => {
          exitCompleteCount++;
        },
      },
    });

    const closeButton = container.querySelector('.cinder-modal__close') as HTMLButtonElement;
    await fireEvent.click(closeButton);

    await waitFor(() => {
      expect(container.querySelector('.cinder-modal__panel')).toBeNull();
    });
    expect(exitCompleteCount).toBe(1);
  });

  test('a throwing onExitComplete does not block the native dialog from closing or the scroll lock from releasing', async () => {
    // Regression: `#finishClosing` used to call `onClosed?.()` (which
    // forwards to this consumer callback) BEFORE `dialogElement.close()`.
    // A throwing consumer callback would therefore propagate out before the
    // native `close()` call ever ran — leaving the dialog stuck open in the
    // top layer, and the scroll lock/escape-stack hold (released by the
    // native `close` event's own `onclose` handler) never released. The
    // fix reorders `#finishClosing` to call `close()` first.
    //
    // Uses the same real-(non-collapsed)-transition stub as the
    // "keeps the panel mounted..." test above, and drives completion via an
    // explicit `dispatchEvent('transitionend')` rather than letting the
    // reduced-motion queued-microtask path resolve on its own — a throw
    // from a listener invoked via `dispatchEvent` propagates synchronously
    // out of that call (matching this harness's behavior), which is what
    // makes the throw observable/catchable here at all; a throw from a
    // bare `queueMicrotask` continuation is not something a `try`/`catch`
    // around the triggering action can intercept.
    const originalGetComputedStyle = window.getComputedStyle.bind(window);
    window.getComputedStyle = ((target: Element) => {
      if (target instanceof HTMLElement && target.classList.contains('cinder-modal__panel')) {
        return {
          transitionProperty: 'opacity, translate',
          transitionDuration: '80ms, 80ms',
          transitionDelay: '0ms, 0ms',
        } as CSSStyleDeclaration;
      }
      return originalGetComputedStyle(target);
    }) as typeof window.getComputedStyle;

    try {
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
          onExitComplete: () => {
            throw new Error('boom — a throwing consumer callback');
          },
        },
      });

      expect(document.body.style.overflow).toBe('hidden');
      const dialog = container.querySelector('dialog') as HTMLDialogElement;
      const closeButton = container.querySelector('.cinder-modal__close') as HTMLButtonElement;
      await fireEvent.click(closeButton);

      const panel = container.querySelector('.cinder-modal__panel');
      // `dispatchEvent` follows the DOM spec here (matching real browsers):
      // an exception thrown inside a listener is reported, not propagated
      // to the caller — so this does NOT throw, even though
      // `onExitComplete` (invoked from deep inside this dispatch, via
      // `waitForTransitionCompletion`'s `finish()` → `#finishClosing`) does.
      // What this test actually proves is the ORDERING inside
      // `#finishClosing`: the assertions below only pass if
      // `dialogElement.close()` (and the scroll-lock/escape-stack release
      // its native `close` event triggers) ran BEFORE the throwing
      // callback — which is exactly the fix.
      for (const propertyName of ['opacity', 'translate']) {
        const event = new Event('transitionend');
        Object.defineProperty(event, 'propertyName', { value: propertyName });
        panel?.dispatchEvent(event);
      }

      // The native dialog is genuinely closed and body scroll is restored —
      // despite the consumer callback throwing.
      expect(dialog.hasAttribute('open')).toBe(false);
      expect(document.body.style.overflow).toBe('');
    } finally {
      window.getComputedStyle = originalGetComputedStyle;
    }
  });

  test('onExitComplete does NOT fire when open flips back to true before the exit transition finishes (reopen during close)', async () => {
    const originalGetComputedStyle = window.getComputedStyle.bind(window);
    window.getComputedStyle = ((target: Element) => {
      if (target instanceof HTMLElement && target.classList.contains('cinder-modal__panel')) {
        return {
          transitionProperty: 'opacity, translate',
          transitionDuration: '80ms, 80ms',
          transitionDelay: '0ms, 0ms',
        } as CSSStyleDeclaration;
      }
      return originalGetComputedStyle(target);
    }) as typeof window.getComputedStyle;

    try {
      let openValue = true;
      let exitCompleteCount = 0;
      const { container, rerender } = render(Modal, {
        props: {
          get open() {
            return openValue;
          },
          set open(value: boolean) {
            openValue = value;
          },
          title: 'Test Modal',
          children: emptySnippet,
          onExitComplete: () => {
            exitCompleteCount++;
          },
        },
      });

      const closeButton = container.querySelector('.cinder-modal__close') as HTMLButtonElement;
      await fireEvent.click(closeButton);
      expect(openValue).toBe(false);

      // Reopen mid-transition, before any transitionend fires.
      openValue = true;
      await rerender({ open: true, title: 'Test Modal', children: emptySnippet });

      // The panel never actually unmounted, so onExitComplete must not fire —
      // even after the exit-transition's own generation is force-completed
      // internally on reopen.
      expect(container.querySelector('.cinder-modal__panel')).not.toBeNull();
      expect(exitCompleteCount).toBe(0);
    } finally {
      window.getComputedStyle = originalGetComputedStyle;
    }
  });

  test('destroying the component (e.g. a consumer unmounting Modal from onExitComplete) detaches the <dialog> from the DOM', () => {
    // Regression: a native <dialog> shown via showModal() is promoted to
    // the browser's top layer, outside ordinary document flow — a consumer
    // composing Modal behind its own conditional mount keyed off
    // onExitComplete (the documented pattern) could otherwise be left with
    // a stale, already-destroyed instance's <dialog> still attached to the
    // DOM after the surrounding block tears down, since top-layer promotion
    // means it is not always removed by ordinary child-removal alone.
    const { container, unmount } = render(Modal, {
      props: {
        open: true,
        title: 'Test Modal',
        children: emptySnippet,
      },
    });
    const dialog = container.querySelector('dialog');
    expect(dialog).not.toBeNull();
    expect(document.body.contains(dialog)).toBe(true);

    unmount();

    expect(document.body.contains(dialog)).toBe(false);
  });

  test('dialog close event sets open to false', async () => {
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

    const dialog = container.querySelector('dialog') as HTMLDialogElement;
    expect(dialog).not.toBeNull();
    await fireEvent(dialog, new Event('close'));
    expect(openValue).toBe(false);
  });

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

    const dialog = container.querySelector('dialog') as HTMLDialogElement;
    expect(dialog).not.toBeNull();
    // Simulate the browser sequence: Escape keydown → close event on the dialog.
    await fireEvent.keyDown(dialog, { key: 'Escape', code: 'Escape' });
    await fireEvent(dialog, new Event('close'));
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
      const body = container.querySelector('.cinder-modal__body') as HTMLElement;
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
          (node as HTMLElement).autofocus = true;
        },
      }));

      const { container } = render(Modal, {
        props: {
          open: true,
          title: 'Test Modal',
          children,
        },
      });

      const body = container.querySelector('.cinder-modal__body') as HTMLElement;
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

  test('describedById sets aria-describedby on the dialog element', () => {
    const { container } = render(Modal, {
      props: {
        open: true,
        title: 'Test Modal',
        children: emptySnippet,
        describedById: 'x-123',
      },
    });
    const dialog = container.querySelector('dialog');
    expect(dialog?.getAttribute('aria-describedby')).toBe('x-123');
  });

  test('aria-describedby is absent when describedById is omitted', () => {
    const { container } = render(Modal, {
      props: {
        open: true,
        title: 'Test Modal',
        children: emptySnippet,
      },
    });
    const dialog = container.querySelector('dialog');
    expect(dialog?.hasAttribute('aria-describedby')).toBe(false);
  });

  test('onDismiss fires when native cancel event is dispatched (Escape)', async () => {
    let dismissCount = 0;
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
        onDismiss: () => {
          dismissCount++;
        },
      },
    });
    const dialog = container.querySelector('dialog') as HTMLDialogElement;
    const cancelEvent = new Event('cancel', { cancelable: true });
    await fireEvent(dialog, cancelEvent);
    expect(dismissCount).toBe(1);
    expect(openValue).toBe(false);
  });

  test('native cancel event is prevented (Escape routes through dismiss())', async () => {
    const { container } = render(Modal, {
      props: {
        open: true,
        title: 'Test Modal',
        children: emptySnippet,
      },
    });
    const dialog = container.querySelector('dialog') as HTMLDialogElement;
    const cancelEvent = new Event('cancel', { cancelable: true });
    await fireEvent(dialog, cancelEvent);
    expect(cancelEvent.defaultPrevented).toBe(true);
  });

  test('onDismiss fires when backdrop is clicked', async () => {
    let dismissCount = 0;
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
        onDismiss: () => {
          dismissCount++;
        },
      },
    });
    const dialog = container.querySelector('dialog') as HTMLDialogElement;
    await fireEvent.click(dialog);
    expect(dismissCount).toBe(1);
    expect(openValue).toBe(false);
  });

  test('onDismiss fires when the close-X button is clicked', async () => {
    let dismissCount = 0;
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
        onDismiss: () => {
          dismissCount++;
        },
      },
    });
    const closeButton = container.querySelector('.cinder-modal__close') as HTMLButtonElement;
    await fireEvent.click(closeButton);
    expect(dismissCount).toBe(1);
    expect(openValue).toBe(false);
  });

  test('onDismiss does NOT fire when open is set to false by the parent', async () => {
    let dismissCount = 0;
    let openValue = true;
    const { rerender } = render(Modal, {
      props: {
        get open() {
          return openValue;
        },
        set open(value: boolean) {
          openValue = value;
        },
        title: 'Test Modal',
        children: emptySnippet,
        onDismiss: () => {
          dismissCount++;
        },
      },
    });
    // Parent-driven close: update the prop directly
    await rerender({ open: false, title: 'Test Modal', children: emptySnippet });
    expect(dismissCount).toBe(0);
  });

  test('focus restores to triggerRef on close', async () => {
    // Baseline focus so captureFocus() sees a known state. Without this, a
    // stale activeElement from a prior test can leak into capturedFocus and
    // win against triggerRef in the candidate iteration.
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    const button = document.createElement('button');
    button.id = 'modal-trigger';
    document.body.appendChild(button);

    let openValue = true;
    const { container } = render(Modal, {
      props: {
        get open() {
          return openValue;
        },
        set open(value: boolean) {
          openValue = value;
        },
        title: 'Test',
        triggerRef: button,
        children: emptySnippet,
      },
    });

    const dialog = container.querySelector('dialog') as HTMLDialogElement;
    await fireEvent(dialog, new Event('close'));
    expect(document.activeElement).toBe(button);

    document.body.removeChild(button);
  });

  test('focus restores to captured element when triggerRef is unmounted before close', async () => {
    const previouslyFocused = document.createElement('button');
    previouslyFocused.id = 'prev-focus';
    document.body.appendChild(previouslyFocused);
    previouslyFocused.focus();

    const triggerEl = document.createElement('button');
    triggerEl.id = 'transient-trigger';
    document.body.appendChild(triggerEl);

    let openValue = true;
    const { container } = render(Modal, {
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

    // Unmount the trigger before the dialog closes.
    document.body.removeChild(triggerEl);

    const dialog = container.querySelector('dialog') as HTMLDialogElement;
    await fireEvent(dialog, new Event('close'));
    expect(document.activeElement).toBe(previouslyFocused);

    document.body.removeChild(previouslyFocused);
  });

  test('no focus is forced when all candidates are disconnected', async () => {
    const triggerEl = document.createElement('button');
    document.body.appendChild(triggerEl);

    let openValue = true;
    const { container } = render(Modal, {
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

    // Drop the trigger AND make sure captured focus is null (it was null at open
    // because focus was on body before render).
    document.body.removeChild(triggerEl);

    const dialog = container.querySelector('dialog') as HTMLDialogElement;
    await fireEvent(dialog, new Event('close'));
    // No fallback to document.body — focus stays where the dialog left it.
    expect(document.activeElement).not.toBe(triggerEl);
  });

  test('body scroll lock is acquired on open and released on close', async () => {
    let openValue = true;
    const { container } = render(Modal, {
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

    expect(document.body.style.overflow).toBe('hidden');

    const dialog = container.querySelector('dialog') as HTMLDialogElement;
    await fireEvent(dialog, new Event('close'));
    expect(document.body.style.overflow).toBe('');
  });

  test('body scroll lock is released when modal is unmounted while open', () => {
    const { unmount } = render(Modal, {
      props: { open: true, title: 'Test', children: emptySnippet },
    });
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('');
  });

  test('two stacked modals: closing the inner one keeps the lock held', async () => {
    const outer = render(Modal, {
      props: { open: true, title: 'Outer', children: emptySnippet },
    });
    expect(document.body.style.overflow).toBe('hidden');

    let innerOpen = true;
    const inner = render(Modal, {
      props: {
        get open() {
          return innerOpen;
        },
        set open(value: boolean) {
          innerOpen = value;
        },
        title: 'Inner',
        children: emptySnippet,
      },
    });
    expect(document.body.style.overflow).toBe('hidden');

    const innerDialog = inner.container.querySelector('dialog') as HTMLDialogElement;
    await fireEvent(innerDialog, new Event('close'));
    expect(document.body.style.overflow).toBe('hidden');

    const outerDialog = outer.container.querySelector('dialog') as HTMLDialogElement;
    await fireEvent(outerDialog, new Event('close'));
    expect(document.body.style.overflow).toBe('');
  });

  test('release is idempotent across close-then-unmount', async () => {
    let openValue = true;
    const { container, unmount } = render(Modal, {
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

    expect(document.body.style.overflow).toBe('hidden');

    const dialog = container.querySelector('dialog') as HTMLDialogElement;
    await fireEvent(dialog, new Event('close'));
    expect(document.body.style.overflow).toBe('');

    // Unmount after close — second release MUST be a no-op (it would otherwise
    // refcount-underflow and could clear overflow set by an unrelated overlay).
    document.body.style.overflow = 'scroll';
    unmount();
    expect(document.body.style.overflow).toBe('scroll');
    document.body.style.overflow = '';
  });

  test('a throwing onDismiss callback propagates the error but open is still false', async () => {
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
        onDismiss: () => {
          throw new Error('onDismiss error');
        },
      },
    });
    const closeButton = container.querySelector('.cinder-modal__close') as HTMLButtonElement;
    // fireEvent swallows handler errors internally; we assert the state side-effect instead.
    await fireEvent.click(closeButton);
    // open flipped to false before the callback ran, so the throw doesn't leave dialog stuck
    expect(openValue).toBe(false);
  });

  test('dismissOnBackdropClick=false keeps backdrop clicks from closing', async () => {
    let openValue = true;
    const { container } = render(Modal, {
      props: {
        get open() {
          return openValue;
        },
        set open(value: boolean) {
          openValue = value;
        },
        title: 'Sticky modal',
        dismissOnBackdropClick: false,
        children: emptySnippet,
      },
    });

    const dialog = container.querySelector('dialog') as HTMLDialogElement;
    await fireEvent.click(dialog);
    expect(openValue).toBe(true);
  });

  test('dismissOnEscape=false prevents native cancel dismissal', async () => {
    let openValue = true;
    const { container } = render(Modal, {
      props: {
        get open() {
          return openValue;
        },
        set open(value: boolean) {
          openValue = value;
        },
        title: 'Sticky modal',
        dismissOnEscape: false,
        children: emptySnippet,
      },
    });

    const dialog = container.querySelector('dialog') as HTMLDialogElement;
    const cancelEvent = new Event('cancel', { cancelable: true });
    await fireEvent(dialog, cancelEvent);
    expect(cancelEvent.defaultPrevented).toBe(true);
    expect(openValue).toBe(true);
  });

  // Dialog-model boundary tests
  // These tests document the public contract separating Modal (generic shell),
  // ConfirmDialog (user-initiated binary decision), and AlertDialog (urgent
  // blocking acknowledgement). They also guard the alertdialog escape hatch.

  test('default Modal is dismissable by Escape — unlike AlertDialog', async () => {
    // Modal defaults dismissOnEscape=true. This test documents the contrast with
    // AlertDialog, which passes dismissOnEscape={false} and cannot be Escape-dismissed.
    let openValue = true;
    const { container } = render(Modal, {
      props: {
        get open() {
          return openValue;
        },
        set open(value: boolean) {
          openValue = value;
        },
        title: 'Generic modal',
        children: emptySnippet,
      },
    });

    const dialog = container.querySelector('dialog') as HTMLDialogElement;
    const cancelEvent = new Event('cancel', { cancelable: true });
    await fireEvent(dialog, cancelEvent);
    // Default Modal allows Escape (dismissOnEscape=true) — open becomes false.
    expect(openValue).toBe(false);
  });

  test('default Modal is dismissable by backdrop click — unlike AlertDialog', async () => {
    // Modal defaults dismissOnBackdropClick=true. This test documents the contrast
    // with AlertDialog, which passes dismissOnBackdropClick={false}.
    let openValue = true;
    const { container } = render(Modal, {
      props: {
        get open() {
          return openValue;
        },
        set open(value: boolean) {
          openValue = value;
        },
        title: 'Generic modal',
        children: emptySnippet,
      },
    });

    const dialog = container.querySelector('dialog') as HTMLDialogElement;
    await fireEvent.click(dialog);
    expect(openValue).toBe(false);
  });

  test('DEV warning fires when role="alertdialog" is used without companion dismiss flags', () => {
    const originalWarn = console.warn;
    const warnings: string[] = [];
    console.warn = (...args: unknown[]) => {
      warnings.push(args.map(String).join(' '));
    };

    try {
      render(Modal, {
        props: {
          open: true,
          title: 'Session expired',
          role: 'alertdialog',
          describedById: 'session-description',
          // dismissOnBackdropClick and dismissOnEscape intentionally left at their defaults (true)
          // to trigger the dev warning about the broken alertdialog contract
          children: emptySnippet,
        },
      });
      expect(warnings.some((warning) => warning.includes('[cinder/Modal]'))).toBe(true);
      expect(warnings.some((warning) => warning.includes('role="alertdialog"'))).toBe(true);
    } finally {
      console.warn = originalWarn;
    }
  });

  test('DEV warning does NOT fire when role="alertdialog" has all companion flags set correctly', () => {
    const originalWarn = console.warn;
    const warnings: string[] = [];
    console.warn = (...args: unknown[]) => {
      warnings.push(args.map(String).join(' '));
    };

    try {
      render(Modal, {
        props: {
          open: true,
          title: 'Session expired',
          role: 'alertdialog',
          dismissOnBackdropClick: false,
          dismissOnEscape: false,
          closeButtonVisible: false,
          describedById: 'session-description',
          children: emptySnippet,
        },
      });
      expect(warnings.some((warning) => warning.includes('[cinder/Modal]'))).toBe(false);
    } finally {
      console.warn = originalWarn;
    }
  });

  test('role="alertdialog" with both dismiss flags off is the sticky alertdialog contract', async () => {
    // Documents the manual composition required when using Modal's role="alertdialog"
    // escape hatch: both dismiss flags must be false to satisfy the alertdialog contract.
    let openValue = true;
    const { container } = render(Modal, {
      props: {
        get open() {
          return openValue;
        },
        set open(value: boolean) {
          openValue = value;
        },
        title: 'Session expired',
        role: 'alertdialog',
        describedById: 'manual-desc',
        dismissOnBackdropClick: false,
        dismissOnEscape: false,
        closeButtonVisible: false,
        children: emptySnippet,
      },
    });

    const dialog = container.querySelector('dialog') as HTMLDialogElement;
    expect(dialog?.getAttribute('role')).toBe('alertdialog');

    // Neither Escape (native cancel event) nor backdrop click should dismiss.
    const cancelEvent = new Event('cancel', { cancelable: true });
    await fireEvent(dialog, cancelEvent);
    expect(cancelEvent.defaultPrevented).toBe(true);
    expect(openValue).toBe(true);

    await fireEvent.click(dialog);
    expect(openValue).toBe(true);

    // No close button rendered when closeButtonVisible=false.
    expect(container.querySelector('.cinder-modal__close')).toBeNull();
  });
});

describe('Modal chromeless mode (chrome="none")', () => {
  test('suppresses the header/title, applying aria-label as the accessible name instead', () => {
    const { container } = render(Modal, {
      props: {
        open: true,
        chrome: 'none',
        'aria-label': 'Image viewer',
        children: emptySnippet,
      },
    });
    const dialog = container.querySelector('dialog') as HTMLDialogElement;
    expect(container.querySelector('.cinder-modal__header')).toBeNull();
    expect(dialog.getAttribute('aria-label')).toBe('Image viewer');
    expect(dialog.hasAttribute('aria-labelledby')).toBe(false);
  });

  test('still sets role="dialog" and aria-modal="true" from Modal\'s own markup', () => {
    const { container } = render(Modal, {
      props: {
        open: true,
        chrome: 'none',
        'aria-label': 'Image viewer',
        children: emptySnippet,
      },
    });
    const dialog = container.querySelector('dialog') as HTMLDialogElement;
    expect(dialog.getAttribute('role')).toBe('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
  });

  test('marks the dialog and panel with data-cinder-chrome="none" so CSS can drop border/max-width/padding', () => {
    const { container } = render(Modal, {
      props: {
        open: true,
        chrome: 'none',
        'aria-label': 'Image viewer',
        children: emptySnippet,
      },
    });
    const dialog = container.querySelector('dialog') as HTMLDialogElement;
    const panel = container.querySelector('.cinder-modal__panel') as HTMLElement;
    const body = container.querySelector('.cinder-modal__body') as HTMLElement;
    expect(dialog.getAttribute('data-cinder-chrome')).toBe('none');
    expect(panel.getAttribute('data-cinder-chrome')).toBe('none');
    expect(body.getAttribute('data-cinder-chrome')).toBe('none');
  });

  test('the default chrome renders the header/title and carries no data-cinder-chrome attribute', () => {
    const { container } = render(Modal, {
      props: {
        open: true,
        title: 'Test Modal',
        children: emptySnippet,
      },
    });
    const dialog = container.querySelector('dialog') as HTMLDialogElement;
    expect(container.querySelector('.cinder-modal__header')).not.toBeNull();
    expect(dialog.hasAttribute('data-cinder-chrome')).toBe(false);
    expect(dialog.getAttribute('aria-labelledby')).not.toBeNull();
  });

  test('modal.css suppresses max-width/border/padding for data-cinder-chrome="none" without touching coordination logic', async () => {
    const css = await Bun.file(new URL('./modal.css', import.meta.url)).text();
    expect(css).toMatch(/\.cinder-modal\[data-cinder-chrome='none'\]\s*\{[^}]*max-width:\s*none;/s);
    expect(css).toMatch(
      /\.cinder-modal__panel\[data-cinder-chrome='none'\]\s*\{[^}]*border:\s*none;/s,
    );
    expect(css).toMatch(
      /\.cinder-modal__body\[data-cinder-chrome='none'\]\s*\{[^}]*padding:\s*0;/s,
    );
  });

  test('modal.css disables the shared scroll-fade\'s opaque edge overlay for data-cinder-chrome="none"', async () => {
    // The shared `.cinder-_scroll-fade` recipe fades with an OPAQUE overlay
    // painted in `--_cinder-scroll-fade-color` (--cinder-surface here) by
    // design (see _scroll-fade.css's design rules). A chromeless body is
    // transparent/full-bleed on purpose, with no surface color to fade INTO
    // — that opaque band would paint a solid stripe across arbitrary
    // full-bleed content (e.g. an image lightbox's photo). `content: none`
    // fully suppresses the generated `::after` box; a bare `opacity: 0`
    // would not be enough, since a running `animation-timeline: scroll()`
    // keyframe overrides plain `opacity` regardless of source order.
    const css = await Bun.file(new URL('./modal.css', import.meta.url)).text();
    expect(css).toMatch(
      /\.cinder-modal__body\[data-cinder-chrome='none'\]::after\s*\{[^}]*content:\s*none;/s,
    );
  });

  test('exposes --cinder-modal-backdrop as a supported backdrop-color override point', async () => {
    const css = await Bun.file(new URL('./modal.css', import.meta.url)).text();
    // Declared on .cinder-modal as a PLAIN (non-self-referencing) reference
    // to --cinder-overlay-backdrop, purely so the variables generator
    // collects --cinder-modal-backdrop into modal.variables.json/README.
    // NOT redeclared on `.cinder-modal::backdrop` at all — the fallback for
    // that pseudo-element lives on the CONSUMING `background-color`
    // property instead (see the cyclic-fallback regression test below for
    // why a redeclaration there would be actively wrong).
    expect(css).toMatch(
      /\.cinder-modal\s*\{[^}]*--cinder-modal-backdrop:\s*var\(--cinder-overlay-backdrop\);/s,
    );
    expect(css).toContain(
      'background-color: var(--cinder-modal-backdrop, var(--cinder-overlay-backdrop));',
    );
  });

  test('the --cinder-modal-backdrop fallback is never a self-referencing (cyclic) custom-property declaration', async () => {
    const css = await Bun.file(new URL('./modal.css', import.meta.url)).text();
    // Regression: `--cinder-modal-backdrop: var(--cinder-modal-backdrop, fallback)`
    // is a CSS custom-property dependency CYCLE — a property referencing
    // itself in its own declaration — which the spec resolves by making the
    // property invalid at computed-value time. Cycle detection happens
    // BEFORE fallback substitution, so the fallback argument does not
    // rescue it: this form breaks the backdrop for every Modal with no
    // override at all. An earlier revision of this file made exactly this
    // mistake trying to avoid shadowing ancestor-scoped overrides; the
    // correct fix moves the fallback to the CONSUMING property
    // (`background-color`) instead of self-referencing the declaration.
    expect(css).not.toContain(
      '--cinder-modal-backdrop: var(--cinder-modal-backdrop, var(--cinder-overlay-backdrop));',
    );

    // `.cinder-modal::backdrop` must not declare --cinder-modal-backdrop at
    // all (a hard literal redeclare there would always win the cascade for
    // that exact pseudo-element, shadowing an ancestor-/:root-scoped
    // consumer override in any engine that would otherwise let it inherit
    // through) — only consume it, with the fallback on the right-hand side
    // of `background-color`.
    const backdropRuleStart = css.indexOf('.cinder-modal::backdrop {');
    const backdropRuleEnd = css.indexOf('}', backdropRuleStart);
    const backdropRule = css.slice(backdropRuleStart, backdropRuleEnd);
    expect(backdropRule).not.toContain('--cinder-modal-backdrop:');
    expect(backdropRule).toContain(
      'background-color: var(--cinder-modal-backdrop, var(--cinder-overlay-backdrop));',
    );
  });

  test('coordination (focus trap, scroll lock, escape stack, exit transition) is unchanged in chromeless mode', async () => {
    let openValue = true;
    const { container } = render(Modal, {
      props: {
        get open() {
          return openValue;
        },
        set open(value: boolean) {
          openValue = value;
        },
        chrome: 'none',
        'aria-label': 'Image viewer',
        children: emptySnippet,
      },
    });
    const dialog = container.querySelector('dialog') as HTMLDialogElement;
    // Native cancel (Escape) still routes through requestClose()/onDismiss,
    // exactly like the default chrome.
    const cancelEvent = new Event('cancel', { cancelable: true });
    await fireEvent(dialog, cancelEvent);
    expect(cancelEvent.defaultPrevented).toBe(true);
    expect(openValue).toBe(false);
  });

  test('clicking the panel background dismisses (backdrop-equivalent) since the panel fills the whole dialog', async () => {
    // Regression: chrome="none" makes the panel/body fill the dialog's
    // entire content box (width/height 100%, inset 0), so a real click can
    // never land directly on `dialogElement` — event.target === dialogElement
    // is unreachable there. The panel/body ARE the backdrop-equivalent
    // surface for this chrome.
    let openValue = true;
    const { container } = render(Modal, {
      props: {
        get open() {
          return openValue;
        },
        set open(value: boolean) {
          openValue = value;
        },
        chrome: 'none',
        'aria-label': 'Image viewer',
        children: emptySnippet,
      },
    });
    const panel = container.querySelector('.cinder-modal__panel') as HTMLElement;
    await fireEvent.click(panel);
    expect(openValue).toBe(false);
  });

  test('clicking the body background dismisses (backdrop-equivalent)', async () => {
    let openValue = true;
    const { container } = render(Modal, {
      props: {
        get open() {
          return openValue;
        },
        set open(value: boolean) {
          openValue = value;
        },
        chrome: 'none',
        'aria-label': 'Image viewer',
        children: emptySnippet,
      },
    });
    const body = container.querySelector('.cinder-modal__body') as HTMLElement;
    await fireEvent.click(body);
    expect(openValue).toBe(false);
  });

  test('dismissOnBackdropClick=false keeps chromeless panel/body clicks from closing', async () => {
    let openValue = true;
    const { container } = render(Modal, {
      props: {
        get open() {
          return openValue;
        },
        set open(value: boolean) {
          openValue = value;
        },
        chrome: 'none',
        'aria-label': 'Image viewer',
        dismissOnBackdropClick: false,
        children: emptySnippet,
      },
    });
    const panel = container.querySelector('.cinder-modal__panel') as HTMLElement;
    await fireEvent.click(panel);
    expect(openValue).toBe(true);
  });

  test('a click on real content INSIDE the chromeless body does not dismiss (event.target is the content, not the body/panel)', async () => {
    const contentSnippet = createRawSnippet(() => ({
      render: () => `<button type="button" id="real-content">Real content</button>`,
      setup: () => {},
    }));
    let openValue = true;
    const { container } = render(Modal, {
      props: {
        get open() {
          return openValue;
        },
        set open(value: boolean) {
          openValue = value;
        },
        chrome: 'none',
        'aria-label': 'Image viewer',
        children: contentSnippet,
      },
    });
    const content = container.querySelector('#real-content') as HTMLElement;
    await fireEvent.click(content);
    expect(openValue).toBe(true);
  });

  test('default chrome is unaffected: clicking the panel/body does NOT dismiss (only event.target === dialogElement does)', async () => {
    // Regression guard: the chromeless-only fallback (panel/body as
    // backdrop-equivalent) must not leak into the default chrome, where
    // clicking the panel/body is a normal part of the visible card, not a
    // backdrop click.
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
    const panel = container.querySelector('.cinder-modal__panel') as HTMLElement;
    const body = container.querySelector('.cinder-modal__body') as HTMLElement;
    await fireEvent.click(panel);
    expect(openValue).toBe(true);
    await fireEvent.click(body);
    expect(openValue).toBe(true);
  });

  test('data-cinder-modal-backdrop on a consumer full-bleed child dismisses, independent of the panel/body checks', async () => {
    // Regression: the canonical chromeless composition (see
    // chromeless.example.svelte) renders a root child that fills the body
    // (width/height 100%) — every empty-surface click's target is THAT
    // child, never the body/panel, so the panel/body fallback above never
    // fires. A consumer opts a full-bleed scrim wrapper into
    // backdrop-equivalent dismissal by marking it with
    // `data-cinder-modal-backdrop`.
    const scrimSnippet = createRawSnippet(() => ({
      render: () =>
        `<div data-cinder-modal-backdrop style="width: 100%; height: 100%;"><button type="button" id="real-content">Real content</button></div>`,
      setup: () => {},
    }));
    let openValue = true;
    const { container } = render(Modal, {
      props: {
        get open() {
          return openValue;
        },
        set open(value: boolean) {
          openValue = value;
        },
        chrome: 'none',
        'aria-label': 'Image viewer',
        children: scrimSnippet,
      },
    });
    const scrim = container.querySelector('[data-cinder-modal-backdrop]') as HTMLElement;
    await fireEvent.click(scrim);
    expect(openValue).toBe(false);
  });

  test('a click on a descendant of the data-cinder-modal-backdrop element does not dismiss', async () => {
    const scrimSnippet = createRawSnippet(() => ({
      render: () =>
        `<div data-cinder-modal-backdrop style="width: 100%; height: 100%;"><button type="button" id="real-content">Real content</button></div>`,
      setup: () => {},
    }));
    let openValue = true;
    const { container } = render(Modal, {
      props: {
        get open() {
          return openValue;
        },
        set open(value: boolean) {
          openValue = value;
        },
        chrome: 'none',
        'aria-label': 'Image viewer',
        children: scrimSnippet,
      },
    });
    const content = container.querySelector('#real-content') as HTMLElement;
    await fireEvent.click(content);
    expect(openValue).toBe(true);
  });

  test('dismissOnBackdropClick=false suppresses data-cinder-modal-backdrop dismissal too', async () => {
    const scrimSnippet = createRawSnippet(() => ({
      render: () => `<div data-cinder-modal-backdrop style="width: 100%; height: 100%;"></div>`,
      setup: () => {},
    }));
    let openValue = true;
    const { container } = render(Modal, {
      props: {
        get open() {
          return openValue;
        },
        set open(value: boolean) {
          openValue = value;
        },
        chrome: 'none',
        'aria-label': 'Image viewer',
        dismissOnBackdropClick: false,
        children: scrimSnippet,
      },
    });
    const scrim = container.querySelector('[data-cinder-modal-backdrop]') as HTMLElement;
    await fireEvent.click(scrim);
    expect(openValue).toBe(true);
  });

  test('data-cinder-modal-backdrop has no effect in the default chrome', async () => {
    // Regression guard: this marker is a chromeless-only escape hatch. A
    // consumer accidentally leaving it on content rendered in the default
    // chrome must not get surprise backdrop-equivalent dismissal there.
    const scrimSnippet = createRawSnippet(() => ({
      render: () => `<div data-cinder-modal-backdrop style="width: 100%; height: 100%;"></div>`,
      setup: () => {},
    }));
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
        children: scrimSnippet,
      },
    });
    const scrim = container.querySelector('[data-cinder-modal-backdrop]') as HTMLElement;
    await fireEvent.click(scrim);
    expect(openValue).toBe(true);
  });

  test('modal.css clears the reserved scrollbar gutter for the chromeless body', async () => {
    // Regression: the base body rule's `scrollbar-gutter: stable` reserves
    // an inline-end band on classic-scrollbar platforms even when the body
    // does not overflow. On a full-bleed chromeless surface that band
    // visibly shifts centered content (e.g. an image lightbox's photo) away
    // from true viewport center.
    const css = await Bun.file(new URL('./modal.css', import.meta.url)).text();
    expect(css).toMatch(
      /\.cinder-modal__body\[data-cinder-chrome='none'\]\s*\{[^}]*scrollbar-gutter:\s*auto;/s,
    );
  });
});

describe('Modal nameless-dialog dev warning', () => {
  let originalWarn: typeof console.warn;
  let warnings: string[];

  beforeEach(() => {
    originalWarn = console.warn;
    warnings = [];
    console.warn = (...args: unknown[]) => {
      warnings.push(args.join(' '));
    };
  });

  afterEach(() => {
    console.warn = originalWarn;
  });

  test('warns when chrome="default" renders with an empty title', () => {
    render(Modal, {
      props: { open: true, title: '', children: emptySnippet },
    });
    expect(
      warnings.some((w) => w.includes('[cinder/Modal]') && w.includes('chrome="default"')),
    ).toBe(true);
  });

  test('does not warn when chrome="default" has a non-empty title', () => {
    render(Modal, {
      props: { open: true, title: 'Confirm deletion', children: emptySnippet },
    });
    expect(warnings.some((w) => w.includes('chrome="default"'))).toBe(false);
  });

  test('warns when chrome="none" renders with an empty aria-label', () => {
    render(Modal, {
      props: { open: true, chrome: 'none', 'aria-label': '', children: emptySnippet },
    });
    expect(warnings.some((w) => w.includes('[cinder/Modal]') && w.includes('chrome="none"'))).toBe(
      true,
    );
  });

  test('does not warn when chrome="none" has a non-empty aria-label', () => {
    render(Modal, {
      props: {
        open: true,
        chrome: 'none',
        'aria-label': 'Image viewer',
        children: emptySnippet,
      },
    });
    expect(warnings.some((w) => w.includes('chrome="none"'))).toBe(false);
  });

  test('a non-string truthy title (a JS consumer bypassing TypeScript) warns instead of throwing', () => {
    // Regression: the guard used to call `.trim()` after only a truthiness
    // check, so a non-string truthy value would throw inside the $effect —
    // turning a dev-only warning into a hard crash.
    expect(() => {
      render(Modal, {
        // eslint-disable-next-line no-unsafe-type-assertion -- simulating a JS consumer bypassing the `title: string` type at runtime.
        props: {
          open: true,
          title: { not: 'a string' } as unknown as string,
          children: emptySnippet,
        },
      });
    }).not.toThrow();
    expect(
      warnings.some((w) => w.includes('[cinder/Modal]') && w.includes('chrome="default"')),
    ).toBe(true);
  });

  test('a non-string truthy aria-label in the chromeless chrome warns instead of throwing', () => {
    expect(() => {
      render(Modal, {
        props: {
          open: true,
          chrome: 'none',
          // eslint-disable-next-line no-unsafe-type-assertion -- simulating a JS consumer bypassing the `aria-label: string` type at runtime.
          'aria-label': { not: 'a string' } as unknown as string,
          children: emptySnippet,
        },
      });
    }).not.toThrow();
    expect(warnings.some((w) => w.includes('[cinder/Modal]') && w.includes('chrome="none"'))).toBe(
      true,
    );
  });
});

describe('Modal focus containment', () => {
  // The <dialog> element natively traps focus via its showModal() API in real browsers.
  // The modal also uses a `tabWrap` attachment on the panel that intercepts Tab/Shift+Tab
  // keystrokes to keep focus within the panel, providing defense-in-depth for environments
  // where the native dialog focus trap is not available (e.g. happy-dom in tests).

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

    const panel = container.querySelector('.cinder-modal__panel') as HTMLElement;
    expect(panel).not.toBeNull();

    const firstButton = container.querySelector('#inner-first') as HTMLButtonElement;
    // The close button is rendered last in DOM order, so it is the LAST tabbable.
    const closeButton = container.querySelector('.cinder-modal__close') as HTMLButtonElement;
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

    const panel = container.querySelector('.cinder-modal__panel') as HTMLElement;
    expect(panel).not.toBeNull();

    // The body container has tabindex="-1" and is not in the tabbable set.
    const firstButton = container.querySelector('#inner-first') as HTMLButtonElement;
    const closeButton = container.querySelector('.cinder-modal__close') as HTMLButtonElement;
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

    const panel = container.querySelector('.cinder-modal__panel') as HTMLElement;
    const closeButton = container.querySelector('.cinder-modal__close') as HTMLButtonElement;
    expect(closeButton).not.toBeNull();

    // Focus the only tabbable element (close button).
    closeButton.focus();

    // Tab forward should wrap (preventDefault), since close is also the first element.
    const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    panel.dispatchEvent(tabEvent);

    expect(tabEvent.defaultPrevented).toBe(true);
  });
});
