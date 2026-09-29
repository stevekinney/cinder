import { describe, expect, test } from 'bun:test';

import {
  createCssRule,
  createStyleRule,
  withComputedDirection,
  withDocumentStyleSheets,
} from './text-direction-test-helpers.ts';
import { resolveTextDirection } from './text-direction.ts';

describe('resolveTextDirection', () => {
  test('uses nested style rules that do not set direction on the outer rule', () => {
    const originalWindowGetComputedStyle = window.getComputedStyle;
    const originalGlobalGetComputedStyle = globalThis.getComputedStyle;
    const getComputedStyleOverride = ((target: Element) => {
      let style = originalWindowGetComputedStyle(target);
      style = withComputedDirection(style, 'ltr');
      return style;
    }) as typeof window.getComputedStyle;
    window.getComputedStyle = getComputedStyleOverride;
    globalThis.getComputedStyle = getComputedStyleOverride;

    try {
      const wrapper = document.createElement('section');
      wrapper.className = 'nested-ltr-reset';
      const element = document.createElement('div');
      wrapper.appendChild(element);
      document.body.appendChild(wrapper);

      const nestedRule = createStyleRule({
        selectorText: '.nested-ltr-reset',
        direction: 'ltr',
      });
      const outerRule = createStyleRule({
        selectorText: '.outer-rule',
        cssRules: [nestedRule],
      });

      const direction = withDocumentStyleSheets([{ cssRules: [outerRule] }], () =>
        resolveTextDirection(element, 'rtl'),
      );
      expect(direction).toBe('ltr');
    } finally {
      window.getComputedStyle = originalWindowGetComputedStyle;
      globalThis.getComputedStyle = originalGlobalGetComputedStyle;
    }
  });

  test.each([
    ['inside the scope root', 'theme', 'rtl', 'ltr'],
    ['outside the scope root', 'other', 'rtl', 'rtl'],
    // A limit selector excludes an element's *proper descendants*, never
    // the scoping root itself — even when the root also happens to match
    // the limit selector (here `.theme` and `.stop` land on the same
    // element). Per the CSS Scoping spec, only a limit match strictly
    // between the root and the target excludes the target; the root
    // matching its own limit doesn't remove the root — or its
    // children — from scope.
    ['root also matching the scope limit stays in scope', 'theme stop', 'rtl', 'ltr'],
  ] as const)(
    'respects @scope boundaries when scanning direction rules: %s',
    (_, classes, fallback, expected) => {
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
      const scopeRule = createCssRule({
        type: 0,
        cssText: classes === 'theme stop' ? '@scope (.theme) to (.stop) {}' : '@scope (.theme) {}',
        cssRules: [styleRule],
      });
      const wrapper = document.createElement('section');
      wrapper.className = classes;
      const element = document.createElement('div');
      element.className = 'shell';
      wrapper.appendChild(element);
      document.body.appendChild(wrapper);

      try {
        const direction = withDocumentStyleSheets([{ cssRules: [scopeRule] }], () =>
          resolveTextDirection(element, fallback),
        );
        expect(direction).toBe(expected);
      } finally {
        window.getComputedStyle = originalWindowGetComputedStyle;
        globalThis.getComputedStyle = originalGlobalGetComputedStyle;
      }
    },
  );

  test('supports selector-list scope roots and fails closed on malformed scope syntax', () => {
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
    const wrapper = document.createElement('section');
    wrapper.className = 'alt';
    const element = document.createElement('div');
    element.className = 'shell';
    wrapper.append(element);
    document.body.append(wrapper);
    try {
      const selectorListScope = createCssRule({
        type: 0,
        cssText: '@scope (.theme, .alt) {}',
        cssRules: [styleRule],
      });
      expect(
        withDocumentStyleSheets([{ cssRules: [selectorListScope] }], () =>
          resolveTextDirection(element, 'rtl'),
        ),
      ).toBe('ltr');

      const malformedScope = createCssRule({
        type: 0,
        cssText: '@scope (.theme, ) {}',
        cssRules: [styleRule],
      });
      expect(
        withDocumentStyleSheets([{ cssRules: [malformedScope] }], () =>
          resolveTextDirection(element, 'rtl'),
        ),
      ).toBe('rtl');
    } finally {
      window.getComputedStyle = originalWindowGetComputedStyle;
      globalThis.getComputedStyle = originalGlobalGetComputedStyle;
    }
  });
  test('fails closed when scope root or limit selector matching throws', () => {
    const originalMatches = Object.getOwnPropertyDescriptor(Element.prototype, 'matches');
    const originalWindowGetComputedStyle = window.getComputedStyle;
    const originalGlobalGetComputedStyle = globalThis.getComputedStyle;
    const getComputedStyleOverride = ((target: Element) => {
      let style = originalWindowGetComputedStyle(target);
      style = withComputedDirection(style, 'ltr');
      return style;
    }) as typeof window.getComputedStyle;
    const matchesOverride = function (this: Element, selector: string): boolean {
      if (selector === ':throwing-root' || selector === ':throwing-limit') {
        throw new SyntaxError(`Unsupported selector: ${selector}`);
      }
      return originalMatches?.value?.call(this, selector) ?? false;
    };
    Object.defineProperty(Element.prototype, 'matches', {
      configurable: true,
      value: matchesOverride,
    });
    window.getComputedStyle = getComputedStyleOverride;
    globalThis.getComputedStyle = getComputedStyleOverride;

    const element = document.createElement('div');
    element.className = 'shell';
    document.body.append(element);
    const styleRule = createStyleRule({ selectorText: '.shell', direction: 'ltr' });
    const throwingRoot = createCssRule({
      type: 0,
      cssText: '@scope (:throwing-root) {}',
      cssRules: [styleRule],
    });
    const throwingLimit = createCssRule({
      type: 0,
      cssText: '@scope () to (:throwing-limit) {}',
      cssRules: [styleRule],
    });

    try {
      expect(
        withDocumentStyleSheets([{ cssRules: [throwingRoot] }], () =>
          resolveTextDirection(element, 'rtl'),
        ),
      ).toBe('rtl');
      expect(
        withDocumentStyleSheets([{ cssRules: [throwingLimit] }], () =>
          resolveTextDirection(element, 'rtl'),
        ),
      ).toBe('rtl');
    } finally {
      if (originalMatches) Object.defineProperty(Element.prototype, 'matches', originalMatches);
      window.getComputedStyle = originalWindowGetComputedStyle;
      globalThis.getComputedStyle = originalGlobalGetComputedStyle;
    }
  });

  test('evaluates relative selectors against the resolved scope root', () => {
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
    Object.defineProperty(root, 'querySelector', { value: () => null });
    const element = document.createElement('div');
    element.className = 'shell';
    root.append(element);
    document.body.append(root);
    const scopeRule = createCssRule({
      type: 0,
      cssText: '@scope (.theme) {}',
      cssRules: [createStyleRule({ selectorText: ':scope > .shell', direction: 'ltr' })],
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
