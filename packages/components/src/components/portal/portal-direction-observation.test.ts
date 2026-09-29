import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { tick } from 'svelte';

import {
  childSnippet,
  invalidatePortalDirection,
  nativeGetComputedStyle,
  Portal,
  PortalAttachmentTest,
  render,
  restorePortalGlobalState,
  waitFor,
  withComputedDirection,
} from './portal-test-helpers.ts';

beforeEach(() => document.body.replaceChildren());
afterEach(restorePortalGlobalState);

describe('Portal', () => {
  test('inherits direction when a direct portal attachment has no initial direction', async () => {
    const source = document.createElement('div');
    source.setAttribute('dir', 'ltr');
    const target = document.createElement('div');
    document.body.append(source, target);

    render(PortalAttachmentTest, { props: { source, target } });
    await tick();

    expect(
      target.querySelector('[data-testid="direct-portal-attachment"]')?.getAttribute('dir'),
    ).toBe('ltr');
  });

  test('updates inherited computed direction when the source style changes', async () => {
    const source = document.createElement('div');
    source.style.direction = 'rtl';
    const mountPoint = document.createElement('div');
    source.append(mountPoint);
    document.body.append(source);
    render(Portal, { target: mountPoint, props: { children: childSnippet } });
    await tick();

    const wrapper = document.body.querySelector('[data-testid="portal-child"]')?.parentElement;
    expect(wrapper?.getAttribute('dir')).toBe('rtl');

    source.style.direction = 'ltr';
    await waitFor(() => expect(wrapper?.getAttribute('dir')).toBe('ltr'));

    expect(wrapper?.getAttribute('dir')).toBe('ltr');
  });

  test('updates inherited computed direction after a sibling selector changes', async () => {
    const source = document.createElement('div');
    const mountPoint = document.createElement('div');
    source.append(mountPoint);
    const sibling = document.createElement('div');
    document.body.append(sibling, source);

    Object.defineProperty(globalThis, 'getComputedStyle', {
      configurable: true,
      value: (element: Element) => {
        let computed = nativeGetComputedStyle(element);
        if (element === mountPoint) {
          computed = withComputedDirection(
            computed,
            sibling.classList.contains('portal-rtl') ? 'rtl' : 'ltr',
          );
        }
        return computed;
      },
    });
    render(Portal, { target: mountPoint, props: { children: childSnippet } });
    await tick();

    const wrapper = document.body.querySelector('[data-testid="portal-child"]')?.parentElement;
    expect(wrapper?.getAttribute('dir')).toBe('ltr');

    sibling.classList.add('portal-rtl');
    await waitFor(() => expect(wrapper?.getAttribute('dir')).toBe('rtl'));
    Object.defineProperty(globalThis, 'getComputedStyle', {
      configurable: true,
      value: nativeGetComputedStyle,
    });
  });

  test('updates computed direction after a CSSOM invalidation hook', async () => {
    const source = document.createElement('div');
    const mountPoint = document.createElement('div');
    source.append(mountPoint);
    document.body.append(source);
    let direction: 'ltr' | 'rtl' = 'ltr';
    const currentGetComputedStyle = globalThis.getComputedStyle;
    Object.defineProperty(globalThis, 'getComputedStyle', {
      configurable: true,
      value: (element: Element) => {
        let computed = currentGetComputedStyle(element);
        if (element === mountPoint) {
          computed = withComputedDirection(computed, direction);
        }
        return computed;
      },
    });

    render(Portal, { target: mountPoint, props: { children: childSnippet } });
    await tick();
    const wrapper = document.body.querySelector('[data-testid="portal-child"]')?.parentElement;
    expect(wrapper?.getAttribute('dir')).toBe('ltr');

    direction = 'rtl';
    invalidatePortalDirection();
    await waitFor(() => expect(wrapper?.getAttribute('dir')).toBe('rtl'));
  });

  test('does not register media listeners without mounted portals', () => {
    const originalStyleSheets = Object.getOwnPropertyDescriptor(document, 'styleSheets');
    const originalMatchMedia = window.matchMedia;
    let matchMediaCalls = 0;
    Object.defineProperty(document, 'styleSheets', {
      configurable: true,
      value: [{ media: { mediaText: '(prefers-color-scheme: dark)' }, cssRules: [] }],
    });
    window.matchMedia = (query: string) => {
      matchMediaCalls += 1;
      const mediaQueryList = originalMatchMedia(query);
      Object.defineProperty(mediaQueryList, 'media', { configurable: true, value: query });
      return mediaQueryList;
    };

    invalidatePortalDirection();

    expect(matchMediaCalls).toBe(0);
    window.matchMedia = originalMatchMedia;
    if (originalStyleSheets) {
      Object.defineProperty(document, 'styleSheets', originalStyleSheets);
    } else {
      Reflect.deleteProperty(document, 'styleSheets');
    }
  });

  test('registers stylesheet-level media conditions for invalidation', async () => {
    const originalStyleSheets = Object.getOwnPropertyDescriptor(document, 'styleSheets');
    Object.defineProperty(document, 'styleSheets', {
      configurable: true,
      value: [{ media: { mediaText: '(prefers-color-scheme: dark)' }, cssRules: [] }],
    });
    const originalMatchMedia = window.matchMedia;
    let observedQuery = '';
    window.matchMedia = (query: string) => {
      observedQuery = query;
      return {
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => true,
      } as MediaQueryList;
    };
    const mountPoint = document.createElement('div');
    document.body.append(mountPoint);

    render(Portal, { target: mountPoint, props: { children: childSnippet } });
    await tick();

    expect(observedQuery).toBe('(prefers-color-scheme: dark)');
    window.matchMedia = originalMatchMedia;
    if (originalStyleSheets) {
      Object.defineProperty(document, 'styleSheets', originalStyleSheets);
    } else {
      Reflect.deleteProperty(document, 'styleSheets');
    }
  });

  test('refreshes media listeners when a later portal registers a shadow root', async () => {
    const originalMatchMedia = window.matchMedia;
    const observedQueries: string[] = [];
    const removedQueries: string[] = [];
    window.matchMedia = (query: string) => {
      observedQueries.push(query);
      return {
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => removedQueries.push(query),
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => true,
      } as MediaQueryList;
    };

    const firstMountPoint = document.createElement('div');
    document.body.append(firstMountPoint);
    render(Portal, { target: firstMountPoint, props: { children: childSnippet } });
    await tick();

    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });
    Object.defineProperty(shadow, 'styleSheets', {
      configurable: true,
      value: [{ media: { mediaText: '(prefers-color-scheme: dark)' }, cssRules: [] }],
    });
    const secondMountPoint = document.createElement('div');
    shadow.append(secondMountPoint);
    document.body.append(host);

    const secondView = render(Portal, {
      target: secondMountPoint,
      props: { children: childSnippet },
    });
    await tick();

    expect(observedQueries).toContain('(prefers-color-scheme: dark)');
    secondView.unmount();
    expect(removedQueries).toContain('(prefers-color-scheme: dark)');
    window.matchMedia = originalMatchMedia;
  });
});
