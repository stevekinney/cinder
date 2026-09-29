/// <reference lib="dom" />
import { requiredInstance, setupHappyDom } from '@lostgradient/testing';
import { afterEach, describe, expect, test } from 'bun:test';
import { keyboardNavigationSnippet } from './navigation-bar-interaction-snippet-helpers.ts';
import {
  negativeFinalBrandSnippet,
  positiveFirstNavigationSnippet,
  positiveThenNormalBrandSnippet,
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
  test('reverse Tab threads the focused item tab tier into the brand lookup', async () => {
    // With a positive-tabindex first navigation item, reverse Tab must land
    // on the nearest lower-or-equal positive-tabindex brand control, not
    // fall straight to the zero/default-tier brand target the untiered
    // lookup previously always picked.
    await withResizeObserver(async () => {
      const { container } = render(NavigationBar, {
        brand: positiveThenNormalBrandSnippet(),
        items: positiveFirstNavigationSnippet(),
        menuToggle: toggleSnippet(),
        menuTogglePlacement: 'before-brand',
      });

      await openCollapsedMobileMenu(container);
      const itemsRegion = await waitForMobilePanelPosition(container);
      const home = requiredInstance(
        itemsRegion.querySelector('[data-key="home"]'),
        HTMLButtonElement,
      );
      const brandPositive = container.querySelector('#brand-positive');

      home.focus();
      await fireEvent.keyDown(home, { key: 'Tab', shiftKey: true });
      expect(document.activeElement).toBe(brandPositive);
    });
  });

  test('reverse Tab skips brand controls removed from sequential tab order', async () => {
    await withResizeObserver(async () => {
      const { container } = render(NavigationBar, {
        brand: negativeFinalBrandSnippet(),
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
      const brandHome = container.querySelector('#brand-home');

      home.focus();
      await fireEvent.keyDown(home, { key: 'Tab', shiftKey: true });
      expect(document.activeElement).toBe(brandHome);
    });
  });

  test('last portaled item tabs to the first page control after a bar without actions', async () => {
    await withResizeObserver(async () => {
      const { container } = render(NavigationBar, {
        items: keyboardNavigationSnippet({}),
        menuToggle: toggleSnippet(),
      });
      const followingButton = document.createElement('button');
      followingButton.textContent = 'Following';
      document.body.append(followingButton);

      await openCollapsedMobileMenu(container);
      const itemsRegion = await waitForMobilePanelPosition(container);
      const settings = requiredInstance(
        itemsRegion.querySelector('[data-key="settings"]'),
        HTMLButtonElement,
      );

      settings.focus();
      await fireEvent.keyDown(settings, { key: 'Tab' });
      expect(document.activeElement).toBe(followingButton);
    });
  });

  test('last portaled item skips page controls removed from sequential tab order', async () => {
    await withResizeObserver(async () => {
      const { container } = render(NavigationBar, {
        items: keyboardNavigationSnippet({}),
        menuToggle: toggleSnippet(),
      });
      const skippedButton = document.createElement('button');
      // `tabIndex` is a reflected property in browsers, so assigning -1
      // creates the same `tabindex="-1"` content attribute. happy-dom does not
      // implement that reflection and reports -1 for every attribute-less
      // button, so express the browser result directly in this DOM harness.
      skippedButton.setAttribute('tabindex', '-1');
      skippedButton.textContent = 'Skipped';
      const followingButton = document.createElement('button');
      followingButton.textContent = 'Following';
      document.body.append(skippedButton, followingButton);

      await openCollapsedMobileMenu(container);
      const itemsRegion = await waitForMobilePanelPosition(container);
      const settings = requiredInstance(
        itemsRegion.querySelector('[data-key="settings"]'),
        HTMLButtonElement,
      );

      settings.focus();
      await fireEvent.keyDown(settings, { key: 'Tab' });
      expect(document.activeElement).toBe(followingButton);
    });
  });

  test('desktop items remain an ordinary unnamed group', () => {
    const { container } = render(NavigationBar, {
      items: textSnippet('items'),
      menuToggle: toggleSnippet(),
    });

    expect(container.querySelector('.cinder-navigation-bar__items')?.hasAttribute('role')).toBe(
      false,
    );
  });

  test('clicking the toggle a second time closes the menu', async () => {
    const { container } = render(NavigationBar, {
      items: textSnippet('items'),
      menuToggle: toggleSnippet(),
    });
    const toggle = requiredInstance(container.querySelector('#toggle-btn'), HTMLElement);
    await fireEvent.click(toggle);
    await fireEvent.click(toggle);
    expect(
      container.querySelector('.cinder-navigation-bar__items')?.getAttribute('data-open'),
    ).toBe('false');
  });

  // ── Escape key handling ──────────────────────────────────────────────────

  test('pressing Escape on <nav> while open closes the menu', async () => {
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

      await fireEvent.keyDown(nav, { key: 'Escape' });
      expect(getItemsRegion(container).getAttribute('data-open')).toBe('false');
    });
  });

  test('pressing Escape on <nav> while closed does not error and data-open stays false', async () => {
    const { container } = render(NavigationBar, {
      items: textSnippet('items'),
      menuToggle: toggleSnippet(),
    });
    const nav = requiredInstance(container.querySelector('nav'), HTMLElement);
    await fireEvent.keyDown(nav, { key: 'Escape' });
    expect(
      container.querySelector('.cinder-navigation-bar__items')?.getAttribute('data-open'),
    ).toBe('false');
  });
});
