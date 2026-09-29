/// <reference lib="dom" />
import { requiredInstance, setupHappyDom } from '@lostgradient/testing';
import { afterEach, describe, expect, test } from 'bun:test';
import { keyboardNavigationSnippet } from './navigation-bar-interaction-snippet-helpers.ts';
import {
  multiControlBrandSnippet,
  normalThenPositiveNavigationSnippet,
  positiveOnlyBrandSnippet,
  positiveThenNormalBrandSnippet,
  positiveThenNormalNavigationSnippet,
  shadowBrandSnippet,
  toggleSnippet,
} from './navigation-bar-snippet-helpers.ts';
import {
  openCollapsedMobileMenu,
  waitForMobilePanelPosition,
  withResizeObserver,
} from './navigation-bar-test-helpers.ts';
setupHappyDom();
const { render, fireEvent, cleanup } = await import('@testing-library/svelte');
const { resetEscapeStack } = await import('../../_internal/overlay.ts');
const { default: NavigationBar } = await import('./navigation-bar.svelte');

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
  resetEscapeStack();
});

afterEach(() => cleanup());

describe('NavigationBar', () => {
  test('bridges brand Tab into the portaled panel when the outer nav observes a shadow-retargeted target', async () => {
    // A keydown listener on the outer `<nav>` observes `event.target`
    // retargeted to the shadow host when the real Tab origin lives inside an
    // open shadow root (e.g. a brand logo that exposes its last tabbable
    // control from its own shadow DOM). happy-dom does not implement that
    // spec retargeting natively, so this test overrides `event.target`
    // directly -- the same pattern portal.test.ts uses -- to reproduce what
    // a real browser delivers, while `composedPath()` (driven by the actual
    // dispatch target) still reports the true originating shadow element.
    await withResizeObserver(async () => {
      const { container } = render(NavigationBar, {
        brand: shadowBrandSnippet(),
        items: keyboardNavigationSnippet({}),
        menuToggle: toggleSnippet(),
        menuTogglePlacement: 'before-brand',
      });

      await openCollapsedMobileMenu(container);
      const itemsRegion = await waitForMobilePanelPosition(container);
      const home = itemsRegion.querySelector('[data-key="home"]');
      const brandHost = requiredInstance(
        container.querySelector('#brand-shadow-host'),
        HTMLElement,
      );
      const shadowButton = requiredInstance(
        brandHost.shadowRoot?.querySelector('#brand-shadow-button'),
        HTMLElement,
      );

      const event = new KeyboardEvent('keydown', {
        key: 'Tab',
        bubbles: true,
        composed: true,
        cancelable: true,
      });
      Object.defineProperty(event, 'target', { configurable: true, value: brandHost });
      shadowButton.dispatchEvent(event);

      expect(document.activeElement).toBe(home);
    });
  });

  test('brand Tab does not bridge into the portaled panel while the toggle is still ahead in native order', async () => {
    // A brand containing only a positive-tabindex control is still before
    // the default-tier toggle in native Tab order (positive tiers always
    // precede zero/default ones, regardless of DOM position). The bridge
    // must decline and leave `preventDefault()` uncalled so native Tab
    // handling can reach the toggle on its own -- happy-dom does not run
    // that native algorithm, so the observable result here is that focus
    // stays put rather than jumping to the portaled panel's first item.
    await withResizeObserver(async () => {
      const { container } = render(NavigationBar, {
        brand: positiveOnlyBrandSnippet(),
        items: keyboardNavigationSnippet({}),
        menuToggle: toggleSnippet(),
        menuTogglePlacement: 'before-brand',
      });

      await openCollapsedMobileMenu(container);
      await waitForMobilePanelPosition(container);
      const brandPositive = requiredInstance(
        container.querySelector('#brand-positive'),
        HTMLButtonElement,
      );

      brandPositive.focus();
      await fireEvent.keyDown(brandPositive, { key: 'Tab' });
      expect(document.activeElement).toBe(brandPositive);
    });
  });

  test('toggle Tab skips a positive-tabindex brand control that native order already visited', async () => {
    // Brand focus targets are sorted globally (positive tabindex first), so
    // naively taking the first one from the toggle no longer means "the
    // first stop after the toggle" once a positive-tabindex brand control
    // exists alongside a normal one.
    await withResizeObserver(async () => {
      const { container } = render(NavigationBar, {
        brand: positiveThenNormalBrandSnippet(),
        items: keyboardNavigationSnippet({}),
        menuToggle: toggleSnippet(),
        menuTogglePlacement: 'before-brand',
      });

      await openCollapsedMobileMenu(container);
      await waitForMobilePanelPosition(container);
      const toggle = requiredInstance(container.querySelector('#toggle-btn'), HTMLButtonElement);
      const brandNormal = container.querySelector('#brand-normal');

      toggle.focus();
      await fireEvent.keyDown(toggle, { key: 'Tab' });
      expect(document.activeElement).toBe(brandNormal);
    });
  });

  test('toggle Tab skips a positive-tabindex navigation item that native order already visited', async () => {
    // The items fallback used to take the globally-first (lowest positive)
    // sequential item unconditionally. When the toggle itself has a higher
    // positive tabindex, native order has already visited any lower
    // positive-tabindex item, so Tab from the toggle must continue to a
    // same/higher positive item or the first zero-tier item instead.
    await withResizeObserver(async () => {
      const { container } = render(NavigationBar, {
        items: positiveThenNormalNavigationSnippet(),
        menuToggle: toggleSnippet(),
      });

      await openCollapsedMobileMenu(container);
      const itemsRegion = await waitForMobilePanelPosition(container);
      const toggle = requiredInstance(container.querySelector('#toggle-btn'), HTMLButtonElement);
      const normalItem = requiredInstance(
        itemsRegion.querySelector('[data-key="normal"]'),
        HTMLButtonElement,
      );

      toggle.setAttribute('tabindex', '2');
      toggle.focus();
      await fireEvent.keyDown(toggle, { key: 'Tab' });
      expect(document.activeElement).toBe(normalItem);
    });
  });

  test('toggle Tab with a default tabindex lands on the first zero-tier item, not a later positive-tabindex item', async () => {
    // `getSequentialNavigationItems()` sorts positive-tabindex items first
    // globally, so the fallback used to take items[0] unconditionally and
    // land on a positive-tabindex item even when it sits later in DOM
    // order. Native forward Tab from a zero/default-tabindex toggle visits
    // zero-tier stops first — the positive item was already visited earlier
    // in native order — so the fallback must filter by the toggle's own
    // tab tier instead of taking the globally-first item.
    await withResizeObserver(async () => {
      const { container } = render(NavigationBar, {
        items: normalThenPositiveNavigationSnippet(),
        menuToggle: toggleSnippet(),
      });

      await openCollapsedMobileMenu(container);
      const itemsRegion = await waitForMobilePanelPosition(container);
      const toggle = requiredInstance(container.querySelector('#toggle-btn'), HTMLButtonElement);
      const normalItem = requiredInstance(
        itemsRegion.querySelector('[data-key="normal"]'),
        HTMLButtonElement,
      );

      toggle.focus();
      await fireEvent.keyDown(toggle, { key: 'Tab' });
      expect(document.activeElement).toBe(normalItem);
    });
  });

  test('reverse Tab from portaled items returns to the final brand control', async () => {
    await withResizeObserver(async () => {
      const { container } = render(NavigationBar, {
        brand: multiControlBrandSnippet(),
        items: keyboardNavigationSnippet({}),
        menuToggle: toggleSnippet(),
        menuTogglePlacement: 'before-brand',
      });

      await openCollapsedMobileMenu(container);
      const itemsRegion = await waitForMobilePanelPosition(container);
      const home = requiredInstance(
        itemsRegion.querySelector('[data-key="home"]'),
        HTMLButtonElement,
      );
      const finalBrandControl = container.querySelector('#brand-products');

      home.focus();
      await fireEvent.keyDown(home, { key: 'Tab', shiftKey: true });
      expect(document.activeElement).toBe(finalBrandControl);
    });
  });
});
