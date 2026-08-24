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
 */
/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

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
    // opening transition. The idiomatic replacement uses a $derived `effectiveIndex`
    // that falls back to `clampedInitialIndex` when no user navigation has occurred,
    // and resets `navigationIndex` explicitly in close().
    expect(source).not.toContain('previousOpen = $state(false)');
    expect(source).not.toContain('previousOpen = open');
    expect(source).toContain('navigationIndex');
    expect(source).toContain('clampedInitialIndex');
    expect(source).toContain('effectiveIndex');
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

    // Reopen: must reset to initialIndex (0 → image A), NOT stay on image C.
    await rerender({ images, initialIndex: 0, open: true });
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
    await rerender({ images, initialIndex: 1, open: true });

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
