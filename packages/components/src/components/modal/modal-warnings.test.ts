/// <reference lib="dom" />
import { setupHappyDom } from '@lostgradient/testing';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { resetScrollLock } from '../../_internal/overlay.ts';
import { emptySnippet, installModalDialogStubs } from './modal-test-helpers.ts';

setupHappyDom();
installModalDialogStubs();
const { cleanup, render } = await import('@testing-library/svelte');
const { default: Modal } = await import('./modal.svelte');
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
  cleanup();
  document.body.replaceChildren();
  resetScrollLock();
  console.warn = originalWarn;
});
describe('Modal development warnings', () => {
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
      const options = {
        props: {
          open: true,
          title: '',
          children: emptySnippet,
        },
      };
      Reflect.set(options.props, 'title', { not: 'a string' });
      render(Modal, options);
    }).not.toThrow();
    expect(
      warnings.some((w) => w.includes('[cinder/Modal]') && w.includes('chrome="default"')),
    ).toBe(true);
  });
  test('a non-string truthy aria-label in the chromeless chrome warns instead of throwing', () => {
    expect(() => {
      const options = {
        props: {
          open: true,
          chrome: 'none' as const,
          'aria-label': '',
          children: emptySnippet,
        },
      };
      Reflect.set(options.props, 'aria-label', { not: 'a string' });
      render(Modal, options);
    }).not.toThrow();
    expect(warnings.some((w) => w.includes('[cinder/Modal]') && w.includes('chrome="none"'))).toBe(
      true,
    );
  });
});
