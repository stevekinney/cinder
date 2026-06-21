/**
 * Regression tests for image-lightbox scroll-lock integration and
 * reduced-motion behavior.
 *
 * These tests verify that the lightbox uses `createBodyScrollLock()` (the
 * counted factory that delegates to `lockBodyScroll()` in `_internal/overlay`)
 * rather than a plain `overflow: hidden` assignment that would bypass the
 * global counter and prematurely restore scroll when nested overlays close.
 *
 * They also verify the reduced-motion contract: the lightbox derives its
 * `fade` transition duration from `useReducedMotion()` so that the JS-driven
 * transition (which is NOT affected by CSS `@media (prefers-reduced-motion)`)
 * collapses to zero for users who have opted out of motion.
 */
/// <reference lib="dom" />
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { _resetScrollLock, lockBodyScroll } from '../../../_internal/overlay.ts';
import { setupHappyDom } from '../../../test/happy-dom.ts';
import { createBodyScrollLock } from '../../../utilities/attachments.ts';

const source = readFileSync(resolve(import.meta.dir, 'image-lightbox.svelte'), 'utf8');

setupHappyDom();

beforeEach(() => {
  _resetScrollLock();
});

afterEach(() => {
  _resetScrollLock();
  document.body.innerHTML = '';
});

describe('image-lightbox source contract', () => {
  test('imports createBodyScrollLock, not the legacy bodyScrollLock', () => {
    expect(source).toContain('createBodyScrollLock');
    // Assert against the legacy IDENTIFIER specifically (word boundary + lowercase b),
    // so this isn't tripped by `createBodyScrollLock` (capital B) or an incidental mention
    // in a comment. The legacy export was the bare `bodyScrollLock` symbol.
    expect(source).not.toMatch(/\bbodyScrollLock\b/);
  });

  test('attaches createBodyScrollLock() to the overlay element', () => {
    expect(source).toContain('{@attach createBodyScrollLock()}');
  });

  test('imports useReducedMotion for the JS-driven fade transition', () => {
    // The JS fade transition is not covered by CSS @media (prefers-reduced-motion),
    // so it must be handled imperatively via useReducedMotion().
    expect(source).toContain('import { useReducedMotion }');
  });

  test('derives fadeDuration from useReducedMotion to zero it under reduced-motion', () => {
    // The derived fadeDuration must collapse to 0 when reducedMotion.current is true.
    // We check the structural contract (both the derived variable and the reactive
    // conditional) rather than importing the component (which requires a full Svelte
    // render environment not available in this harness).
    expect(source).toContain('fadeDuration = $derived(reducedMotion.current ? 0 :');
  });

  test('uses fadeDuration as the transition:fade duration, not a hardcoded literal', () => {
    // Regression guard: the fade must read from fadeDuration, not a raw number.
    expect(source).toContain('transition:fade={{ duration: fadeDuration }}');
    // Ensure the original hardcoded literal is gone.
    expect(source).not.toContain('transition:fade={{ duration: 150 }}');
  });
});

describe('image-lightbox scroll-lock counter sharing', () => {
  test('a second overlay acquiring the lock keeps scroll hidden when the first releases', () => {
    // Simulate what happens when a lightbox is opened inside another locking
    // overlay (e.g. a Modal or Sheet that already holds the scroll lock).
    const releaseOuter = lockBodyScroll(); // outer overlay acquires first
    const releaseInner = createBodyScrollLock()(document.createElement('div')); // lightbox

    expect(document.body.style.overflow).toBe('hidden');

    // The outer overlay closes — scroll must stay locked because the lightbox is still open.
    releaseOuter();
    expect(document.body.style.overflow).toBe('hidden');

    // Lightbox closes — counter reaches zero; scroll restores.
    releaseInner?.();
    expect(document.body.style.overflow).toBe('');
  });

  test('lightbox lock restores scroll when it is the sole lock holder', () => {
    const release = createBodyScrollLock()(document.createElement('div'));
    expect(document.body.style.overflow).toBe('hidden');
    release?.();
    expect(document.body.style.overflow).toBe('');
  });
});
