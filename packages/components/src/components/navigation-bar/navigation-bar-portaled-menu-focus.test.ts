/// <reference lib="dom" />
import { requiredInstance, setupHappyDom } from '@lostgradient/testing';
import { afterEach, describe, expect, test } from 'bun:test';
import { keyboardNavigationSnippet } from './navigation-bar-interaction-snippet-helpers.ts';
import {
  actionButtonSnippet,
  allExcludedNavigationSnippet,
  brandLinkSnippet,
  disabledFirstNavigationSnippet,
  inlineControlBeforeNegativeNavigationSnippet,
  negativeFirstNavigationSnippet,
  svgBrandSnippet,
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
const { tick } = await import('svelte');
afterEach(() => {
  cleanup();
  document.body.replaceChildren();
  resetEscapeStack();
});

afterEach(() => cleanup());

describe('NavigationBar', () => {
  test('forward Tab from the final sequential inline control reaches actions', async () => {
    await withResizeObserver(async () => {
      const { container } = render(NavigationBar, {
        items: inlineControlBeforeNegativeNavigationSnippet(),
        menuToggle: toggleSnippet(),
        actions: actionButtonSnippet(),
      });

      await openCollapsedMobileMenu(container);
      const itemsRegion = await waitForMobilePanelPosition(container);
      const toggle = requiredInstance(container.querySelector('#toggle-btn'), HTMLButtonElement);
      const enabledItem = requiredInstance(
        itemsRegion.querySelector('[data-key="enabled"]'),
        HTMLButtonElement,
      );
      const inlineControl = requiredInstance(
        itemsRegion.querySelector('#inline-control'),
        HTMLButtonElement,
      );
      const skippedItem = requiredInstance(
        itemsRegion.querySelector('[data-key="skipped"]'),
        HTMLButtonElement,
      );
      const accountAction = requiredInstance(
        container.querySelector('#nav-action'),
        HTMLButtonElement,
      );

      toggle.focus();
      await fireEvent.keyDown(toggle, { key: 'Tab' });
      expect(document.activeElement).toBe(enabledItem);

      inlineControl.focus();
      await fireEvent.keyDown(inlineControl, { key: 'Tab' });
      expect(document.activeElement).toBe(accountAction);
      expect(document.activeElement).not.toBe(skippedItem);
    });
  });

  test('pending toggle Tab advances to actions when no navigation item is sequentially focusable', async () => {
    await withResizeObserver(async () => {
      const { container } = render(NavigationBar, {
        items: allExcludedNavigationSnippet(),
        menuToggle: toggleSnippet(),
        actions: actionButtonSnippet(),
      });

      await openCollapsedMobileMenu(container);
      const toggle = requiredInstance(container.querySelector('#toggle-btn'), HTMLButtonElement);
      const accountAction = requiredInstance(
        container.querySelector('#nav-action'),
        HTMLButtonElement,
      );

      toggle.focus();
      await fireEvent.keyDown(toggle, { key: 'Tab' });
      await waitForMobilePanelPosition(container);
      await tick();
      expect(document.activeElement).toBe(accountAction);
    });
  });

  test('toggle Tab skips disabled navigation items', async () => {
    await withResizeObserver(async () => {
      const { container } = render(NavigationBar, {
        items: disabledFirstNavigationSnippet(),
        menuToggle: toggleSnippet(),
      });

      await openCollapsedMobileMenu(container);
      const itemsRegion = await waitForMobilePanelPosition(container);
      const toggle = requiredInstance(container.querySelector('#toggle-btn'), HTMLButtonElement);
      const enabledItem = itemsRegion.querySelector('[data-key="enabled"]');

      toggle.focus();
      await fireEvent.keyDown(toggle, { key: 'Tab' });
      expect(document.activeElement).toBe(enabledItem);
    });
  });

  test('toggle Tab skips enabled navigation items removed from sequential tab order', async () => {
    await withResizeObserver(async () => {
      const { container } = render(NavigationBar, {
        items: negativeFirstNavigationSnippet(),
        menuToggle: toggleSnippet(),
      });

      await openCollapsedMobileMenu(container);
      const itemsRegion = await waitForMobilePanelPosition(container);
      const toggle = requiredInstance(container.querySelector('#toggle-btn'), HTMLButtonElement);
      const enabledItem = itemsRegion.querySelector('[data-key="enabled"]');

      toggle.focus();
      await fireEvent.keyDown(toggle, { key: 'Tab' });
      expect(document.activeElement).toBe(enabledItem);
    });
  });

  test('toggle Tab preserves a focusable brand before the portaled items', async () => {
    await withResizeObserver(async () => {
      const { container } = render(NavigationBar, {
        brand: brandLinkSnippet(),
        items: keyboardNavigationSnippet({}),
        menuToggle: toggleSnippet(),
        menuTogglePlacement: 'before-brand',
      });

      await openCollapsedMobileMenu(container);
      await waitForMobilePanelPosition(container);
      const toggle = requiredInstance(container.querySelector('#toggle-btn'), HTMLButtonElement);
      const brandLink = container.querySelector('#brand-link');

      toggle.focus();
      await fireEvent.keyDown(toggle, { key: 'Tab' });
      expect(document.activeElement).toBe(brandLink);
    });
  });

  test('pending toggle Tab preserves a focusable brand before the portaled items', async () => {
    await withResizeObserver(async () => {
      const { container } = render(NavigationBar, {
        brand: brandLinkSnippet(),
        items: keyboardNavigationSnippet({}),
        menuToggle: toggleSnippet(),
        menuTogglePlacement: 'before-brand',
      });

      await openCollapsedMobileMenu(container);
      const toggle = requiredInstance(container.querySelector('#toggle-btn'), HTMLButtonElement);
      const brandLink = container.querySelector('#brand-link');

      toggle.focus();
      await fireEvent.keyDown(toggle, { key: 'Tab' });
      await waitForMobilePanelPosition(container);
      await tick();
      expect(document.activeElement).toBe(brandLink);
    });
  });

  test('brand Tab enters the portaled items after a before-brand toggle', async () => {
    await withResizeObserver(async () => {
      const { container } = render(NavigationBar, {
        brand: brandLinkSnippet(),
        items: keyboardNavigationSnippet({}),
        menuToggle: toggleSnippet(),
        menuTogglePlacement: 'before-brand',
      });

      await openCollapsedMobileMenu(container);
      const itemsRegion = await waitForMobilePanelPosition(container);
      const brandLink = requiredInstance(container.querySelector('#brand-link'), HTMLAnchorElement);
      const home = itemsRegion.querySelector('[data-key="home"]');

      brandLink.focus();
      await fireEvent.keyDown(brandLink, { key: 'Tab' });
      expect(document.activeElement).toBe(home);
    });
  });

  test('brand Tab enters the portaled items from a focusable SVG brand target', async () => {
    // `bridgeBrandTabToPortaledPanel` must accept an SVG `event.target`, not
    // just HTMLElement, now that brand focus targets can be SVG elements
    // (e.g. an inline logo with an explicit tabindex).
    await withResizeObserver(async () => {
      const { container } = render(NavigationBar, {
        brand: svgBrandSnippet(),
        items: keyboardNavigationSnippet({}),
        menuToggle: toggleSnippet(),
        menuTogglePlacement: 'before-brand',
      });

      await openCollapsedMobileMenu(container);
      const itemsRegion = await waitForMobilePanelPosition(container);
      const brandSvg = requiredInstance(container.querySelector('#brand-svg'), SVGElement);
      const home = itemsRegion.querySelector('[data-key="home"]');

      // Dispatch directly on the SVG rather than focusing it first: this
      // exercises `event.target`, which is what the bridge guard checks,
      // independent of whether the DOM harness supports focusing SVG.
      await fireEvent.keyDown(brandSvg, { key: 'Tab' });
      expect(document.activeElement).toBe(home);
    });
  });
});
