import { describe, expect, test } from 'bun:test';

import {
  createCssRule,
  createStyleRule,
  withComputedDirection,
  withDocumentStyleSheets,
} from './text-direction-test-helpers.ts';
import { resolveTextDirection } from './text-direction.ts';

describe('resolveTextDirection', () => {
  test('keeps nested scope limits local to their enclosing root', () => {
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
    const root = document.createElement('div');
    root.className = 'inner';
    const limit = document.createElement('div');
    limit.className = 'stop';
    const target = document.createElement('div');
    target.className = 'shell';
    limit.append(target);
    root.append(limit);
    outer.append(root);
    document.body.append(outer);
    const innerScope = createCssRule({
      type: 0,
      cssText: '@scope (.inner) to (.stop) {}',
      cssRules: [createStyleRule({ selectorText: '.shell', direction: 'ltr' })],
    });
    const outerScope = createCssRule({
      type: 0,
      cssText: '@scope (.outer) {}',
      cssRules: [innerScope],
    });
    try {
      expect(
        withDocumentStyleSheets([{ cssRules: [outerScope] }], () =>
          resolveTextDirection(target, 'rtl'),
        ),
      ).toBe('rtl');
    } finally {
      window.getComputedStyle = originalWindowGetComputedStyle;
      globalThis.getComputedStyle = originalGlobalGetComputedStyle;
    }
  });

  test('does not apply a scope limit that is outside the matched scope root', () => {
    const originalWindowGetComputedStyle = window.getComputedStyle;
    const originalGlobalGetComputedStyle = globalThis.getComputedStyle;
    const getComputedStyleOverride = ((target: Element) => {
      let style = originalWindowGetComputedStyle(target);
      style = withComputedDirection(style, 'ltr');
      return style;
    }) as typeof window.getComputedStyle;
    window.getComputedStyle = getComputedStyleOverride;
    globalThis.getComputedStyle = getComputedStyleOverride;
    const styleRule = createStyleRule({ selectorText: '.shell', direction: 'ltr' });
    const outer = document.createElement('section');
    outer.className = 'stop';
    const root = document.createElement('div');
    root.className = 'theme';
    const element = document.createElement('div');
    element.className = 'shell';
    root.append(element);
    outer.append(root);
    document.body.append(outer);
    const scopeRule = createCssRule({
      type: 0,
      cssText: '@scope (.theme) to (.stop) {}',
      cssRules: [styleRule],
    });
    try {
      expect(
        withDocumentStyleSheets([{ cssRules: [scopeRule] }], () =>
          resolveTextDirection(element, 'rtl'),
        ),
      ).toBe('ltr');
    } finally {
      window.getComputedStyle = originalWindowGetComputedStyle;
      globalThis.getComputedStyle = originalGlobalGetComputedStyle;
    }
  });

  test('keeps a scope active when a later root candidate is not limited', () => {
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
    const limit = document.createElement('div');
    limit.className = 'limit';
    const inner = document.createElement('div');
    inner.className = 'inner';
    const element = document.createElement('div');
    element.className = 'shell';
    inner.append(element);
    limit.append(inner);
    outer.append(limit);
    document.body.append(outer);
    const styleRule = createStyleRule({ selectorText: '.shell', direction: 'ltr' });
    const scopeRules = ['.inner, .outer', '.outer, .inner'].map((roots) =>
      createCssRule({
        type: 0,
        cssText: `@scope (${roots}) to (.limit) {}`,
        cssRules: [styleRule],
      }),
    );
    try {
      for (const scopeRule of scopeRules) {
        expect(
          withDocumentStyleSheets([{ cssRules: [scopeRule] }], () =>
            resolveTextDirection(element, 'rtl'),
          ),
        ).toBe('ltr');
      }
    } finally {
      window.getComputedStyle = originalWindowGetComputedStyle;
      globalThis.getComputedStyle = originalGlobalGetComputedStyle;
    }
  });

  test('evaluates scope limits independently of selector-list order', () => {
    const originalWindowGetComputedStyle = window.getComputedStyle;
    const originalGlobalGetComputedStyle = globalThis.getComputedStyle;
    const getComputedStyleOverride = ((target: Element) => {
      let style = originalWindowGetComputedStyle(target);
      style = withComputedDirection(style, 'ltr');
      return style;
    }) as typeof window.getComputedStyle;
    window.getComputedStyle = getComputedStyleOverride;
    globalThis.getComputedStyle = getComputedStyleOverride;
    const above = document.createElement('div');
    above.className = 'above';
    const root = document.createElement('div');
    root.className = 'root';
    const element = document.createElement('div');
    element.className = 'shell';
    root.append(element);
    above.append(root);
    document.body.append(above);
    const styleRule = createStyleRule({ selectorText: '.shell', direction: 'ltr' });
    const scopeRules = ['.above, .root', '.root, .above'].flatMap((roots) =>
      ['.above, .missing', '.missing, .above'].map((limits) =>
        createCssRule({
          type: 0,
          cssText: `@scope (${roots}) to (${limits}) {}`,
          cssRules: [styleRule],
        }),
      ),
    );
    try {
      for (const scopeRule of scopeRules) {
        expect(
          withDocumentStyleSheets([{ cssRules: [scopeRule] }], () =>
            resolveTextDirection(element, 'rtl'),
          ),
        ).toBe('ltr');
      }
    } finally {
      window.getComputedStyle = originalWindowGetComputedStyle;
      globalThis.getComputedStyle = originalGlobalGetComputedStyle;
    }
  });

  test('keeps commas inside scope selector syntax intact', () => {
    const originalWindowGetComputedStyle = window.getComputedStyle;
    const originalGlobalGetComputedStyle = globalThis.getComputedStyle;
    const getComputedStyleOverride = ((target: Element) => {
      let style = originalWindowGetComputedStyle(target);
      style = withComputedDirection(style, 'ltr');
      return style;
    }) as typeof window.getComputedStyle;
    window.getComputedStyle = getComputedStyleOverride;
    globalThis.getComputedStyle = getComputedStyleOverride;
    const styleRule = createStyleRule({ selectorText: '.shell', direction: 'ltr' });
    const root = document.createElement('div');
    root.setAttribute('data-scope', 'a,b');
    const element = document.createElement('div');
    element.className = 'shell';
    root.append(element);
    document.body.append(root);
    const scopeRule = createCssRule({
      type: 0,
      cssText: '@scope ([data-scope="a\\,b"]) {}',
      cssRules: [styleRule],
    });
    try {
      expect(
        withDocumentStyleSheets([{ cssRules: [scopeRule] }], () =>
          resolveTextDirection(element, 'rtl'),
        ),
      ).toBe('ltr');
    } finally {
      window.getComputedStyle = originalWindowGetComputedStyle;
      globalThis.getComputedStyle = originalGlobalGetComputedStyle;
    }
  });
});
