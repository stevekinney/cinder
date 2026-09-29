/// <reference lib="dom" />
import { requiredInstance, setupHappyDom } from '@lostgradient/testing';
import { afterEach, describe, expect, test } from 'bun:test';
import {
  actionButtonSnippet,
  glyphToggleSnippet,
  inlineControlBeforeNegativeNavigationSnippet,
  textSnippet,
  toggleSnippet,
} from './navigation-bar-snippet-helpers.ts';
import {
  emitNavigationBarResize,
  getItemsRegion,
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
  test('menu toggle can render before the brand', () => {
    const { container } = render(NavigationBar, {
      items: textSnippet('items'),
      brand: textSnippet('Acme'),
      menuToggle: toggleSnippet(),
      menuTogglePlacement: 'before-brand',
    });
    const nav = container.querySelector('nav');
    const brand = container.querySelector('.cinder-navigation-bar__brand');
    const toggle = container.querySelector('.cinder-navigation-bar__menu-toggle');

    expect(nav?.getAttribute('data-cinder-menu-toggle-placement')).toBe('before-brand');
    expect(toggle?.nextElementSibling).toBe(brand);
  });

  test('menu toggle placement data attribute cannot be clobbered by rest props', () => {
    const { container } = render(NavigationBar, {
      items: textSnippet('items'),
      menuToggle: toggleSnippet(),
      menuTogglePlacement: 'before-brand',
      'data-cinder-menu-toggle-placement': 'after-brand',
    });

    expect(container.querySelector('nav')?.getAttribute('data-cinder-menu-toggle-placement')).toBe(
      'before-brand',
    );
  });

  test('menu toggle can hide a decorative glyph from assistive technology', () => {
    const { container } = render(NavigationBar, {
      items: textSnippet('items'),
      menuToggle: glyphToggleSnippet(),
    });
    const toggle = container.querySelector('#toggle-glyph-btn');
    const glyph = toggle?.querySelector('span');

    expect(toggle?.getAttribute('aria-label')).toBe('Open menu');
    expect(toggle?.textContent?.trim()).toBe('☰');
    expect(glyph?.getAttribute('aria-hidden')).toBe('true');
  });

  test('a glyph toggle click opens the mobile menu and Tab from it enters the panel', async () => {
    // glyphToggleSnippet wires its own click/keydown listeners in its
    // `setup()` (see navigation-bar-snippet-helpers.ts), separately from
    // toggleSnippet's — this exercises that copy of the wiring rather than
    // relying on toggleSnippet's coverage to stand in for it.
    await withResizeObserver(async () => {
      const { container } = render(NavigationBar, {
        items: inlineControlBeforeNegativeNavigationSnippet(),
        menuToggle: glyphToggleSnippet(),
        actions: actionButtonSnippet(),
      });
      await tick();
      const nav = requiredInstance(container.querySelector('nav'), HTMLElement);
      const toggle = requiredInstance(
        container.querySelector('#toggle-glyph-btn'),
        HTMLButtonElement,
      );

      emitNavigationBarResize(nav, 640);
      await tick();

      await fireEvent.click(toggle);
      expect(getItemsRegion(container).getAttribute('data-open')).toBe('true');

      const itemsRegion = await waitForMobilePanelPosition(container);
      const enabledItem = requiredInstance(
        itemsRegion.querySelector('[data-key="enabled"]'),
        HTMLButtonElement,
      );

      toggle.focus();
      await fireEvent.keyDown(toggle, { key: 'Tab' });
      expect(document.activeElement).toBe(enabledItem);
    });
  });

  test('aria-controls value equals the items region id', () => {
    const { container } = render(NavigationBar, {
      items: textSnippet('items'),
      menuToggle: toggleSnippet(),
    });
    const toggle = container.querySelector('#toggle-btn');
    const itemsRegion = container.querySelector('.cinder-navigation-bar__items');
    expect(toggle?.getAttribute('aria-controls')).toBe(itemsRegion?.getAttribute('id'));
  });

  test('clicking the toggle sets data-open="true" on the items region', async () => {
    const { container } = render(NavigationBar, {
      items: textSnippet('items'),
      menuToggle: toggleSnippet(),
    });
    const toggle = requiredInstance(container.querySelector('#toggle-btn'), HTMLElement);
    await fireEvent.click(toggle);
    const itemsRegion = container.querySelector('.cinder-navigation-bar__items');
    expect(itemsRegion?.getAttribute('data-open')).toBe('true');
    expect(itemsRegion).not.toBeNull();
    expect(itemsRegion?.hasAttribute('inert')).toBe(false);
  });

  test('keeps the floating-surface chrome class through the exit transition (CIN-376)', async () => {
    // Regression guard: gating `cinder-_floating-surface` purely on the live
    // `mobileMenuOpen` bindable dropped the class (and with it, the surface's
    // border/radius/shadow) the instant the toggle closed — before the
    // 200ms exit transition had even started.
    const originalGetComputedStyle = window.getComputedStyle.bind(window);
    window.getComputedStyle = (target: Element) => {
      if (
        target instanceof HTMLElement &&
        target.classList.contains('cinder-navigation-bar__items')
      ) {
        const computedStyle = originalGetComputedStyle(target);
        return new Proxy(computedStyle, {
          get(style, property, receiver) {
            if (property === 'transitionProperty') return 'opacity, transform';
            if (property === 'transitionDuration') return '80ms, 80ms';
            if (property === 'transitionDelay') return '0ms, 0ms';
            return Reflect.get(style, property, receiver);
          },
        });
      }
      return originalGetComputedStyle(target);
    };

    try {
      await withResizeObserver(async () => {
        const { container } = render(NavigationBar, {
          items: textSnippet('items'),
          menuToggle: toggleSnippet(),
        });

        const nav = await openCollapsedMobileMenu(container);
        const itemsRegion = getItemsRegion(container);
        expect(itemsRegion.classList.contains('cinder-_floating-surface')).toBe(true);

        const toggle = requiredInstance(nav.querySelector('#toggle-btn'), HTMLElement);
        await fireEvent.click(toggle);

        const closingRegion = getItemsRegion(container);
        expect(closingRegion.hasAttribute('data-cinder-closing')).toBe(true);
        expect(closingRegion.classList.contains('cinder-_floating-surface')).toBe(true);
      });
    } finally {
      window.getComputedStyle = originalGetComputedStyle;
    }
  });

  test('keeps the mobile panel portaled through the exit transition (CIN-376)', async () => {
    // Regression guard: `itemsPortalScope`'s `disabled` flag used to key off
    // the live `mobileMenuOpen` bindable alone. Inside a transformed (or
    // otherwise containing-block-forming) ancestor, disabling the portal the
    // instant close begins moves the panel back inline while
    // `anchoredItems` keeps writing viewport-relative fixed `top`/`left`
    // coordinates for the rest of the exit (`exitState.isClosing`) — those
    // coordinates are then interpreted in the ancestor's coordinate system,
    // making the panel jump during the exit. The portal must stay attached
    // to `document.body` for as long as the panel is retained
    // (`exitState.renderPanel`), not just while `mobileMenuOpen` is live.
    const originalGetComputedStyle = window.getComputedStyle.bind(window);
    window.getComputedStyle = (target: Element) => {
      if (
        target instanceof HTMLElement &&
        target.classList.contains('cinder-navigation-bar__items')
      ) {
        const computedStyle = originalGetComputedStyle(target);
        return new Proxy(computedStyle, {
          get(style, property, receiver) {
            if (property === 'transitionProperty') return 'opacity, transform';
            if (property === 'transitionDuration') return '80ms, 80ms';
            if (property === 'transitionDelay') return '0ms, 0ms';
            return Reflect.get(style, property, receiver);
          },
        });
      }
      return originalGetComputedStyle(target);
    };

    try {
      await withResizeObserver(async () => {
        const { container } = render(NavigationBar, {
          items: textSnippet('items'),
          menuToggle: toggleSnippet(),
        });

        const nav = await openCollapsedMobileMenu(container);
        const itemsRegion = getItemsRegion(container);
        expect(itemsRegion.parentElement?.parentElement).toBe(document.body);

        const toggle = requiredInstance(nav.querySelector('#toggle-btn'), HTMLElement);
        await fireEvent.click(toggle);

        const closingRegion = getItemsRegion(container);
        expect(closingRegion.hasAttribute('data-cinder-closing')).toBe(true);
        // Still portaled to `document.body`, not moved back inline under `nav`.
        expect(closingRegion.parentElement?.parentElement).toBe(document.body);
        expect(nav.contains(closingRegion)).toBe(false);
      });
    } finally {
      window.getComputedStyle = originalGetComputedStyle;
    }
  });

  test('an open collapsed menu is portaled outside the navigation stacking context', async () => {
    await withResizeObserver(async () => {
      const { container } = render(NavigationBar, {
        items: textSnippet('items'),
        menuToggle: toggleSnippet(),
      });

      const nav = await openCollapsedMobileMenu(container);
      const itemsRegion = getItemsRegion(container);

      expect(nav.contains(itemsRegion)).toBe(false);
      expect(itemsRegion.parentElement?.parentElement).toBe(document.body);
      expect(itemsRegion.getAttribute('data-cinder-mobile-panel')).toBe('true');
    });
  });
});
