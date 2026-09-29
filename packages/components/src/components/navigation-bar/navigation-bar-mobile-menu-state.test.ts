/// <reference lib="dom" />
import { requiredInstance, setupHappyDom } from '@lostgradient/testing';
import { afterEach, describe, expect, test } from 'bun:test';
import { textSnippet, toggleSnippet } from './navigation-bar-snippet-helpers.ts';
import {
  CapturingResizeObserver,
  emitNavigationBarResize,
  withResizeObserver,
} from './navigation-bar-test-helpers.ts';
setupHappyDom();
const { render, fireEvent, cleanup } = await import('@testing-library/svelte');
const { resetEscapeStack } = await import('../../_internal/overlay.ts');
const { default: NavigationBar } = await import('./navigation-bar.svelte');
const { createRawSnippet, tick } = await import('svelte');
afterEach(() => {
  cleanup();
  document.body.replaceChildren();
  resetEscapeStack();
});

afterEach(() => cleanup());

describe('NavigationBar', () => {
  test('placement defaults to top and labelsVisible defaults to always', () => {
    const { container } = render(NavigationBar, {
      items: textSnippet('items'),
    });
    const nav = container.querySelector('nav');
    expect(nav?.getAttribute('data-cinder-placement')).toBe('top');
    expect(nav?.getAttribute('data-cinder-label-visibility')).toBe('always');
  });

  test('bottom placement emits bottom attributes and mobile item context without a menu toggle', () => {
    let capturedVariant: string | undefined;
    let capturedPlacement: string | undefined;
    let capturedShowLabels: string | undefined;
    const captureSnippet = createRawSnippet<
      [{ variant: string; placement?: string; labelsVisible?: string }]
    >((getCtx) => ({
      render: () => `<span></span>`,
      setup() {
        const context = getCtx();
        capturedVariant = context.variant;
        capturedPlacement = context.placement;
        capturedShowLabels = context.labelsVisible;
      },
    }));

    const { container } = render(NavigationBar, {
      items: captureSnippet,
      placement: 'bottom',
      labelsVisible: 'active',
      menuToggle: toggleSnippet(),
    });

    const nav = container.querySelector('nav');
    expect(nav?.getAttribute('data-cinder-placement')).toBe('bottom');
    expect(nav?.getAttribute('data-cinder-label-visibility')).toBe('active');
    expect(nav?.getAttribute('data-collapsible')).toBe('false');
    expect(container.querySelector('.cinder-navigation-bar__menu-toggle')).toBeNull();
    expect(capturedVariant).toBe('mobile');
    expect(capturedPlacement).toBe('bottom');
    expect(capturedShowLabels).toBe('active');
  });

  test('placement and label visibility data attributes cannot be clobbered by rest props', () => {
    const { container } = render(NavigationBar, {
      items: textSnippet('items'),
      placement: 'bottom',
      labelsVisible: 'never',
      'data-cinder-placement': 'top',
      'data-cinder-label-visibility': 'always',
    });
    const nav = container.querySelector('nav');
    expect(nav?.getAttribute('data-cinder-placement')).toBe('bottom');
    expect(nav?.getAttribute('data-cinder-label-visibility')).toBe('never');
  });

  // ── mobileMenuOpen defaults ──────────────────────────────────────────────

  test('mobileMenuOpen defaults to false; items region has data-open="false"', () => {
    const { container } = render(NavigationBar, {
      items: textSnippet('items'),
      menuToggle: toggleSnippet(),
    });
    expect(
      container.querySelector('.cinder-navigation-bar__items')?.getAttribute('data-open'),
    ).toBe('false');
  });

  test('collapsible desktop layout does not apply inert when menu is closed', async () => {
    await withResizeObserver(async () => {
      const { container } = render(NavigationBar, {
        items: textSnippet('items'),
        menuToggle: toggleSnippet(),
      });

      await tick();
      const nav = requiredInstance(container.querySelector('nav'), HTMLElement);
      const itemsRegion = requiredInstance(
        container.querySelector('.cinder-navigation-bar__items'),
        HTMLElement,
      );
      expect(CapturingResizeObserver.lastObserver?.observed).toContain(nav);

      emitNavigationBarResize(nav, 1024);
      await tick();

      expect(itemsRegion.hasAttribute('inert')).toBe(false);
    });
  });

  test('items region does not receive inert when menuToggle is present and menu is closed', () => {
    const { container } = render(NavigationBar, {
      items: textSnippet('items'),
      menuToggle: toggleSnippet(),
    });

    const itemsRegion = container.querySelector('.cinder-navigation-bar__items');
    expect(itemsRegion).not.toBeNull();
    expect(itemsRegion?.hasAttribute('inert')).toBe(false);
  });

  test('collapsible mobile layout applies inert while closed and removes it when opened', async () => {
    await withResizeObserver(async () => {
      const { container } = render(NavigationBar, {
        items: textSnippet('items'),
        menuToggle: toggleSnippet(),
      });

      await tick();
      const nav = requiredInstance(container.querySelector('nav'), HTMLElement);
      const itemsRegion = requiredInstance(
        container.querySelector('.cinder-navigation-bar__items'),
        HTMLElement,
      );

      emitNavigationBarResize(nav, 640);
      await tick();

      expect(itemsRegion.hasAttribute('inert')).toBe(true);

      const toggle = requiredInstance(container.querySelector('#toggle-btn'), HTMLElement);
      await fireEvent.click(toggle);

      expect(itemsRegion.hasAttribute('inert')).toBe(false);
    });
  });

  // ── menuToggle snippet and ARIA ──────────────────────────────────────────

  test('with menuToggle, toggle button receives aria-expanded="false" initially', () => {
    const { container } = render(NavigationBar, {
      items: textSnippet('items'),
      menuToggle: toggleSnippet(),
    });
    const toggle = container.querySelector('#toggle-btn');
    expect(toggle?.getAttribute('aria-expanded')).toBe('false');
  });

  test('menu toggle clicks reach the consumer handler', async () => {
    let clicks = 0;
    const { container } = render(NavigationBar, {
      items: textSnippet('items'),
      menuToggle: toggleSnippet(),
      onclick: () => {
        clicks += 1;
      },
    });
    await fireEvent.click(requiredInstance(container.querySelector('#toggle-btn'), HTMLElement));
    expect(clicks).toBe(1);
  });

  test('menu toggle renders after the brand by default', () => {
    const { container } = render(NavigationBar, {
      items: textSnippet('items'),
      brand: textSnippet('Acme'),
      menuToggle: toggleSnippet(),
    });
    const nav = container.querySelector('nav');
    const brand = container.querySelector('.cinder-navigation-bar__brand');
    const toggle = container.querySelector('.cinder-navigation-bar__menu-toggle');

    expect(nav?.getAttribute('data-cinder-menu-toggle-placement')).toBe('after-brand');
    expect(brand?.nextElementSibling).toBe(toggle);
  });
});
