import { describe, expect, test } from 'bun:test';

import {
  createCssRule,
  createStyleRule,
  withComputedDirection,
  withDocumentStyleSheets,
} from './text-direction-test-helpers.ts';
import { resolveTextDirection } from './text-direction.ts';

describe('resolveTextDirection', () => {
  test('binds relative selectors to the innermost scope and recognizes scope tokens safely', () => {
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
    const inner = document.createElement('div');
    inner.className = 'inner';
    const target = document.createElement('div');
    target.className = 'shell';
    target.setAttribute('data-value', ':scope');
    inner.append(target);
    outer.append(inner);
    document.body.append(outer);
    const nestedScope = createCssRule({
      type: 0,
      cssText: '@scope (.inner) {}',
      cssRules: [createStyleRule({ selectorText: ':SCOPE > .inner > .shell', direction: 'ltr' })],
    });
    const outerScope = createCssRule({
      type: 0,
      cssText: '@scope (.outer) {}',
      cssRules: [nestedScope],
    });
    const attributeRule = createCssRule({
      type: 0,
      cssText: '@scope (.outer) {}',
      cssRules: [createStyleRule({ selectorText: '[data-value=":scope"]', direction: 'ltr' })],
    });
    try {
      expect(
        withDocumentStyleSheets([{ cssRules: [outerScope] }], () =>
          resolveTextDirection(target, 'rtl'),
        ),
      ).toBe('rtl');
      expect(
        withDocumentStyleSheets([{ cssRules: [attributeRule] }], () =>
          resolveTextDirection(target, 'rtl'),
        ),
      ).toBe('ltr');
    } finally {
      window.getComputedStyle = originalWindowGetComputedStyle;
      globalThis.getComputedStyle = originalGlobalGetComputedStyle;
    }
  });
  test('preserves quoted :scope text when replacing the pseudo-class', () => {
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
    const target = document.createElement('div');
    target.setAttribute('data-value', ':scope');
    root.append(target);
    document.body.append(root);
    const scopeRule = createCssRule({
      type: 0,
      cssText: '@scope (.theme) {}',
      cssRules: [
        createStyleRule({ selectorText: ':scope [data-value=":scope"]', direction: 'ltr' }),
      ],
    });
    try {
      expect(
        withDocumentStyleSheets([{ cssRules: [scopeRule] }], () =>
          resolveTextDirection(target, 'rtl'),
        ),
      ).toBe('ltr');
    } finally {
      window.getComputedStyle = originalWindowGetComputedStyle;
      globalThis.getComputedStyle = originalGlobalGetComputedStyle;
    }
  });

  test('uses the inline style parent as the implicit scope root', () => {
    const originalWindowGetComputedStyle = window.getComputedStyle;
    const originalGlobalGetComputedStyle = globalThis.getComputedStyle;
    const getComputedStyleOverride = ((target: Element) => {
      let style = originalWindowGetComputedStyle(target);
      style = withComputedDirection(style, 'ltr');
      return style;
    }) as typeof window.getComputedStyle;
    window.getComputedStyle = getComputedStyleOverride;
    globalThis.getComputedStyle = getComputedStyleOverride;
    const section = document.createElement('section');
    const styleElement = document.createElement('style');
    const inside = document.createElement('div');
    inside.className = 'shell';
    const outside = document.createElement('div');
    outside.className = 'shell';
    section.append(styleElement, inside);
    document.body.append(section, outside);
    const scopeRule = createCssRule({
      type: 0,
      cssText: '@scope {}',
      cssRules: [createStyleRule({ selectorText: '.shell', direction: 'ltr' })],
    });
    const sheet = { cssRules: [scopeRule], ownerNode: styleElement };
    try {
      expect(withDocumentStyleSheets([sheet], () => resolveTextDirection(inside, 'rtl'))).toBe(
        'ltr',
      );
      expect(withDocumentStyleSheets([sheet], () => resolveTextDirection(outside, 'rtl'))).toBe(
        'rtl',
      );
    } finally {
      window.getComputedStyle = originalWindowGetComputedStyle;
      globalThis.getComputedStyle = originalGlobalGetComputedStyle;
    }
  });

  test('recognizes SVG style elements as implicit scope owners', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const styleElement = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    const target = document.createElement('div');
    target.className = 'shell';
    svg.append(styleElement, target);
    document.body.append(svg);
    const scopeRule = createCssRule({
      type: 0,
      cssText: '@scope {}',
      cssRules: [createStyleRule({ selectorText: '.shell', direction: 'ltr' })],
    });
    expect(
      withDocumentStyleSheets([{ cssRules: [scopeRule], ownerNode: styleElement }], () =>
        resolveTextDirection(target, 'rtl'),
      ),
    ).toBe('ltr');
  });

  test('uses the enclosing shadow root as the implicit scope root', () => {
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
      cssRules: [createStyleRule({ selectorText: '.shell', direction: 'ltr' })],
    });
    const sheet = { cssRules: [scopeRule], ownerNode: styleElement };
    try {
      expect(withDocumentStyleSheets([sheet], () => resolveTextDirection(target, 'rtl'))).toBe(
        'ltr',
      );
    } finally {
      window.getComputedStyle = originalWindowGetComputedStyle;
      globalThis.getComputedStyle = originalGlobalGetComputedStyle;
    }
  });

  test('fails closed when an implicit scope is excluded by an enclosing scope', () => {
    const originalWindowGetComputedStyle = window.getComputedStyle;
    const originalGlobalGetComputedStyle = globalThis.getComputedStyle;
    const getComputedStyleOverride = ((target: Element) => {
      let style = originalWindowGetComputedStyle(target);
      style = withComputedDirection(style, 'ltr');
      return style;
    }) as typeof window.getComputedStyle;
    window.getComputedStyle = getComputedStyleOverride;
    globalThis.getComputedStyle = getComputedStyleOverride;
    const section = document.createElement('section');
    const target = document.createElement('div');
    target.className = 'shell';
    section.append(target);
    document.body.append(section);
    const innerScope = createCssRule({
      type: 0,
      cssText: '@scope {}',
      cssRules: [createStyleRule({ selectorText: '.shell', direction: 'ltr' })],
    });
    const outerScope = createCssRule({
      type: 0,
      cssText: '@scope (.missing) {}',
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
});
