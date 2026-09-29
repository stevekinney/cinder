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

function restoreStyleSheets(descriptor: PropertyDescriptor | undefined): void {
  if (descriptor) Object.defineProperty(document, 'styleSheets', descriptor);
  else Reflect.deleteProperty(document, 'styleSheets');
}

function installComputedStyleOverride(
  mountPoint: Element,
  nativeGetComputedStyle: typeof globalThis.getComputedStyle,
): void {
  Object.defineProperty(globalThis, 'getComputedStyle', {
    configurable: true,
    value: (element: Element) =>
      element === mountPoint
        ? withComputedDirection(nativeGetComputedStyle(element), 'ltr')
        : nativeGetComputedStyle(element),
  });
}

function assertPortalAttributes(
  wrapper: Element | null | undefined,
  expected: { dir?: string; lang: string; theme: string; cinderTheme?: string },
): void {
  if (expected.dir !== undefined) expect(wrapper?.getAttribute('dir')).toBe(expected.dir);
  expect(wrapper?.getAttribute('lang')).toBe(expected.lang);
  expect(wrapper?.getAttribute('data-theme')).toBe(expected.theme);
  if (expected.cinderTheme !== undefined) {
    expect(wrapper?.getAttribute('data-cinder-theme')).toBe(expected.cinderTheme);
  }
}

describe('Portal', () => {
  test('invalidates and releases shadow-root state event listeners', async () => {
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });
    const mountPoint = document.createElement('div');
    shadow.append(mountPoint);
    document.body.append(host);
    const toggleListener: { current: EventListener | null } = { current: null };
    let removedToggleListeners = 0;
    const nativeAddEventListener = shadow.addEventListener.bind(shadow);
    const nativeRemoveEventListener = shadow.removeEventListener.bind(shadow);
    shadow.addEventListener = ((
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | AddEventListenerOptions,
    ) => {
      if (type === 'toggle' && typeof listener === 'function') toggleListener.current = listener;
      nativeAddEventListener(type, listener, options);
    }) as typeof shadow.addEventListener;
    shadow.removeEventListener = ((
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | EventListenerOptions,
    ) => {
      if (type === 'toggle' && listener === toggleListener.current) removedToggleListeners += 1;
      nativeRemoveEventListener(type, listener, options);
    }) as typeof shadow.removeEventListener;
    let direction: 'ltr' | 'rtl' = 'ltr';
    const nativeGetComputedStyle = globalThis.getComputedStyle;
    Object.defineProperty(globalThis, 'getComputedStyle', {
      configurable: true,
      value: (element: Element) => {
        let computed = nativeGetComputedStyle(element);
        if (element === mountPoint) {
          computed = withComputedDirection(computed, direction);
        }
        return computed;
      },
    });

    const view = render(Portal, { target: mountPoint, props: { children: childSnippet } });
    await tick();
    const wrapper = document.body.querySelector('[data-testid="portal-child"]')?.parentElement;
    expect(wrapper?.getAttribute('dir')).toBe('ltr');
    expect(toggleListener.current).not.toBeNull();

    direction = 'rtl';
    const toggleEvent = new Event('toggle');
    Object.defineProperty(toggleEvent, 'target', { configurable: true, value: mountPoint });
    toggleListener.current?.call(shadow, toggleEvent);
    await waitFor(() => expect(wrapper?.getAttribute('dir')).toBe('rtl'));
    view.unmount();
    expect(removedToggleListeners).toBe(1);
  });

  test('rebinds shadow-root and ancestor observers when the source moves', async () => {
    const originalStyleSheets = Object.getOwnPropertyDescriptor(document, 'styleSheets');
    const originalMatchMedia = window.matchMedia;
    const observedQueries: string[] = [];
    Object.defineProperty(document, 'styleSheets', {
      configurable: true,
      value: [{ media: { mediaText: '(min-width: 1px)' }, cssRules: [] }],
    });
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });
    Object.defineProperty(shadow, 'styleSheets', {
      configurable: true,
      value: [{ media: { mediaText: '(max-width: 1px)' }, cssRules: [] }],
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
    const oldAncestor = document.createElement('div');
    oldAncestor.setAttribute('dir', 'ltr');
    oldAncestor.setAttribute('lang', 'en');
    oldAncestor.setAttribute('data-theme', 'old-theme');
    host.setAttribute('dir', 'auto');
    host.setAttribute('lang', 'ar');
    host.setAttribute('data-theme', 'new-theme');
    const source = document.createElement('div');
    const mountPoint = document.createElement('div');
    source.append(mountPoint);
    oldAncestor.append(source);
    document.body.append(oldAncestor, host);
    const nativeGetComputedStyle = globalThis.getComputedStyle;
    installComputedStyleOverride(mountPoint, nativeGetComputedStyle);

    render(Portal, { target: mountPoint, props: { children: childSnippet } });
    await tick();
    const wrapper = document.body.querySelector('[data-testid="portal-child"]')?.parentElement;
    assertPortalAttributes(wrapper, { dir: 'ltr', lang: 'en', theme: 'old-theme' });

    shadow.append(source);
    await waitFor(() => expect(wrapper?.getAttribute('dir')).toBe('auto'));
    assertPortalAttributes(wrapper, { lang: 'ar', theme: 'new-theme' });
    expect(observedQueries).toContain('(max-width: 1px)');

    host.setAttribute('lang', 'he');
    host.setAttribute('data-theme', 'updated-theme');
    host.setAttribute('data-cinder-theme', 'contrast');
    await waitFor(() => expect(wrapper?.getAttribute('lang')).toBe('he'));
    assertPortalAttributes(wrapper, {
      lang: 'he',
      theme: 'updated-theme',
      cinderTheme: 'contrast',
    });

    oldAncestor.setAttribute('lang', 'stale');
    oldAncestor.setAttribute('data-theme', 'stale-theme');
    await tick();
    assertPortalAttributes(wrapper, { lang: 'he', theme: 'updated-theme' });

    window.matchMedia = originalMatchMedia;
    restoreStyleSheets(originalStyleSheets);
  });

  test('observes direction invalidations inside a shadow root', async () => {
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });
    const source = document.createElement('div');
    const mountPoint = document.createElement('div');
    const sibling = document.createElement('div');
    source.append(mountPoint);
    shadow.append(sibling, source);
    document.body.append(host);
    const nativeGetComputedStyle = globalThis.getComputedStyle;
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
  });

  test('invalidates direction for arbitrary selector attributes', async () => {
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
    source.setAttribute('data-locale', 'ar');
    await waitFor(() => expect(wrapper?.getAttribute('dir')).toBe('rtl'));
  });

  test('mounts without computed-style observation when getComputedStyle is unavailable', async () => {
    Object.defineProperty(globalThis, 'getComputedStyle', {
      configurable: true,
      value: undefined,
    });

    render(Portal, { props: { children: childSnippet } });
    await tick();

    expect(document.body.querySelector('[data-testid="portal-child"]')).not.toBeNull();
  });
});
