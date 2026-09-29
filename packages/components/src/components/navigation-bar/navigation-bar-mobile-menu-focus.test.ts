/// <reference lib="dom" />
import { requiredInstance, setupHappyDom } from '@lostgradient/testing';
import { afterEach, describe, expect, test } from 'bun:test';
import { keyboardNavigationSnippet } from './navigation-bar-interaction-snippet-helpers.ts';
import {
  actionButtonSnippet,
  textSnippet,
  toggleSnippet,
} from './navigation-bar-snippet-helpers.ts';
import {
  getItemsRegion,
  openCollapsedMobileMenu,
  waitForMobilePanelPosition,
  withResizeObserver,
} from './navigation-bar-test-helpers.ts';
setupHappyDom();
const { render, fireEvent, waitFor, cleanup } = await import('@testing-library/svelte');
const { resetEscapeStack } = await import('../../_internal/overlay.ts');
const { default: NavigationBar } = await import('./navigation-bar.svelte');

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
  resetEscapeStack();
});

afterEach(() => cleanup());

describe('NavigationBar', () => {
  test('mirrors the root and custom classes onto the portaled items scope', async () => {
    // A root-scoped consumer override like `.cinder-navigation-bar.compact
    // .cinder-navigation-item` must keep matching while the mobile items are
    // portaled, so the portal scope needs both `cinder-navigation-bar` and
    // any custom class — not just its own `__portal-scope` marker.
    await withResizeObserver(async () => {
      const { container } = render(NavigationBar, {
        items: textSnippet('items'),
        menuToggle: toggleSnippet(),
        class: 'compact',
      });

      const nav = await openCollapsedMobileMenu(container);
      const portalScope = getItemsRegion(container).parentElement;

      expect(nav.contains(portalScope)).toBe(false);
      expect(portalScope?.classList.contains('cinder-navigation-bar__portal-scope')).toBe(true);
      expect(portalScope?.classList.contains('cinder-navigation-bar')).toBe(true);
      expect(portalScope?.classList.contains('compact')).toBe(true);
    });
  });

  test('owns portaled items before trailing navigation actions', async () => {
    await withResizeObserver(async () => {
      const { container } = render(NavigationBar, {
        items: textSnippet('items'),
        menuToggle: toggleSnippet(),
        actions: textSnippet('actions'),
      });

      const nav = await openCollapsedMobileMenu(container);
      const itemsRegion = getItemsRegion(container);
      const owner = container.querySelector('.cinder-navigation-bar__items-owner');
      const actions = container.querySelector('.cinder-navigation-bar__actions');

      expect(nav.hasAttribute('aria-owns')).toBe(false);
      expect(owner?.getAttribute('aria-owns')).toBe(itemsRegion.id);
      expect(
        owner && actions
          ? Boolean(owner.compareDocumentPosition(actions) & Node.DOCUMENT_POSITION_FOLLOWING)
          : false,
      ).toBe(true);
    });
  });

  test('portaled item events bubble through the original navigation ancestry', async () => {
    await withResizeObserver(async () => {
      const { container } = render(NavigationBar, {
        items: keyboardNavigationSnippet({}),
        menuToggle: toggleSnippet(),
      });
      const bubbledEvents: Array<{
        type: string;
        target: EventTarget | null;
      }> = [];
      const recordEvent = (event: Event) => {
        bubbledEvents.push({
          type: event.type,
          target: event.target,
        });
      };
      container.addEventListener('click', recordEvent);
      container.addEventListener('keydown', recordEvent);

      await openCollapsedMobileMenu(container);
      bubbledEvents.length = 0;
      const home = requiredInstance(
        getItemsRegion(container).querySelector('[data-key="home"]'),
        HTMLElement,
      );
      await fireEvent.keyDown(home, { key: 'a' });
      await fireEvent.click(home);

      expect(bubbledEvents.map(({ type }) => type)).toEqual(['keydown', 'click']);
      expect(bubbledEvents.map(({ target }) => target)).toEqual([home, home]);
    });
  });

  test('an unavailable source ancestor closes the portaled mobile menu', async () => {
    await withResizeObserver(async () => {
      const { container } = render(NavigationBar, {
        items: keyboardNavigationSnippet({}),
        menuToggle: toggleSnippet(),
      });

      await openCollapsedMobileMenu(container);
      container.setAttribute('aria-hidden', 'true');

      await waitFor(() => {
        expect(getItemsRegion(container).getAttribute('data-open')).toBe('false');
      });
      const itemsRegion = getItemsRegion(container);
      expect(container.contains(itemsRegion)).toBe(true);
      expect(itemsRegion.hasAttribute('inert')).toBe(true);
    });
  });

  test('keeps an open collapsed menu inside its owning dialog', async () => {
    await withResizeObserver(async () => {
      const dialog = document.createElement('dialog');
      dialog.setAttribute('open', '');
      const nativeMatches = dialog.matches.bind(dialog);
      dialog.matches = ((selector: string) =>
        selector === ':modal' || nativeMatches(selector)) as Element['matches'];
      document.body.append(dialog);
      const { container } = render(NavigationBar, {
        items: keyboardNavigationSnippet({}),
        menuToggle: toggleSnippet(),
      });
      dialog.append(container);

      await openCollapsedMobileMenu(container);
      const itemsRegion = await waitForMobilePanelPosition(container);

      expect(itemsRegion.parentElement?.parentElement).toBe(dialog);
    });
  });

  test('portaled menu preserves scoped tokens and color scheme through positioning updates', async () => {
    await withResizeObserver(async () => {
      const { container } = render(NavigationBar, {
        items: keyboardNavigationSnippet({}),
        menuToggle: toggleSnippet(),
        style: '--cinder-surface: hotpink; color-scheme: dark;',
      });

      await openCollapsedMobileMenu(container);
      const itemsRegion = await waitForMobilePanelPosition(container);
      const portalScope = requiredInstance(itemsRegion.parentElement, HTMLElement);

      expect(portalScope.style.getPropertyValue('--cinder-surface')).toBe('hotpink');
      expect(portalScope.style.colorScheme).toBe('dark');
      expect(itemsRegion.style.position).toBe('fixed');

      const navigationBar = requiredInstance(container.querySelector('nav'), HTMLElement);
      navigationBar.style.setProperty('--cinder-surface', 'rebeccapurple');
      navigationBar.style.colorScheme = 'light';

      await waitFor(() => {
        expect(portalScope.style.getPropertyValue('--cinder-surface')).toBe('rebeccapurple');
        expect(portalScope.style.colorScheme).toBe('light');
      });
    });
  });

  test('portaled menu bridges both ends of its tab order', async () => {
    await withResizeObserver(async () => {
      const { container } = render(NavigationBar, {
        items: keyboardNavigationSnippet({}),
        menuToggle: toggleSnippet(),
        actions: actionButtonSnippet(),
      });

      await openCollapsedMobileMenu(container);
      const itemsRegion = await waitForMobilePanelPosition(container);
      const toggle = requiredInstance(container.querySelector('#toggle-btn'), HTMLButtonElement);
      const accountAction = requiredInstance(
        container.querySelector('#nav-action'),
        HTMLButtonElement,
      );
      const home = requiredInstance(
        itemsRegion.querySelector('[data-key="home"]'),
        HTMLButtonElement,
      );
      const settings = requiredInstance(
        itemsRegion.querySelector('[data-key="settings"]'),
        HTMLButtonElement,
      );

      home.focus();
      await fireEvent.keyDown(home, { key: 'Tab', shiftKey: true });
      expect(document.activeElement).toBe(toggle);

      settings.focus();
      await fireEvent.keyDown(settings, { key: 'Tab' });
      expect(document.activeElement).toBe(accountAction);
    });
  });
});
