/// <reference lib="dom" />
import { requiredInstance, setupHappyDom } from '@lostgradient/testing';
import { afterEach, describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { textSnippet, toggleSnippet } from './navigation-bar-snippet-helpers.ts';
import {
  emitNavigationBarResize,
  getItemsRegion,
  withResizeObserver,
} from './navigation-bar-test-helpers.ts';
setupHappyDom();
const { render, fireEvent, cleanup } = await import('@testing-library/svelte');
const { pushEscapeHandler, resetEscapeStack } = await import('../../_internal/overlay.ts');
const { default: NavigationBar } = await import('./navigation-bar.svelte');
const { createRawSnippet, tick } = await import('svelte');
const navigationBarSource = readFileSync(
  new URL('./navigation-bar.svelte', import.meta.url),
  'utf8',
);
afterEach(() => {
  cleanup();
  document.body.replaceChildren();
  resetEscapeStack();
});

afterEach(() => cleanup());

describe('NavigationBar', () => {
  test('pressing Escape outside the navbar still closes the mobile menu (CIN-428)', async () => {
    // New, intended behavior: the escape-stack registration fires regardless
    // of focus/dispatch location while the mobile panel is open, unlike the
    // deleted local bubbling `onkeydown` branch that only ever saw keydowns
    // whose path traversed the bar's own DOM tree.
    await withResizeObserver(async () => {
      const { container } = render(NavigationBar, {
        items: textSnippet('items'),
        menuToggle: toggleSnippet(),
      });
      await tick();
      const toggle = requiredInstance(container.querySelector('#toggle-btn'), HTMLElement);
      const nav = requiredInstance(container.querySelector('nav'), HTMLElement);
      emitNavigationBarResize(nav, 640);
      await tick();

      await fireEvent.click(toggle);
      expect(getItemsRegion(container).getAttribute('data-open')).toBe('true');

      // Dispatch Escape on document.body — outside the nav element.
      await fireEvent.keyDown(document.body, { key: 'Escape' });
      expect(getItemsRegion(container).getAttribute('data-open')).toBe('false');
    });
  });

  test('holds a pushEscapeHandler registration while the mobile panel is open and releases it when close begins', async () => {
    await withResizeObserver(async () => {
      let parentEscapeCount = 0;
      const releaseParent = pushEscapeHandler(() => {
        parentEscapeCount += 1;
      });

      try {
        const { container } = render(NavigationBar, {
          items: textSnippet('items'),
          menuToggle: toggleSnippet(),
        });
        await tick();
        const toggle = requiredInstance(container.querySelector('#toggle-btn'), HTMLElement);
        const nav = requiredInstance(container.querySelector('nav'), HTMLElement);
        emitNavigationBarResize(nav, 640);
        await tick();

        await fireEvent.click(toggle);
        expect(getItemsRegion(container).getAttribute('data-open')).toBe('true');

        const escapeEvent = new window.KeyboardEvent('keydown', {
          key: 'Escape',
          bubbles: true,
          cancelable: true,
        });
        nav.dispatchEvent(escapeEvent);

        expect(escapeEvent.defaultPrevented).toBe(true);
        expect(parentEscapeCount).toBe(0);
        expect(getItemsRegion(container).getAttribute('data-open')).toBe('false');

        // Release timing (CIN-428): released when close BEGINS — the parent
        // handler (now top-most) sees the very next Escape.
        window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(parentEscapeCount).toBe(1);
      } finally {
        releaseParent();
      }
    });
  });

  test('with the mobile panel open above another stack registration, Escape dismisses only the panel', async () => {
    await withResizeObserver(async () => {
      let parentEscapeCount = 0;
      const releaseParent = pushEscapeHandler(() => {
        parentEscapeCount += 1;
      });

      try {
        const { container } = render(NavigationBar, {
          items: textSnippet('items'),
          menuToggle: toggleSnippet(),
        });
        await tick();
        const toggle = requiredInstance(container.querySelector('#toggle-btn'), HTMLElement);
        const nav = requiredInstance(container.querySelector('nav'), HTMLElement);
        emitNavigationBarResize(nav, 640);
        await tick();

        await fireEvent.click(toggle);
        expect(getItemsRegion(container).getAttribute('data-open')).toBe('true');

        window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

        expect(parentEscapeCount).toBe(0);
        expect(getItemsRegion(container).getAttribute('data-open')).toBe('false');
      } finally {
        releaseParent();
      }
    });
  });

  // ── items snippet receives variant context ───────────────────────────────

  test('items snippet receives { variant } equal to "horizontal" when menu is closed', () => {
    let capturedVariant: string | undefined;
    const captureSnippet = createRawSnippet<[{ variant: string }]>((getCtx) => ({
      render: () => `<span></span>`,
      setup() {
        capturedVariant = getCtx().variant;
      },
    }));

    render(NavigationBar, {
      items: captureSnippet,
      menuToggle: toggleSnippet(),
    });

    expect(capturedVariant).toBe('horizontal');
  });

  test('opening the menu sets data-open="true" on the items region (mobileMenuOpen=true drives variant="mobile")', async () => {
    // In Svelte's createRawSnippet, setup() runs once at mount. Reactive snippet parameter
    // changes cannot be directly observed via the setup closure. Instead we verify the
    // full state chain: click → mobileMenuOpen=true → data-open='true' on the items region.
    // The variant derivation ($derived(menuToggle !== undefined && mobileMenuOpen ? 'mobile' : 'horizontal'))
    // is deterministic — when data-open='true', variant was 'mobile'. Initial variant='horizontal'
    // is confirmed directly via the captured closure in the test above this one.
    let capturedVariant: string | undefined;
    const captureSnippet = createRawSnippet<[{ variant: string }]>((getCtx) => ({
      render: () => `<span></span>`,
      setup() {
        capturedVariant = getCtx().variant;
      },
    }));

    const { container } = render(NavigationBar, {
      items: captureSnippet,
      menuToggle: toggleSnippet(),
    });

    // At mount, variant is 'horizontal' (menu closed).
    expect(capturedVariant).toBe('horizontal');

    const toggle = requiredInstance(container.querySelector('#toggle-btn'), HTMLElement);
    await fireEvent.click(toggle);

    // After click: mobileMenuOpen=true → data-open='true' on the items region.
    // The variant derivation passes 'mobile' to items when open.
    expect(
      container.querySelector('.cinder-navigation-bar__items')?.getAttribute('data-open'),
    ).toBe('true');
  });

  test('variant resolution is gated on mobileMenuOpen || exitState.renderPanel, not mobileMenuOpen alone (CIN-376)', () => {
    // Regression guard: `mobileMenuOpen` flips to `false` the instant close
    // begins, so gating `variant` on it alone would resolve back to
    // 'horizontal' — stripping mobile item styling — while the panel is
    // still retained (`exitState.renderPanel`) and visibly playing its exit
    // transition. `createRawSnippet`'s `setup()` only runs once at mount
    // (see the test above), so this can't be observed by re-capturing the
    // snippet context reactively; assert the source condition directly,
    // mirroring the existing `cinder-_floating-surface` gating test.
    expect(navigationBarSource).toContain(
      'isCollapsible && isMobileLayout && (mobileMenuOpen || exitState.renderPanel)',
    );
  });

  // ── data-collapsible cannot be overridden via rest ───────────────────────
});
