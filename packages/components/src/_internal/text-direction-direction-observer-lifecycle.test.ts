import { describe, expect, test } from 'bun:test';

import {
  createCssRule,
  createMediaQueryList,
  withDocumentStyleSheets,
} from './text-direction-test-helpers.ts';
import {
  observeTextDirection,
  observeTextDirectionMediaQueries,
  resolveTextDirection,
} from './text-direction.ts';

describe('resolveTextDirection', () => {
  test('collects media queries from a <style> element inside a shadow root', () => {
    // The shadow-root branch also iterates `root.adoptedStyleSheets` (not
    // exercised by this test, since none are constructed here); this
    // specifically exercises the sibling `<style>`/`<link>` querySelectorAll
    // loop, which walks elements adoptedStyleSheets alone would miss.
    const originalMatchMedia = globalThis.matchMedia;
    const listeners = new Set<EventListener>();
    let activeListenerCount = 0;
    const host = document.createElement('div');
    const shadowRoot = host.attachShadow({ mode: 'open' });
    const styleElement = document.createElement('style');
    shadowRoot.append(styleElement);
    const element = document.createElement('div');
    shadowRoot.append(element);
    document.body.append(host);

    const mediaRule = createCssRule({
      cssText: '@media (prefers-color-scheme: dark) {}',
      type: 4,
      conditionText: '(prefers-color-scheme: dark)',
      cssRules: [],
    });
    Object.defineProperty(styleElement, 'sheet', {
      configurable: true,
      get: () => ({ cssRules: [mediaRule] }),
    });

    globalThis.matchMedia = (query: string) =>
      createMediaQueryList(
        query,
        false,
        listeners,
        () => {
          activeListenerCount += 1;
        },
        () => {
          activeListenerCount -= 1;
        },
      );

    try {
      const disconnect = withDocumentStyleSheets([], () =>
        observeTextDirectionMediaQueries(element, () => {}),
      );
      expect(activeListenerCount).toBe(1);
      disconnect?.();
      expect(activeListenerCount).toBe(0);
    } finally {
      globalThis.matchMedia = originalMatchMedia;
      host.remove();
    }
  });
  test('ignores an import rule whose styleSheet cannot be read, without aborting the sheet scan', () => {
    // Distinct from matchesDirectionStyleRuleList's own @import catch: this
    // is observeTextDirectionMediaQueries's independent rule visitor, which
    // walks the WHOLE sheet collecting media conditions rather than
    // matching a direction rule. A rule after the inaccessible import must
    // still be visited.
    const originalMatchMedia = globalThis.matchMedia;
    const listeners = new Set<EventListener>();
    let activeListenerCount = 0;
    const throwingImportRule = createCssRule({
      type: 3,
      cssText: '@import url("blocked.css");',
    });
    Object.defineProperty(throwingImportRule, 'styleSheet', {
      configurable: true,
      get(): CSSStyleSheet {
        throw new Error('cross-origin styleSheet access denied');
      },
    });
    const mediaRule = createCssRule({
      cssText: '@media (prefers-reduced-motion: reduce) {}',
      type: 4,
      conditionText: '(prefers-reduced-motion: reduce)',
      cssRules: [],
    });
    globalThis.matchMedia = (query: string) =>
      createMediaQueryList(
        query,
        false,
        listeners,
        () => {
          activeListenerCount += 1;
        },
        () => {
          activeListenerCount -= 1;
        },
      );
    const element = document.createElement('div');
    document.body.append(element);

    try {
      const disconnect = withDocumentStyleSheets(
        [{ cssRules: [throwingImportRule, mediaRule] }],
        () => observeTextDirectionMediaQueries(element, () => {}),
      );
      expect(activeListenerCount).toBe(1);
      disconnect?.();
      expect(activeListenerCount).toBe(0);
    } finally {
      globalThis.matchMedia = originalMatchMedia;
      element.remove();
    }
  });

  test('observes text mutations under auto direction sources', async () => {
    const wrapper = document.createElement('section');
    wrapper.dir = 'auto';
    wrapper.textContent = 'Schedule';
    const element = document.createElement('div');
    wrapper.appendChild(element);
    document.body.appendChild(wrapper);

    let changes = 0;
    const disconnect = observeTextDirection(element, () => {
      changes += 1;
    });

    wrapper.firstChild!.textContent = 'جدول';
    await new Promise((resolve) => setTimeout(resolve, 0));
    disconnect?.();

    expect(changes).toBeGreaterThan(0);
  });

  test('observes direction attribute changes along the ancestor chain', async () => {
    const wrapper = document.createElement('section');
    const element = document.createElement('div');
    wrapper.appendChild(element);
    document.body.appendChild(wrapper);

    let changes = 0;
    const disconnect = observeTextDirection(element, () => {
      changes += 1;
    });

    wrapper.dir = 'rtl';
    await new Promise((resolve) => setTimeout(resolve, 0));
    disconnect?.();

    expect(changes).toBeGreaterThan(0);
  });

  test('observes ancestor attribute changes beyond dir, class, and style', async () => {
    // A selector can key its `direction` styling off any ancestor attribute
    // (e.g. `[data-flow='rtl']`), not only `dir`, `class`, or `style`, so the
    // observer must not filter those out.
    const wrapper = document.createElement('section');
    const element = document.createElement('div');
    wrapper.appendChild(element);
    document.body.appendChild(wrapper);

    let changes = 0;
    const disconnect = observeTextDirection(element, () => {
      changes += 1;
    });

    wrapper.setAttribute('data-flow', 'rtl');
    await new Promise((resolve) => setTimeout(resolve, 0));
    disconnect?.();

    expect(changes).toBeGreaterThan(0);
  });

  test('rebuilds direction observers after reparenting', async () => {
    const oldParent = document.createElement('section');
    oldParent.dir = 'ltr';
    const newParent = document.createElement('section');
    newParent.dir = 'rtl';
    const element = document.createElement('div');
    oldParent.append(element);
    document.body.append(oldParent, newParent);

    let changes = 0;
    const disconnect = observeTextDirection(element, () => {
      changes += 1;
    });
    newParent.append(element);
    await new Promise((resolve) => setTimeout(resolve, 0));
    disconnect?.();

    expect(changes).toBeGreaterThan(0);
    expect(resolveTextDirection(element)).toBe('rtl');
  });

  test('does not observe a missing element', () => {
    expect(observeTextDirection(null, () => {})).toBeUndefined();
  });
  test('prefers an ancestor class style over a generated element direction', () => {
    const styleElement = document.createElement('style');
    styleElement.textContent = '.ancestor-ltr { direction: ltr; }';
    document.head.append(styleElement);
    const wrapper = document.createElement('div');
    wrapper.dir = 'rtl';
    wrapper.className = 'ancestor-ltr';
    const element = document.createElement('div');
    element.dir = 'rtl';
    wrapper.append(element);
    document.body.append(wrapper);

    expect(resolveTextDirection(element, 'rtl', { ignoreElementDirectionAttribute: true })).toBe(
      'ltr',
    );
    styleElement.remove();
  });
});
