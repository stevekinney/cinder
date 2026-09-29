/// <reference lib="dom" />
import { requiredInstance, setupHappyDom } from '@lostgradient/testing';
import { afterEach, describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import {
  iconNavigationSnippet,
  keyboardNavigationSnippet,
} from './navigation-bar-interaction-snippet-helpers.ts';
import { toggleSnippet } from './navigation-bar-snippet-helpers.ts';
import {
  getItemsRegion,
  openCollapsedMobileMenu,
  withResizeObserver,
} from './navigation-bar-test-helpers.ts';
setupHappyDom();
const { render, fireEvent, cleanup } = await import('@testing-library/svelte');
const { resetEscapeStack } = await import('../../_internal/overlay.ts');
const { default: NavigationBar } = await import('./navigation-bar.svelte');

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
  test('writable native Event properties use the original event as their receiver', () => {
    expect(navigationBarSource).toMatch(
      /set\(target, property, value\)\s*\{\s*return Reflect\.set\(target, property, value, target\);/,
    );
  });

  test('ArrowRight moves focus to the navigation item on the right', async () => {
    const clicks: Record<string, number> = {};
    const { container } = render(NavigationBar, {
      items: keyboardNavigationSnippet(clicks),
    });
    const home = requiredInstance(container.querySelector('[data-key="home"]'), HTMLElement);
    const docs = requiredInstance(container.querySelector('[data-key="docs"]'), HTMLElement);

    home.focus();
    await fireEvent.keyDown(home, { key: 'ArrowRight' });

    expect(document.activeElement).toBe(docs);
  });

  test('ArrowLeft moves focus to the navigation item on the left', async () => {
    const clicks: Record<string, number> = {};
    const { container } = render(NavigationBar, {
      items: keyboardNavigationSnippet(clicks),
    });
    const docs = requiredInstance(container.querySelector('[data-key="docs"]'), HTMLElement);
    const home = requiredInstance(container.querySelector('[data-key="home"]'), HTMLElement);

    docs.focus();
    await fireEvent.keyDown(docs, { key: 'ArrowLeft' });

    expect(document.activeElement).toBe(home);
  });

  test('arrow-key navigation skips disabled navigation items', async () => {
    const clicks: Record<string, number> = {};
    const { container } = render(NavigationBar, {
      items: keyboardNavigationSnippet(clicks),
    });
    const docs = requiredInstance(container.querySelector('[data-key="docs"]'), HTMLElement);
    const settings = requiredInstance(
      container.querySelector('[data-key="settings"]'),
      HTMLElement,
    );

    docs.focus();
    await fireEvent.keyDown(docs, { key: 'ArrowRight' });

    expect(document.activeElement).toBe(settings);
  });

  test('arrow-key navigation from a disabled navigation item uses its DOM position', async () => {
    const clicks: Record<string, number> = {};
    const { container } = render(NavigationBar, {
      items: keyboardNavigationSnippet(clicks),
    });
    const billing = requiredInstance(container.querySelector('[data-key="billing"]'), HTMLElement);
    const settings = requiredInstance(
      container.querySelector('[data-key="settings"]'),
      HTMLElement,
    );

    billing.focus();
    await fireEvent.keyDown(billing, { key: 'ArrowRight' });

    expect(document.activeElement).toBe(settings);
  });

  test('Space selects the focused navigation item', async () => {
    const clicks: Record<string, number> = {};
    const { container } = render(NavigationBar, {
      items: keyboardNavigationSnippet(clicks),
    });
    const docs = requiredInstance(container.querySelector('[data-key="docs"]'), HTMLElement);

    docs.focus();
    await fireEvent.keyDown(docs, { key: ' ' });

    expect(clicks['docs']).toBe(1);
  });

  test('Enter selects the focused navigation item', async () => {
    const clicks: Record<string, number> = {};
    const { container } = render(NavigationBar, {
      items: keyboardNavigationSnippet(clicks),
    });
    const docs = requiredInstance(container.querySelector('[data-key="docs"]'), HTMLElement);

    docs.focus();
    await fireEvent.keyDown(docs, { key: 'Enter' });

    expect(clicks['docs']).toBe(1);
  });

  test('Space does not select a navigation item when the event starts inside a descendant', async () => {
    const clicks: Record<string, number> = {};
    const { container } = render(NavigationBar, {
      items: keyboardNavigationSnippet(clicks),
    });
    const docsLabel = requiredInstance(
      container.querySelector('[data-testid="docs-label"]'),
      HTMLElement,
    );

    await fireEvent.keyDown(docsLabel, { key: ' ' });

    expect(clicks['docs']).toBeUndefined();
  });

  test('enabled item click closes an open collapsed mobile menu', async () => {
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
      await fireEvent.click(docs);

      expect(clicks['docs']).toBe(1);
      expect(getItemsRegion(container).getAttribute('data-open')).toBe('false');
    });
  });

  test('enabled item descendant click closes an open collapsed mobile menu', async () => {
    await withResizeObserver(async () => {
      const clicks: Record<string, number> = {};
      const { container } = render(NavigationBar, {
        items: iconNavigationSnippet(clicks),
        menuToggle: toggleSnippet(),
      });

      await openCollapsedMobileMenu(container);

      const icon = requiredInstance(
        getItemsRegion(container).querySelector('[data-testid="home-icon"]'),
        SVGElement,
      );
      await fireEvent.click(icon);

      expect(clicks['home']).toBe(1);
      expect(getItemsRegion(container).getAttribute('data-open')).toBe('false');
    });
  });

  test('consumer onclick can prevent the automatic collapsed mobile menu close', async () => {
    await withResizeObserver(async () => {
      const clicks: Record<string, number> = {};
      const { container } = render(NavigationBar, {
        items: keyboardNavigationSnippet(clicks),
        menuToggle: toggleSnippet(),
        onclick: function (this: HTMLElement, event: MouseEvent) {
          const nav = requiredInstance(container.querySelector('nav'), HTMLElement);
          expect(this).toBe(nav);
          event.preventDefault();
        },
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
});
