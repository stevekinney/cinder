import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { tick } from 'svelte';

import {
  childSnippet,
  invalidatePortalDirection,
  Portal,
  render,
  restorePortalGlobalState,
  waitFor,
  withComputedDirection,
} from './portal-test-helpers.ts';

beforeEach(() => document.body.replaceChildren());
afterEach(restorePortalGlobalState);

describe('Portal', () => {
  test('registers media conditions from every enclosing shadow root', async () => {
    const originalMatchMediaDescriptor = Object.getOwnPropertyDescriptor(window, 'matchMedia');
    const observedQueries: string[] = [];
    try {
      window.matchMedia = (query: string) => {
        observedQueries.push(query);
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

      const outerHost = document.createElement('div');
      const outerShadow = outerHost.attachShadow({ mode: 'open' });
      Object.defineProperty(outerShadow, 'styleSheets', {
        configurable: true,
        value: [{ media: { mediaText: '(prefers-contrast: more)' }, cssRules: [] }],
      });
      const innerHost = document.createElement('div');
      const innerShadow = innerHost.attachShadow({ mode: 'open' });
      const mountPoint = document.createElement('div');
      innerShadow.append(mountPoint);
      outerShadow.append(innerHost);
      document.body.append(outerHost);

      render(Portal, { target: mountPoint, props: { children: childSnippet } });
      await tick();

      expect(observedQueries).toContain('(prefers-contrast: more)');
    } finally {
      restorePortalGlobalState();
      expect(Object.getOwnPropertyDescriptor(window, 'matchMedia')).toEqual(
        originalMatchMediaDescriptor,
      );
    }
  });

  test('registers enclosing shadow-root media without MutationObserver support', async () => {
    const originalMutationObserver = globalThis.MutationObserver;
    const originalMatchMedia = window.matchMedia;
    const observedQueries: string[] = [];
    Object.defineProperty(globalThis, 'MutationObserver', {
      configurable: true,
      value: undefined,
    });
    window.matchMedia = (query: string) => {
      observedQueries.push(query);
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

    const outerHost = document.createElement('div');
    const outerShadow = outerHost.attachShadow({ mode: 'open' });
    Object.defineProperty(outerShadow, 'styleSheets', {
      configurable: true,
      value: [{ media: { mediaText: '(prefers-contrast: more)' }, cssRules: [] }],
    });
    const innerHost = document.createElement('div');
    const innerShadow = innerHost.attachShadow({ mode: 'open' });
    const mountPoint = document.createElement('div');
    innerShadow.append(mountPoint);
    outerShadow.append(innerHost);
    document.body.append(outerHost);

    render(Portal, { target: mountPoint, props: { children: childSnippet } });
    await tick();

    expect(observedQueries).toContain('(prefers-contrast: more)');
    Object.defineProperty(globalThis, 'MutationObserver', {
      configurable: true,
      value: originalMutationObserver,
    });
    window.matchMedia = originalMatchMedia;
  });

  test('refreshes media listeners when the CSSOM invalidation hook changes rules', async () => {
    const originalStyleSheets = Object.getOwnPropertyDescriptor(document, 'styleSheets');
    const originalMatchMedia = window.matchMedia;
    const observedQueries: string[] = [];
    Object.defineProperty(document, 'styleSheets', {
      configurable: true,
      value: [{ media: { mediaText: '(min-width: 1px)' }, cssRules: [] }],
    });
    window.matchMedia = (query: string) => {
      observedQueries.push(query);
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

    Object.defineProperty(document, 'styleSheets', {
      configurable: true,
      value: [{ media: { mediaText: '(max-width: 1px)' }, cssRules: [] }],
    });
    invalidatePortalDirection();
    expect(observedQueries).toContain('(max-width: 1px)');

    window.matchMedia = originalMatchMedia;
    if (originalStyleSheets) Object.defineProperty(document, 'styleSheets', originalStyleSheets);
    else Reflect.deleteProperty(document, 'styleSheets');
  });

  test('refreshes adopted stylesheet media through the CSSOM invalidation hook', async () => {
    const originalMatchMedia = window.matchMedia;
    const observedQueries: string[] = [];
    window.matchMedia = (query: string) => {
      observedQueries.push(query);
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
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });
    const mountPoint = document.createElement('div');
    shadow.append(mountPoint);
    document.body.append(host);
    Object.defineProperty(shadow, 'adoptedStyleSheets', {
      configurable: true,
      value: [],
    });
    render(Portal, { target: mountPoint, props: { children: childSnippet } });
    await tick();

    Object.defineProperty(shadow, 'adoptedStyleSheets', {
      configurable: true,
      value: [{ media: { mediaText: '(prefers-contrast: more)' }, cssRules: [] }],
    });
    invalidatePortalDirection();

    expect(observedQueries).toContain('(prefers-contrast: more)');
    window.matchMedia = originalMatchMedia;
  });

  test('refreshes direction and media inventory when live style text changes', async () => {
    const style = document.createElement('style');
    style.textContent = '.direction { direction: ltr; }';
    document.head.append(style);
    const source = document.createElement('div');
    const mountPoint = document.createElement('div');
    source.append(mountPoint);
    document.body.append(source);
    const nativeGetComputedStyle = globalThis.getComputedStyle;
    const originalMatchMedia = window.matchMedia;
    const observedQueries: string[] = [];
    window.matchMedia = (query: string) => {
      observedQueries.push(query);
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
    Object.defineProperty(globalThis, 'getComputedStyle', {
      configurable: true,
      value: (element: Element) => {
        let computed = nativeGetComputedStyle(element);
        if (element === mountPoint) {
          computed = withComputedDirection(
            computed,
            style.textContent?.includes('rtl') ? 'rtl' : 'ltr',
          );
        }
        return computed;
      },
    });

    render(Portal, { target: mountPoint, props: { children: childSnippet } });
    await tick();
    const wrapper = document.body.querySelector('[data-testid="portal-child"]')?.parentElement;
    expect(wrapper?.getAttribute('dir')).toBe('ltr');

    style.firstChild!.textContent =
      '@media (prefers-contrast: more) { .direction { direction: rtl; } }';
    await waitFor(() => expect(wrapper?.getAttribute('dir')).toBe('rtl'));
    expect(observedQueries).toContain('(prefers-contrast: more)');
    window.matchMedia = originalMatchMedia;
  });
});
