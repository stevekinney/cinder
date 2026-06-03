/**
 * Regression tests for image-lightbox scroll-lock integration.
 *
 * These tests verify that the lightbox uses `createBodyScrollLock()` (the
 * counted factory that delegates to `lockBodyScroll()` in `_internal/overlay`)
 * rather than a plain `overflow: hidden` assignment that would bypass the
 * global counter and prematurely restore scroll when nested overlays close.
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
    expect(source).not.toContain('bodyScrollLock');
  });

  test('attaches createBodyScrollLock() to the overlay element', () => {
    expect(source).toContain('{@attach createBodyScrollLock()}');
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
