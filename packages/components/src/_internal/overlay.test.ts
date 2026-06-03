/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../test/happy-dom.ts';

setupHappyDom();

const {
  Z_LAYERS,
  pushEscapeHandler,
  _resetEscapeStack,
  lockBodyScroll,
  _resetScrollLock,
  captureFocus,
} = await import('./overlay.ts');

afterEach(() => {
  _resetEscapeStack();
  _resetScrollLock();
});

describe('Z_LAYERS', () => {
  test('layers are ordered tooltip < dropdown/popover < backdrop < modal/sheet < toast', () => {
    expect(Z_LAYERS.tooltip).toBeLessThan(Z_LAYERS.dropdown);
    expect(Z_LAYERS.dropdown).toBe(Z_LAYERS.popover);
    expect(Z_LAYERS.popover).toBeLessThan(Z_LAYERS.backdrop);
    expect(Z_LAYERS.backdrop).toBeLessThan(Z_LAYERS.modal);
    expect(Z_LAYERS.modal).toBe(Z_LAYERS.sheet);
    expect(Z_LAYERS.sheet).toBeLessThan(Z_LAYERS.toast);
  });
});

describe('escape stack', () => {
  test('top-most handler runs on Escape; others are skipped', () => {
    const calls: string[] = [];
    const releaseA = pushEscapeHandler(() => calls.push('A'));
    const releaseB = pushEscapeHandler(() => calls.push('B'));

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(calls).toEqual(['B']);

    releaseB();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(calls).toEqual(['B', 'A']);

    releaseA();

    // After all handlers released, ESC is a no-op (and the global listener was removed).
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(calls).toEqual(['B', 'A']);
  });

  test('release is idempotent', () => {
    const release = pushEscapeHandler(() => {});
    release();
    release();
    // No throw, no side effect — pass.
    expect(true).toBe(true);
  });

  test('non-Escape keys do not invoke handlers', () => {
    const calls: string[] = [];
    pushEscapeHandler(() => calls.push('hit'));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(calls).toEqual([]);
  });
});

describe('body scroll lock', () => {
  test('first acquire locks; final release restores', () => {
    document.body.style.overflow = 'auto';
    const release = lockBodyScroll();
    expect(document.body.style.overflow).toBe('hidden');
    release();
    expect(document.body.style.overflow).toBe('auto');
  });

  test('counted nesting: lock holds until last release', () => {
    document.body.style.overflow = '';
    const r1 = lockBodyScroll();
    const r2 = lockBodyScroll();
    expect(document.body.style.overflow).toBe('hidden');
    r1();
    expect(document.body.style.overflow).toBe('hidden');
    r2();
    expect(document.body.style.overflow).toBe('');
  });

  test('release is idempotent', () => {
    const release = lockBodyScroll();
    release();
    release();
    expect(document.body.style.overflow).toBe('');
  });
});

describe('focus capture/restore', () => {
  test('captureFocus returns the active element when one is focused', () => {
    const button = document.createElement('button');
    document.body.appendChild(button);
    button.focus();

    const captured = captureFocus();
    expect(captured).toBe(button);

    button.remove();
  });

  test('captureFocus returns null when focus is on the body', () => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    expect(captureFocus()).toBeNull();
  });
});
