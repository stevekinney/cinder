/// <reference lib="dom" />
import { requiredInstance, setupHappyDom } from '@lostgradient/testing';
import { afterEach, describe, expect, test } from 'bun:test';
import { keyboardNavigationSnippet } from './navigation-bar-interaction-snippet-helpers.ts';
import {
  actionButtonSnippet,
  cssHiddenThenActionButtonSnippet,
  hiddenThenActionButtonSnippet,
  negativeFinalNavigationSnippet,
  negativeFirstNavigationSnippet,
  negativeThenActionButtonSnippet,
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
  test('portaled menu skips hidden action controls at the end of its tab order', async () => {
    await withResizeObserver(async () => {
      const { container } = render(NavigationBar, {
        items: keyboardNavigationSnippet({}),
        menuToggle: toggleSnippet(),
        actions: hiddenThenActionButtonSnippet(),
      });

      await openCollapsedMobileMenu(container);
      const itemsRegion = await waitForMobilePanelPosition(container);
      const accountAction = requiredInstance(
        container.querySelector('#nav-action'),
        HTMLButtonElement,
      );
      const settings = requiredInstance(
        itemsRegion.querySelector('[data-key="settings"]'),
        HTMLButtonElement,
      );

      settings.focus();
      await fireEvent.keyDown(settings, { key: 'Tab' });
      expect(document.activeElement).toBe(accountAction);
    });
  });

  test('portaled menu skips CSS-hidden action controls at the end of its tab order', async () => {
    await withResizeObserver(async () => {
      const { container } = render(NavigationBar, {
        items: keyboardNavigationSnippet({}),
        menuToggle: toggleSnippet(),
        actions: cssHiddenThenActionButtonSnippet(),
      });

      await openCollapsedMobileMenu(container);
      const itemsRegion = await waitForMobilePanelPosition(container);
      const accountAction = requiredInstance(
        container.querySelector('#nav-action'),
        HTMLButtonElement,
      );
      const settings = requiredInstance(
        itemsRegion.querySelector('[data-key="settings"]'),
        HTMLButtonElement,
      );

      settings.focus();
      await fireEvent.keyDown(settings, { key: 'Tab' });
      expect(document.activeElement).toBe(accountAction);
    });
  });

  test('portaled menu skips actions removed from sequential tab order', async () => {
    await withResizeObserver(async () => {
      const { container } = render(NavigationBar, {
        items: keyboardNavigationSnippet({}),
        menuToggle: toggleSnippet(),
        actions: negativeThenActionButtonSnippet(),
      });

      await openCollapsedMobileMenu(container);
      const itemsRegion = await waitForMobilePanelPosition(container);
      const accountAction = requiredInstance(
        container.querySelector('#nav-action'),
        HTMLButtonElement,
      );
      const settings = requiredInstance(
        itemsRegion.querySelector('[data-key="settings"]'),
        HTMLButtonElement,
      );

      settings.focus();
      await fireEvent.keyDown(settings, { key: 'Tab' });
      expect(document.activeElement).toBe(accountAction);
    });
  });

  test('last sequential navigation item tabs to actions when a final enabled item has tabindex=-1', async () => {
    await withResizeObserver(async () => {
      const { container } = render(NavigationBar, {
        items: negativeFinalNavigationSnippet(),
        menuToggle: toggleSnippet(),
        actions: actionButtonSnippet(),
      });

      await openCollapsedMobileMenu(container);
      const itemsRegion = await waitForMobilePanelPosition(container);
      const enabledItem = requiredInstance(
        itemsRegion.querySelector('[data-key="enabled"]'),
        HTMLButtonElement,
      );
      const accountAction = requiredInstance(
        container.querySelector('#nav-action'),
        HTMLButtonElement,
      );

      enabledItem.focus();
      await fireEvent.keyDown(enabledItem, { key: 'Tab' });
      expect(document.activeElement).toBe(accountAction);
    });
  });

  test('reverse Tab uses the first sequential navigation item when an enabled item has tabindex=-1', async () => {
    await withResizeObserver(async () => {
      const { container } = render(NavigationBar, {
        items: negativeFirstNavigationSnippet(),
        menuToggle: toggleSnippet(),
      });

      await openCollapsedMobileMenu(container);
      const itemsRegion = await waitForMobilePanelPosition(container);
      const toggle = requiredInstance(container.querySelector('#toggle-btn'), HTMLButtonElement);
      const enabledItem = requiredInstance(
        itemsRegion.querySelector('[data-key="enabled"]'),
        HTMLButtonElement,
      );

      enabledItem.focus();
      await fireEvent.keyDown(enabledItem, { key: 'Tab', shiftKey: true });
      expect(document.activeElement).toBe(toggle);
    });
  });

  test('reverse Tab bridges from an arrow-focused leading item with tabindex=-1', async () => {
    await withResizeObserver(async () => {
      const { container } = render(NavigationBar, {
        items: negativeFirstNavigationSnippet(),
        menuToggle: toggleSnippet(),
      });

      await openCollapsedMobileMenu(container);
      const itemsRegion = await waitForMobilePanelPosition(container);
      const toggle = requiredInstance(container.querySelector('#toggle-btn'), HTMLButtonElement);
      const skippedItem = requiredInstance(
        itemsRegion.querySelector('[data-key="skipped"]'),
        HTMLButtonElement,
      );
      const enabledItem = requiredInstance(
        itemsRegion.querySelector('[data-key="enabled"]'),
        HTMLButtonElement,
      );

      enabledItem.focus();
      await fireEvent.keyDown(enabledItem, { key: 'ArrowLeft' });
      expect(document.activeElement).toBe(skippedItem);
      await fireEvent.keyDown(skippedItem, { key: 'Tab', shiftKey: true });
      expect(document.activeElement).toBe(toggle);
    });
  });

  test('forward Tab bridges from an arrow-focused trailing item with tabindex=-1', async () => {
    await withResizeObserver(async () => {
      const { container } = render(NavigationBar, {
        items: negativeFinalNavigationSnippet(),
        menuToggle: toggleSnippet(),
        actions: actionButtonSnippet(),
      });

      await openCollapsedMobileMenu(container);
      const itemsRegion = await waitForMobilePanelPosition(container);
      const skippedItem = requiredInstance(
        itemsRegion.querySelector('[data-key="skipped"]'),
        HTMLButtonElement,
      );
      const enabledItem = requiredInstance(
        itemsRegion.querySelector('[data-key="enabled"]'),
        HTMLButtonElement,
      );
      const accountAction = requiredInstance(
        container.querySelector('#nav-action'),
        HTMLButtonElement,
      );

      enabledItem.focus();
      await fireEvent.keyDown(enabledItem, { key: 'ArrowRight' });
      expect(document.activeElement).toBe(skippedItem);
      await fireEvent.keyDown(skippedItem, { key: 'Tab' });
      expect(document.activeElement).toBe(accountAction);
    });
  });
});
