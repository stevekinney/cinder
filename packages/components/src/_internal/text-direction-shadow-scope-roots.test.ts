import { describe, expect, test } from 'bun:test';

import {
  createCssRule,
  createStyleRule,
  withComputedDirection,
  withDocumentStyleSheets,
} from './text-direction-test-helpers.ts';
import { resolveTextDirection } from './text-direction.ts';

describe('resolveTextDirection', () => {
  test('uses the target shadow root for ownerless adopted stylesheets', () => {
    const originalWindowGetComputedStyle = window.getComputedStyle;
    const originalGlobalGetComputedStyle = globalThis.getComputedStyle;
    const getComputedStyleOverride = ((target: Element) => {
      let style = originalWindowGetComputedStyle(target);
      style = withComputedDirection(style, 'ltr');
      return style;
    }) as typeof window.getComputedStyle;
    window.getComputedStyle = getComputedStyleOverride;
    globalThis.getComputedStyle = getComputedStyleOverride;
    const host = document.createElement('div');
    const shadowRoot = host.attachShadow({ mode: 'open' });
    const target = document.createElement('div');
    target.className = 'shell';
    shadowRoot.append(target);
    document.body.append(host);
    const scopeRule = createCssRule({
      type: 0,
      cssText: '@scope {}',
      cssRules: [createStyleRule({ selectorText: '.shell', direction: 'ltr' })],
    });
    try {
      expect(
        withDocumentStyleSheets([{ cssRules: [scopeRule] }], () =>
          resolveTextDirection(target, 'rtl'),
        ),
      ).toBe('rtl');
    } finally {
      window.getComputedStyle = originalWindowGetComputedStyle;
      globalThis.getComputedStyle = originalGlobalGetComputedStyle;
    }
  });

  test('fails closed for relative selectors when the implicit scope is a shadow root', () => {
    const originalWindowGetComputedStyle = window.getComputedStyle;
    const originalGlobalGetComputedStyle = globalThis.getComputedStyle;
    const getComputedStyleOverride = ((target: Element) => {
      let style = originalWindowGetComputedStyle(target);
      style = withComputedDirection(style, 'ltr');
      return style;
    }) as typeof window.getComputedStyle;
    window.getComputedStyle = getComputedStyleOverride;
    globalThis.getComputedStyle = getComputedStyleOverride;
    const host = document.createElement('div');
    const shadowRoot = host.attachShadow({ mode: 'open' });
    const styleElement = document.createElement('style');
    const target = document.createElement('div');
    target.className = 'shell';
    shadowRoot.append(styleElement, target);
    document.body.append(host);
    const scopeRule = createCssRule({
      type: 0,
      cssText: '@scope {}',
      cssRules: [createStyleRule({ selectorText: ':scope > .shell', direction: 'ltr' })],
    });
    try {
      expect(
        withDocumentStyleSheets([{ cssRules: [scopeRule], ownerNode: styleElement }], () =>
          resolveTextDirection(target, 'rtl'),
        ),
      ).toBe('ltr');
    } finally {
      window.getComputedStyle = originalWindowGetComputedStyle;
      globalThis.getComputedStyle = originalGlobalGetComputedStyle;
    }
  });

  test('does not let a shadow clone wrapper satisfy root qualifiers', () => {
    const host = document.createElement('div');
    const shadowRoot = host.attachShadow({ mode: 'open' });
    const target = document.createElement('div');
    target.className = 'shell';
    shadowRoot.append(target);
    document.body.append(host);
    const scopeRule = createCssRule({
      type: 0,
      cssText: '@scope {}',
      cssRules: [createStyleRule({ selectorText: ':scope:is(div) > .shell', direction: 'ltr' })],
    });
    expect(
      withDocumentStyleSheets([{ cssRules: [scopeRule] }], () =>
        resolveTextDirection(target, 'rtl'),
      ),
    ).toBe('rtl');
  });

  test('evaluates :scope limits relative to the active scope root', () => {
    const originalWindowGetComputedStyle = window.getComputedStyle;
    const originalGlobalGetComputedStyle = globalThis.getComputedStyle;
    const getComputedStyleOverride = ((target: Element) => {
      let style = originalWindowGetComputedStyle(target);
      style = withComputedDirection(style, 'ltr');
      return style;
    }) as typeof window.getComputedStyle;
    window.getComputedStyle = getComputedStyleOverride;
    globalThis.getComputedStyle = getComputedStyleOverride;
    const root = document.createElement('section');
    root.className = 'theme';
    const stop = document.createElement('div');
    stop.className = 'stop';
    const target = document.createElement('div');
    target.className = 'shell';
    stop.append(target);
    root.append(stop);
    document.body.append(root);
    const scopeRule = createCssRule({
      type: 0,
      cssText: '@scope (.theme) to (:scope > .stop) {}',
      cssRules: [createStyleRule({ selectorText: '.shell', direction: 'ltr' })],
    });
    try {
      expect(
        withDocumentStyleSheets([{ cssRules: [scopeRule] }], () =>
          resolveTextDirection(target, 'rtl'),
        ),
      ).toBe('rtl');
    } finally {
      window.getComputedStyle = originalWindowGetComputedStyle;
      globalThis.getComputedStyle = originalGlobalGetComputedStyle;
    }
  });

  test('resolves outside-ancestor context in a :scope limit selector', () => {
    // Limit selectors are evaluated through the same `matchesScopedSelector`
    // as rule selectors, so the outside-ancestor-context fix applies here
    // too: `to (main :scope > .stop)` requires the scope root to actually
    // have a `main` ancestor before the `.stop` boundary can be recognized.
    // Losing that outside context (as the clone-only fallback previously
    // did) would make the limit unrecognizable and leave the scope
    // active past its real boundary — the unsafe direction for a limit,
    // since a limit that never triggers over-applies the scope's rules
    // rather than under-applying them.
    const main = document.createElement('main');
    const root = document.createElement('section');
    root.className = 'theme';
    const stop = document.createElement('div');
    stop.className = 'stop';
    const target = document.createElement('div');
    target.className = 'shell';
    stop.append(target);
    root.append(stop);
    main.append(root);
    document.body.append(main);
    const scopeRule = createCssRule({
      type: 0,
      cssText: '@scope (.theme) to (main :scope > .stop) {}',
      cssRules: [createStyleRule({ selectorText: '.shell', direction: 'ltr' })],
    });
    expect(
      withDocumentStyleSheets([{ cssRules: [scopeRule] }], () =>
        resolveTextDirection(target, 'rtl'),
      ),
    ).toBe('rtl');
  });
  test('requires nested scopes to intersect every enclosing scope', () => {
    const originalWindowGetComputedStyle = window.getComputedStyle;
    const originalGlobalGetComputedStyle = globalThis.getComputedStyle;
    const getComputedStyleOverride = ((target: Element) => {
      let style = originalWindowGetComputedStyle(target);
      style = withComputedDirection(style, 'ltr');
      return style;
    }) as typeof window.getComputedStyle;
    window.getComputedStyle = getComputedStyleOverride;
    globalThis.getComputedStyle = getComputedStyleOverride;
    const outer = document.createElement('section');
    outer.className = 'outer';
    const inside = document.createElement('div');
    inside.className = 'inner';
    const insideTarget = document.createElement('div');
    insideTarget.className = 'shell';
    inside.append(insideTarget);
    outer.append(inside);
    const outside = document.createElement('section');
    const outsideInner = document.createElement('div');
    outsideInner.className = 'inner';
    const outsideTarget = document.createElement('div');
    outsideTarget.className = 'shell';
    outsideInner.append(outsideTarget);
    outside.append(outsideInner);
    document.body.append(outer, outside);
    const nestedScope = createCssRule({
      type: 0,
      cssText: '@scope (.inner) {}',
      cssRules: [createStyleRule({ selectorText: '.shell', direction: 'ltr' })],
    });
    const outerScope = createCssRule({
      type: 0,
      cssText: '@scope (.outer) {}',
      cssRules: [nestedScope],
    });
    try {
      expect(
        withDocumentStyleSheets([{ cssRules: [outerScope] }], () =>
          resolveTextDirection(insideTarget, 'rtl'),
        ),
      ).toBe('ltr');
      expect(
        withDocumentStyleSheets([{ cssRules: [outerScope] }], () =>
          resolveTextDirection(outsideTarget, 'rtl'),
        ),
      ).toBe('rtl');
    } finally {
      window.getComputedStyle = originalWindowGetComputedStyle;
      globalThis.getComputedStyle = originalGlobalGetComputedStyle;
    }
  });
});
