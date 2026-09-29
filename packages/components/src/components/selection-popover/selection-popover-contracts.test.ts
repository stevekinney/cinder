/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { requiredInstance, setupHappyDom } from '@lostgradient/testing';
import { stripCinderComponentsLayer } from '../../test/css.ts';

setupHappyDom();

const { cleanup, fireEvent, render, screen, waitFor } = await import('@testing-library/svelte');
const { default: SelectionPopover } = await import('./selection-popover.svelte');
const { default: RuntimeSelectionPopover } =
  await import('./selection-popover-javascript-consumer.svelte');
const { resetEscapeStack } = await import('../../_internal/overlay.ts');

afterEach(() => {
  cleanup();
  resetEscapeStack();
});

async function readSelectionPopoverCss(): Promise<string> {
  // Strip the @layer wrapper: happy-dom does not apply layer-nested rules to
  // getComputedStyle, so string-extraction assertions read the raw source
  // instead of relying on the cascade.
  return stripCinderComponentsLayer(
    await Bun.file(new URL('./selection-popover.css', import.meta.url)).text(),
  );
}

describe('SelectionPopover', () => {
  test('survives the drag-select gesture that opened it, even when the browser autoscrolls mid-drag', async () => {
    // Regression test for issue E: SelectionPopover dismissed itself
    // immediately after opening. The real mechanism is that a drag-select
    // gesture reaching the viewport edge triggers the browser's native
    // autoscroll-while-selecting behavior — confirmed with a real Chromium
    // Playwright repro (packages/testing/tests/selection-popover-drag-
    // dismissal.playwright.ts) — which fires real `scroll` events on
    // `window` WHILE the pointer button is still held, i.e. as part of the
    // very selection gesture that is opening this popover. This test
    // reproduces that exact event sequence — pointerdown, scroll bursts
    // while held, pointerup — mirroring the consumer wiring in
    // selection-popover.examples.json (open flips true via selectionchange
    // mid-drag), and asserts the popover does not self-dismiss.
    let closed = false;

    const { rerender } = render(SelectionPopover, {
      props: {
        id: 'selection-comment',
        open: false,
        position: { x: 120, y: 80 },
        onClose: () => {
          closed = true;
        },
      },
    });

    // The pointer goes down to begin the drag-select — this happens BEFORE
    // the popover opens, exactly like a real drag-select: pointer tracking
    // must already be live at mount, not start only once the popover opens.
    await fireEvent.pointerDown(window);

    // Partway through the drag, the consumer's selectionchange handler sees
    // a non-collapsed selection and opens the popover (this is the false ->
    // true transition selection-popover.examples.json performs).
    await rerender({
      open: true,
      position: { x: 120, y: 80 },
      onClose: () => {
        closed = true;
      },
    });

    // The drag continues toward the viewport edge; the browser autoscrolls,
    // firing a burst of real `scroll` events while the pointer is still down.
    await fireEvent.scroll(window);
    await fireEvent.scroll(window);
    await fireEvent.scroll(window);

    expect(closed).toBe(false);
    expect(screen.getByRole('toolbar', { name: 'Selection actions' })).not.toBeNull();

    // The gesture ends.
    await fireEvent.pointerUp(window);
    expect(closed).toBe(false);

    // A later, genuinely external scroll (the user scrolling away after the
    // selection is done) must still dismiss normally.
    await fireEvent.scroll(window);
    expect(closed).toBe(true);
  });

  test('movement dismissal restores focus without scrolling the prior focus owner', async () => {
    const trigger = document.createElement('button');
    trigger.textContent = 'Open selection actions';
    document.body.append(trigger);
    trigger.focus();

    let focusOptions: FocusOptions | undefined;
    trigger.focus = (options?: FocusOptions) => {
      focusOptions = options;
    };

    const { rerender } = render(SelectionPopover, {
      props: {
        id: 'selection-comment',
        open: false,
        position: { x: 120, y: 80 },
      },
    });

    await rerender({ open: true, position: { x: 120, y: 80 } });
    // Move focus onto the collapsed action first — the realistic sequence, and
    // the one that leaves something to restore. The resulting `focusin` targets
    // a node inside the panel, so the virtual-keyboard listener early-returns
    // and the remembered pre-open owner survives.
    screen.getByRole('button', { name: 'Add comment' }).focus();
    await fireEvent.scroll(window);

    expect(focusOptions).toEqual({ preventScroll: true });
    trigger.remove();
  });

  test('a consumer-passed inert=false cannot defeat the closing-state inert/aria-hidden (CIN-376)', async () => {
    // Regression guard: {...rest} used to trail every internal attribute, so
    // a consumer's own `inert`/`aria-hidden` prop would win over the
    // component-owned closing semantics. These two are lifecycle state the
    // component owns, not something a consumer prop should be able to cancel.
    //
    // Stub a real (non-zero) transition duration so `waitForTransitionCompletion`
    // takes its transitionend-listening path instead of resolving on the next
    // microtask — this is the only way to observe the intermediate
    // "closing but still mounted" state before `await rerender` itself
    // yields the microtask queue.
    const originalGetComputedStyle = window.getComputedStyle.bind(window);
    window.getComputedStyle = (target: Element) => {
      if (target instanceof HTMLElement && target.classList.contains('cinder-selection-popover')) {
        const transitionStyle = document.createElement('div').style;
        transitionStyle.transitionProperty = 'opacity, scale';
        transitionStyle.transitionDuration = '80ms, 80ms';
        transitionStyle.transitionDelay = '0ms, 0ms';
        return transitionStyle;
      }
      return originalGetComputedStyle(target);
    };

    try {
      const { rerender } = render(RuntimeSelectionPopover, {
        props: {
          id: 'selection-comment',
          open: true,
          position: { x: 120, y: 80 },
          inert: false,
          'aria-hidden': 'false',
        },
      });

      const toolbar = requiredInstance(
        document.querySelector('.cinder-selection-popover'),
        HTMLElement,
      );
      expect(toolbar.hasAttribute('inert')).toBe(false);

      await rerender({
        open: false,
        position: null,
        inert: false,
        'aria-hidden': 'false',
      });

      expect(toolbar.hasAttribute('inert')).toBe(true);
      expect(toolbar.getAttribute('aria-hidden')).toBe('true');
    } finally {
      window.getComputedStyle = originalGetComputedStyle;
    }
  });

  test('the retained anchor rect stays stable after position clears (CIN-376)', async () => {
    // Regression guard: the snapshot used to copy `virtualAnchor`'s wrapper
    // object, whose `getBoundingClientRect` closure reads `position.x`/`.y`
    // live — so once `position` went `null`, the "frozen" anchor's rect
    // would actually read through to the now-null `position` instead of
    // staying at its last real coordinates.
    const originalGetComputedStyle = window.getComputedStyle.bind(window);
    window.getComputedStyle = (target: Element) => {
      if (target instanceof HTMLElement && target.classList.contains('cinder-selection-popover')) {
        const transitionStyle = document.createElement('div').style;
        transitionStyle.transitionProperty = 'opacity, scale';
        transitionStyle.transitionDuration = '80ms, 80ms';
        transitionStyle.transitionDelay = '0ms, 0ms';
        return transitionStyle;
      }
      return originalGetComputedStyle(target);
    };

    try {
      const { rerender } = render(SelectionPopover, {
        props: {
          id: 'selection-comment',
          open: true,
          position: { x: 120, y: 80, height: 20 },
        },
      });

      const toolbar = requiredInstance(
        document.querySelector('.cinder-selection-popover'),
        HTMLElement,
      );
      await waitFor(() => {
        expect(toolbar.getAttribute('data-cinder-position-ready')).toBe('true');
      });
      const styleBeforeClose = toolbar.getAttribute('style');
      expect(styleBeforeClose).toBeTruthy();

      await rerender({ open: false, position: null });

      // Still mid-exit (the stubbed 80ms transition hasn't fired
      // `transitionend` yet).
      expect(toolbar.hasAttribute('data-cinder-closing')).toBe(true);

      // `anchoredOverlay`'s `open()` gate is keyed off `exitState.renderPanel`
      // (already `true` in this same render, unlike `isClosing` which only
      // flips in a later `$effect`), so it never takes its `!open()` reset
      // branch, and `virtualAnchor` now returns the exact same object
      // reference across this transition (see its own definition) instead of
      // switching to a differently-constructed snapshot. A narrower gap
      // remains even so: `open()`'s closure also reads `isPositionedOpen`,
      // a `$derived` that DOES recompute when `position`/`open` change —
      // Svelte still reruns `anchored-overlay.svelte.ts`'s positioning
      // effect whenever any of its tracked reads is invalidated, regardless
      // of whether the closure's overall boolean/anchor OUTPUT stayed the
      // same, so it still tears down and rebuilds once. Poll for it to
      // settle, then assert it converges back to the exact pre-close rect
      // (not an unpositioned fallback) — this is what "doesn't jump
      // mid-fade" means in practice: a live read through to the now-null
      // `position` would instead settle on `left: 0px; top: 0px;` (or an
      // empty style), never the original coordinates.
      await waitFor(() => {
        expect(toolbar.getAttribute('style')).toBe(styleBeforeClose);
      });
    } finally {
      window.getComputedStyle = originalGetComputedStyle;
    }
  });

  test('stays hidden from the tab order until positioning is ready, exempting the closing state (CIN-376)', async () => {
    // Regression guard: `data-cinder-visible` (driven by
    // `exitState.renderPanel`) turns on as soon as the panel starts opening —
    // BEFORE Floating UI has set `data-cinder-position-ready='true'`. Gating
    // `visibility` on `data-cinder-visible` alone (as an earlier revision of
    // this migration did) removed the old `visibility: hidden` protection
    // during that positioning window: the toolbar stayed opacity:0/
    // pointer-events:none, but its buttons were still keyboard-focusable and
    // exposed to assistive technology. An initially-open SSR render has the
    // same invisible-interactive gap for the same reason. `[data-cinder-closing]`
    // is exempted so the retained exit stays visible even if it happens to
    // race positioning.
    const css = await readSelectionPopoverCss();
    expect(css).toMatch(
      /\.cinder-selection-popover:not\(\[data-cinder-position-ready='true'\]\):not\(\[data-cinder-closing\]\)\s*\{\s*visibility:\s*hidden;/,
    );

    // Behavioral half: before Floating UI resolves, `data-cinder-visible` is
    // already present (renderPanel mirrors `open` immediately) while
    // `data-cinder-position-ready` is still `'false'` and the panel isn't
    // closing — exactly the state the CSS rule above must key off instead of
    // `data-cinder-visible` alone.
    render(SelectionPopover, {
      props: {
        id: 'selection-comment',
        open: true,
        position: { x: 120, y: 80 },
      },
    });

    const toolbar = requiredInstance(
      document.querySelector('.cinder-selection-popover'),
      HTMLElement,
    );
    expect(toolbar.getAttribute('data-cinder-visible')).toBe('');
    expect(toolbar.getAttribute('data-cinder-position-ready')).toBe('false');
    expect(toolbar.hasAttribute('data-cinder-closing')).toBe(false);
  });
});
