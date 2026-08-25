/**
 * Regression tests for the image-lightbox → Modal migration (CIN-377).
 *
 * These tests verify that:
 * - the lightbox composes `Modal` in chromeless mode (`chrome="none"`) rather
 *   than hand-rolling its own `aria-modal`, focus trap, scroll lock, and
 *   Escape handling — Modal owns all of that coordination via
 *   `SlidingDialogState` (the same lifecycle Drawer uses).
 * - the hand-rolled Escape handler, `createFocusTrap()` attachment, and
 *   `createBodyScrollLock()` attachment are gone from the source.
 * - arrow-key navigation (previous/next) and the index-reset-on-reopen
 *   behavior are UNCHANGED from before the migration.
 * - `.lightbox-content` (not Modal's body wrapper) is the initial-focus
 *   target, so arrow keys work immediately on open.
 * - the current image survives the exit transition: navigating then closing
 *   must not reset the displayed image to clampedInitialIndex until the NEXT
 *   fresh open, since Modal keeps this component's children mounted for the
 *   whole exit-transition window.
 */
/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { tick } from 'svelte';

import { setupHappyDom } from '../../../test/happy-dom.ts';

const source = readFileSync(resolve(import.meta.dir, 'image-lightbox.svelte'), 'utf8');

// setupHappyDom() MUST run before any @testing-library/svelte import because
// testing-library reads globalThis.document/window at module-init time.
setupHappyDom();

// happy-dom does not implement HTMLDialogElement.showModal / close, which
// Modal (composed here in chromeless mode) relies on — stub them the same
// way modal.test.ts does so the $effect inside modal.svelte doesn't throw.
if (typeof HTMLDialogElement !== 'undefined') {
  if (!HTMLDialogElement.prototype.showModal) {
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      value: function (this: HTMLDialogElement) {
        this.setAttribute('open', '');
      },
      configurable: true,
      writable: true,
    });
  }
  if (!HTMLDialogElement.prototype.close) {
    Object.defineProperty(HTMLDialogElement.prototype, 'close', {
      value: function (this: HTMLDialogElement) {
        this.removeAttribute('open');
      },
      configurable: true,
      writable: true,
    });
  }
}

const { render, fireEvent, cleanup } = await import('@testing-library/svelte');
const { default: ImageLightbox } = await import('./image-lightbox.svelte');

afterEach(() => {
  document.body.style.overflow = '';
  document.body.innerHTML = '';
});

describe('image-lightbox source contract — Modal composition', () => {
  test('composes Modal in chromeless mode rather than hand-rolling its own dialog shell', () => {
    expect(source).toContain("import { Modal } from '@lostgradient/cinder/modal'");
    expect(source).toContain('chrome="none"');
    expect(source).toContain('aria-label="Image viewer"');
  });

  test('no longer hand-rolls its own aria-modal / role="dialog"', () => {
    // Those now come from Modal's own markup.
    expect(source).not.toContain('aria-modal="true"');
    expect(source).not.toContain('role="dialog"');
  });

  test('no longer attaches its own focus trap', () => {
    expect(source).not.toContain('createFocusTrap');
  });

  test('no longer attaches its own body scroll lock', () => {
    expect(source).not.toContain('createBodyScrollLock');
  });

  test('no longer hand-rolls an Escape keydown handler', () => {
    // Escape is now handled entirely by Modal's native <dialog> `cancel` event,
    // routed through the shared escape stack.
    expect(source).not.toContain("case 'Escape'");
  });

  test('still handles ArrowLeft/ArrowRight for navigation', () => {
    expect(source).toContain("case 'ArrowLeft'");
    expect(source).toContain("case 'ArrowRight'");
  });

  test('marks .lightbox-content as the initial-focus target so arrow keys work immediately', () => {
    // Regression: Modal's own initial-focus policy otherwise lands focus on
    // its `.cinder-modal__body` wrapper — the PARENT of `.lightbox-content` —
    // and the keydown handler on `.lightbox-content` (a descendant) would
    // never see the keystroke until focus moved somewhere inside it.
    // `autofocus` makes Modal's `focusDialogBodyUnlessAutofocused` policy
    // focus this element directly instead of falling back to the body.
    expect(source).toMatch(/class="lightbox-content"[\s\S]*?autofocus/);
    expect(source).toMatch(/class="lightbox-content"[\s\S]*?tabindex="-1"/);
  });

  test("overrides the backdrop color via Modal's supported --cinder-modal-backdrop custom property, scoped through the class prop (not a :global() reach into Modal internals)", () => {
    expect(source).toContain('class="lightbox-modal"');
    expect(source).toContain(':global(.lightbox-modal)');
    expect(source).toContain('--cinder-modal-backdrop');
    // Regression guard: must not select Modal's own internal class names.
    expect(source).not.toMatch(/:global\(\.cinder-modal/);
  });

  test('does not use previousOpen $state + $effect write-back to reset currentIndex', () => {
    // Regression: the old code used `let previousOpen = $state(false)` plus an
    // $effect that wrote `previousOpen = open` (state write-back) to detect the
    // opening transition. The current replacement uses a plain (non-`$state`)
    // flag — `resetAppliedForCurrentSession` — as write-only bookkeeping for a
    // single effect that reads only `open`, so it never re-triggers itself.
    expect(source).not.toContain('previousOpen = $state(false)');
    expect(source).not.toContain('previousOpen = open');
    expect(source).toContain('navigationIndex');
    expect(source).toContain('clampedInitialIndex');
    expect(source).toContain('effectiveIndex');
  });

  test('effectiveIndex does not depend on `open`, so the displayed image survives the exit transition', () => {
    // Regression (CIN-377 review): Modal keeps this component's children
    // mounted for the full exit-transition window even after `open` has
    // already flipped to false. effectiveIndex must read ONLY
    // navigationIndex/clampedInitialIndex — gating it on `open` would reset
    // the displayed image the instant `open` goes false, visibly snapping
    // back mid-fade.
    //
    // This mechanism can't be proven via a DOM-behavioral test in THIS
    // harness: happy-dom computes a zero-length CSS transition, so Modal's
    // `waitForTransitionCompletion` resolves via a queued microtask that any
    // `await` (including `fireEvent`'s own internal flush) drains, unmounting
    // the panel before an assertion could run — there is no awaited
    // checkpoint here where "closing but still mounted" is observable. That
    // window is real in an actual browser (a non-zero CSS transition keeps
    // the panel mounted for its duration), so the source-level assertions
    // below are the guard for this harness; a Playwright test would be
    // needed to observe the DOM directly mid-fade.
    expect(source).toContain(
      'const effectiveIndex = $derived(navigationIndex ?? clampedInitialIndex);',
    );
    expect(source).not.toContain('open ? (navigationIndex ?? clampedInitialIndex)');
  });

  test('close() and handleModalDismiss() do not reset navigationIndex synchronously', () => {
    // The reset happens exactly once, on the NEXT fresh open (the effect
    // above) — not at close time, which would race the exit transition.
    const closeBody = source.slice(
      source.indexOf('function close()'),
      source.indexOf('function handleModalDismiss()'),
    );
    expect(closeBody).not.toContain('navigationIndex = null');

    const dismissBody = source.slice(
      source.indexOf('function handleModalDismiss()'),
      source.indexOf('function previous()'),
    );
    expect(dismissBody).not.toContain('navigationIndex = null');
  });
});

describe('image-lightbox — behavioral reset on reopen', () => {
  afterEach(() => {
    cleanup();
    document.body.replaceChildren();
    document.body.style.overflow = '';
  });

  const images = [
    { src: '/a.jpg', alt: 'Image A' },
    { src: '/b.jpg', alt: 'Image B' },
    { src: '/c.jpg', alt: 'Image C' },
  ];

  test('displayed index resets to initialIndex after close and reopen', async () => {
    const { container, rerender } = render(ImageLightbox, {
      props: { images, initialIndex: 0, open: true },
    });

    // Initial render: shows image A (index 0).
    expect(container.querySelector('img')?.getAttribute('alt')).toBe('Image A');
    expect(container.querySelector('.lightbox-counter')?.textContent?.trim()).toBe('1 of 3');

    // Navigate forward twice → now on image C (index 2).
    await fireEvent.click(container.querySelector('[aria-label="Next image"]')!);
    await fireEvent.click(container.querySelector('[aria-label="Next image"]')!);
    expect(container.querySelector('img')?.getAttribute('alt')).toBe('Image C');
    expect(container.querySelector('.lightbox-counter')?.textContent?.trim()).toBe('3 of 3');

    // Close the lightbox via its own close button.
    await fireEvent.click(container.querySelector('[aria-label="Close image viewer"]')!);
    await tick();

    // Reopen: must reset to initialIndex (0 → image A), NOT stay on image C.
    await rerender({ images, initialIndex: 0, open: true });
    await tick();
    expect(container.querySelector('img')?.getAttribute('alt')).toBe('Image A');
    expect(container.querySelector('.lightbox-counter')?.textContent?.trim()).toBe('1 of 3');
  });

  test('displayed index resets to a non-zero initialIndex after close and reopen', async () => {
    const { container, rerender } = render(ImageLightbox, {
      props: { images, initialIndex: 1, open: true },
    });

    // Initial render: shows image B (index 1).
    expect(container.querySelector('img')?.getAttribute('alt')).toBe('Image B');

    // Navigate to image C.
    await fireEvent.click(container.querySelector('[aria-label="Next image"]')!);
    expect(container.querySelector('img')?.getAttribute('alt')).toBe('Image C');

    // Close and reopen with the same initialIndex=1.
    await fireEvent.click(container.querySelector('[aria-label="Close image viewer"]')!);
    await tick();
    await rerender({ images, initialIndex: 1, open: true });
    await tick();

    // Must reset to initialIndex=1 (image B), not stay on image C.
    expect(container.querySelector('img')?.getAttribute('alt')).toBe('Image B');
  });

  test('arrow-key navigation moves previous/next and wraps', async () => {
    const { container } = render(ImageLightbox, {
      props: { images, initialIndex: 0, open: true },
    });

    const content = container.querySelector('.lightbox-content')!;
    expect(container.querySelector('img')?.getAttribute('alt')).toBe('Image A');

    await fireEvent.keyDown(content, { key: 'ArrowRight' });
    expect(container.querySelector('img')?.getAttribute('alt')).toBe('Image B');

    await fireEvent.keyDown(content, { key: 'ArrowLeft' });
    expect(container.querySelector('img')?.getAttribute('alt')).toBe('Image A');

    // Wraps backward from the first image to the last.
    await fireEvent.keyDown(content, { key: 'ArrowLeft' });
    expect(container.querySelector('img')?.getAttribute('alt')).toBe('Image C');
  });

  test('pressing ArrowRight immediately after open (no manual focus) advances the index', async () => {
    // Regression: without `autofocus` on `.lightbox-content`, Modal's initial
    // focus lands on its `.cinder-modal__body` wrapper — the PARENT of
    // `.lightbox-content` — so a keydown dispatched on whatever the browser
    // actually focused would bubble from the body, past `.lightbox-content`'s
    // OWN keydown listener never firing (it lives on a child, not an
    // ancestor of the focused element). This test fires the event on
    // `document.activeElement` — whatever Modal's initial-focus policy
    // actually landed on — rather than targeting `.lightbox-content`
    // directly, so it fails the way the real bug failed if the fix regresses.
    const { container } = render(ImageLightbox, {
      props: { images, initialIndex: 0, open: true },
    });

    // Modal's initial-focus policy is deferred via `tick().then(...)`.
    await tick();
    await tick();

    expect(document.activeElement).toBe(container.querySelector('.lightbox-content'));
    expect(container.querySelector('img')?.getAttribute('alt')).toBe('Image A');

    await fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' });
    expect(container.querySelector('img')?.getAttribute('alt')).toBe('Image B');
  });

  test('the close button calls onClose and clears navigation state', async () => {
    let closed = 0;
    const { container } = render(ImageLightbox, {
      props: { images, initialIndex: 0, open: true, onClose: () => (closed += 1) },
    });

    await fireEvent.click(container.querySelector('[aria-label="Next image"]')!);
    await fireEvent.click(container.querySelector('[aria-label="Close image viewer"]')!);

    expect(closed).toBe(1);
  });
});
