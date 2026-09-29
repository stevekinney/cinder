import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { tick } from 'svelte';

import {
  childSnippet,
  Portal,
  render,
  restorePortalGlobalState,
  waitFor,
  withComputedDirection,
} from './portal-test-helpers.ts';

beforeEach(() => document.body.replaceChildren());
afterEach(restorePortalGlobalState);

describe('Portal', () => {
  test('refreshes media inventory for stylesheets nested in inserted subtrees', async () => {
    const originalStyleSheets = Object.getOwnPropertyDescriptor(document, 'styleSheets');
    const originalMatchMedia = window.matchMedia;
    const observedQueries: string[] = [];
    const removedQueries: string[] = [];
    const stylesheetContainer = document.createElement('div');
    stylesheetContainer.append(document.createElement('style'));
    Object.defineProperty(document, 'styleSheets', {
      configurable: true,
      get: () =>
        stylesheetContainer.isConnected
          ? [{ media: { mediaText: '(prefers-reduced-transparency: reduce)' }, cssRules: [] }]
          : [],
    });
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
    const mountPoint = document.createElement('div');
    document.body.append(mountPoint);
    render(Portal, { target: mountPoint, props: { children: childSnippet } });
    await tick();

    document.body.append(stylesheetContainer);
    await waitFor(() =>
      expect(observedQueries).toContain('(prefers-reduced-transparency: reduce)'),
    );
    stylesheetContainer.remove();
    await waitFor(() => expect(removedQueries).toContain('(prefers-reduced-transparency: reduce)'));

    window.matchMedia = originalMatchMedia;
    if (originalStyleSheets) Object.defineProperty(document, 'styleSheets', originalStyleSheets);
    else Reflect.deleteProperty(document, 'styleSheets');
  });

  test('does not refresh media inventory for non-stylesheet links', async () => {
    const originalStyleSheets = Object.getOwnPropertyDescriptor(document, 'styleSheets');
    const originalMatchMedia = window.matchMedia;
    const removedQueries: string[] = [];
    let exposeMediaQuery = true;
    Object.defineProperty(document, 'styleSheets', {
      configurable: true,
      get: () =>
        exposeMediaQuery
          ? [{ media: { mediaText: '(prefers-reduced-transparency: reduce)' }, cssRules: [] }]
          : [],
    });
    window.matchMedia = (query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => removedQueries.push(query),
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => true,
      }) as MediaQueryList;
    const mountPoint = document.createElement('div');
    document.body.append(mountPoint);
    render(Portal, { target: mountPoint, props: { children: childSnippet } });
    await tick();

    exposeMediaQuery = false;
    const iconLink = document.createElement('link');
    iconLink.rel = 'icon';
    document.head.append(iconLink);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(removedQueries).not.toContain('(prefers-reduced-transparency: reduce)');
    window.matchMedia = originalMatchMedia;
    if (originalStyleSheets) Object.defineProperty(document, 'styleSheets', originalStyleSheets);
    else Reflect.deleteProperty(document, 'styleSheets');
  });

  test('refreshes media inventory after a shadow-root stylesheet loads', async () => {
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
    const stylesheetLink = document.createElement('link');
    stylesheetLink.rel = 'stylesheet';
    const loadListener: { current: EventListener | null } = { current: null };
    const nativeAddEventListener = shadow.addEventListener.bind(shadow);
    shadow.addEventListener = ((
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | AddEventListenerOptions,
    ) => {
      if (type === 'load' && typeof listener === 'function') loadListener.current = listener;
      nativeAddEventListener(type, listener, options);
    }) as typeof shadow.addEventListener;
    const mountPoint = document.createElement('div');
    shadow.append(stylesheetLink, mountPoint);
    document.body.append(host);
    let loaded = false;
    Object.defineProperty(shadow, 'styleSheets', {
      configurable: true,
      get: () =>
        loaded ? [{ media: { mediaText: '(prefers-contrast: more)' }, cssRules: [] }] : [],
    });

    render(Portal, { target: mountPoint, props: { children: childSnippet } });
    await tick();
    expect(observedQueries).not.toContain('(prefers-contrast: more)');

    loaded = true;
    expect(loadListener.current).not.toBeNull();
    const loadEvent = new Event('load');
    Object.defineProperty(loadEvent, 'target', { configurable: true, value: stylesheetLink });
    loadListener.current?.call(shadow, loadEvent);
    await waitFor(() => expect(observedQueries).toContain('(prefers-contrast: more)'));
    window.matchMedia = originalMatchMedia;
  });

  test('invalidates direction on pointer transitions', async () => {
    const source = document.createElement('div');
    const mountPoint = document.createElement('div');
    source.append(mountPoint);
    document.body.append(source);
    let direction: 'ltr' | 'rtl' = 'ltr';
    const nativeGetComputedStyle = globalThis.getComputedStyle;
    Object.defineProperty(globalThis, 'getComputedStyle', {
      configurable: true,
      value: (element: Element) => {
        let computed = nativeGetComputedStyle(element);
        if (element === mountPoint) computed = withComputedDirection(computed, direction);
        return computed;
      },
    });

    render(Portal, { target: mountPoint, props: { children: childSnippet } });
    await tick();
    const wrapper = document.body.querySelector('[data-testid="portal-child"]')?.parentElement;
    expect(wrapper?.getAttribute('dir')).toBe('ltr');

    direction = 'rtl';
    document.dispatchEvent(new Event('pointerdown'));
    await waitFor(() => expect(wrapper?.getAttribute('dir')).toBe('rtl'));

    direction = 'ltr';
    document.dispatchEvent(new Event('pointerup'));
    await waitFor(() => expect(wrapper?.getAttribute('dir')).toBe('ltr'));
  });

  test('invalidates direction when the fragment target changes', async () => {
    const source = document.createElement('div');
    const mountPoint = document.createElement('div');
    source.append(mountPoint);
    document.body.append(source);
    let direction: 'ltr' | 'rtl' = 'ltr';
    const nativeGetComputedStyle = globalThis.getComputedStyle;
    Object.defineProperty(globalThis, 'getComputedStyle', {
      configurable: true,
      value: (element: Element) => {
        let computed = nativeGetComputedStyle(element);
        if (element === mountPoint) computed = withComputedDirection(computed, direction);
        return computed;
      },
    });

    render(Portal, { target: mountPoint, props: { children: childSnippet } });
    await tick();
    const wrapper = document.body.querySelector('[data-testid="portal-child"]')?.parentElement;
    expect(wrapper?.getAttribute('dir')).toBe('ltr');

    direction = 'rtl';
    window.dispatchEvent(new Event('hashchange'));
    await waitFor(() => expect(wrapper?.getAttribute('dir')).toBe('rtl'));
  });
});
