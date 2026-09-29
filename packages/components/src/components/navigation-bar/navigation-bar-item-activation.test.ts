/// <reference lib="dom" />
import { requiredInstance, setupHappyDom } from '@lostgradient/testing';
import { afterEach, describe, expect, spyOn, test } from 'bun:test';
import {
  cancelingNavigationSnippet,
  keyboardNavigationSnippet,
} from './navigation-bar-interaction-snippet-helpers.ts';
import { actionButtonSnippet, toggleSnippet } from './navigation-bar-snippet-helpers.ts';
import {
  getItemsRegion,
  openCollapsedMobileMenu,
  setCollapsedMobileLayout,
  waitForMobilePanelPosition,
  withResizeObserver,
} from './navigation-bar-test-helpers.ts';
setupHappyDom();
const { render, fireEvent, cleanup } = await import('@testing-library/svelte');
const { resetEscapeStack } = await import('../../_internal/overlay.ts');
const { default: NavigationBar } = await import('./navigation-bar.svelte');
const { createRawSnippet } = await import('svelte');
afterEach(() => {
  cleanup();
  document.body.replaceChildren();
  resetEscapeStack();
});

afterEach(() => cleanup());

describe('NavigationBar', () => {
  test('cancelled item click keeps an open collapsed mobile menu open', async () => {
    await withResizeObserver(async () => {
      const clicks: Record<string, number> = {};
      const { container } = render(NavigationBar, {
        items: cancelingNavigationSnippet(clicks),
        menuToggle: toggleSnippet(),
      });

      await openCollapsedMobileMenu(container);

      const docs = requiredInstance(
        getItemsRegion(container).querySelector('[data-key="docs"]'),
        HTMLElement,
      );
      await fireEvent.click(docs);

      expect(clicks['docs']).toBe(1);
      expect(getItemsRegion(container).getAttribute('data-open')).toBe('true');
    });
  });

  test('Enter activation closes an open collapsed mobile menu', async () => {
    await withResizeObserver(async () => {
      const clicks: Record<string, number> = {};
      const { container } = render(NavigationBar, {
        items: keyboardNavigationSnippet(clicks),
        menuToggle: toggleSnippet(),
      });

      await openCollapsedMobileMenu(container);

      const docs = requiredInstance(
        getItemsRegion(container).querySelector('[data-key="docs"]'),
        HTMLElement,
      );
      docs.focus();
      await fireEvent.keyDown(docs, { key: 'Enter' });

      expect(clicks['docs']).toBe(1);
      expect(getItemsRegion(container).getAttribute('data-open')).toBe('false');
      expect(document.activeElement?.id).toBe('toggle-btn');
    });
  });

  test('Enter activation returns focus to the toggle when the collapsed mobile menu starts open', async () => {
    await withResizeObserver(async () => {
      const clicks: Record<string, number> = {};
      const { container } = render(NavigationBar, {
        items: keyboardNavigationSnippet(clicks),
        menuToggle: toggleSnippet(),
        mobileMenuOpen: true,
      });

      await setCollapsedMobileLayout(container);

      const docs = requiredInstance(
        getItemsRegion(container).querySelector('[data-key="docs"]'),
        HTMLElement,
      );
      docs.focus();
      await fireEvent.keyDown(docs, { key: 'Enter' });

      expect(clicks['docs']).toBe(1);
      expect(getItemsRegion(container).getAttribute('data-open')).toBe('false');
      expect(document.activeElement?.id).toBe('toggle-btn');
    });
  });

  test('Space activation closes an open collapsed mobile menu', async () => {
    await withResizeObserver(async () => {
      const clicks: Record<string, number> = {};
      const { container } = render(NavigationBar, {
        items: keyboardNavigationSnippet(clicks),
        menuToggle: toggleSnippet(),
      });

      await openCollapsedMobileMenu(container);

      const docs = requiredInstance(
        getItemsRegion(container).querySelector('[data-key="docs"]'),
        HTMLElement,
      );
      docs.focus();
      await fireEvent.keyDown(docs, { key: ' ' });

      expect(clicks['docs']).toBe(1);
      expect(getItemsRegion(container).getAttribute('data-open')).toBe('false');
    });
  });

  test('disabled item activation leaves an open collapsed mobile menu open', async () => {
    await withResizeObserver(async () => {
      const clicks: Record<string, number> = {};
      const { container } = render(NavigationBar, {
        items: keyboardNavigationSnippet(clicks),
        menuToggle: toggleSnippet(),
      });

      await openCollapsedMobileMenu(container);

      const billing = requiredInstance(
        getItemsRegion(container).querySelector('[data-key="billing"]'),
        HTMLElement,
      );
      await fireEvent.click(billing);
      billing.focus();
      await fireEvent.keyDown(billing, { key: 'Enter' });
      await fireEvent.keyDown(billing, { key: ' ' });

      expect(clicks['billing']).toBe(1);
      expect(getItemsRegion(container).getAttribute('data-open')).toBe('true');
    });
  });

  test('evaluates isEnabledNavigationItem once per item when bridging Tab out of the portaled panel (#1186 row 3)', async () => {
    // isEnabledNavigationItem is not exported, so measure its cost via the
    // global getComputedStyle calls it makes walking each item's ancestor
    // chain. Establish a per-item baseline (`perItemCost`) through an
    // isolated interaction — ArrowRight from the first item to the second —
    // which invokes isEnabledNavigationItem exactly once (the immediate
    // next item is enabled, so `focusAdjacentNavigationItem`'s loop exits on
    // its first iteration). The Tab-bridging path under test additionally
    // calls `getSequentialFocusTargets` once (a fixed, fix-independent
    // per-item cost of its own), so the discriminating comparison is the
    // MULTIPLE of `perItemCost` the bridging call consumes across N items,
    // not an exact call count.
    await withResizeObserver(async () => {
      const itemCount = 8;
      const items = Array.from(
        { length: itemCount },
        (_, index) =>
          `<button type="button" class="cinder-navigation-item" data-cinder-navigation-item data-key="item-${index}">Item ${index}</button>`,
      ).join('\n');
      const manyItemsSnippet = createRawSnippet(() => ({
        render: () => `<div>${items}</div>`,
        setup: () => {},
      }));

      const { container } = render(NavigationBar, {
        items: manyItemsSnippet,
        menuToggle: toggleSnippet(),
        actions: actionButtonSnippet(),
      });

      await openCollapsedMobileMenu(container);
      const itemsRegion = await waitForMobilePanelPosition(container);
      const firstItem = requiredInstance(
        itemsRegion.querySelector('[data-key="item-0"]'),
        HTMLButtonElement,
      );
      const secondItem = requiredInstance(
        itemsRegion.querySelector('[data-key="item-1"]'),
        HTMLButtonElement,
      );
      const lastItem = requiredInstance(
        itemsRegion.querySelector(`[data-key="item-${itemCount - 1}"]`),
        HTMLButtonElement,
      );

      firstItem.focus();
      const getComputedStyleSpy = spyOn(globalThis, 'getComputedStyle');
      await fireEvent.keyDown(firstItem, { key: 'ArrowRight' });
      expect(document.activeElement).toBe(secondItem);
      const perItemCost = getComputedStyleSpy.mock.calls.length;
      expect(perItemCost).toBeGreaterThan(0);
      getComputedStyleSpy.mockClear();

      lastItem.focus();
      await fireEvent.keyDown(lastItem, { key: 'Tab' });
      const bridgingCallCount = getComputedStyleSpy.mock.calls.length;
      getComputedStyleSpy.mockRestore();

      // Correctness: the bridge actually fired (focus left the panel).
      expect(document.activeElement).not.toBe(lastItem);

      // Pre-fix, isEnabledNavigationItem runs twice per item (once inside
      // getSequentialNavigationItems, once via the direct .filter call) on
      // top of getSequentialFocusTargets' own fixed per-item cost — measured
      // at itemCount=8 (perItemCost=6): ~198 calls pre-fix vs ~102 post-fix.
      // The threshold below sits at roughly the geometric midpoint, well
      // clear of both measured values, so it discriminates the duplication
      // without pinning an exact count.
      expect(bridgingCallCount).toBeLessThan(itemCount * perItemCost * 3);
    });
  });
});
