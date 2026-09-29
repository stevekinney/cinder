import { describe, expect, test } from 'bun:test';

import {
  createCssRule,
  createStyleRule,
  withComputedDirection,
  withDocumentStyleSheets,
} from './text-direction-test-helpers.ts';
import { elementDirectionStyleOverride, resolveTextDirection } from './text-direction.ts';

describe('resolveTextDirection', () => {
  test('preserves escaped delimiters and literal ampersands in nested selectors', () => {
    const originalMatches = Object.getOwnPropertyDescriptor(Element.prototype, 'matches');
    const originalWindowGetComputedStyle = window.getComputedStyle;
    const originalGlobalGetComputedStyle = globalThis.getComputedStyle;
    const getComputedStyleOverride = ((target: Element) => {
      let style = originalWindowGetComputedStyle(target);
      style = withComputedDirection(style, 'ltr');
      return style;
    }) as typeof window.getComputedStyle;
    // Browser CSSOM accepts escaped punctuation in class selectors. Happy DOM
    // 20 rejects these selectors, so keep this compatibility behavior inside
    // the fixture rather than adding a production selector rewrite.
    const matchesOverride = function (this: Element, selector: string): boolean {
      const escapedClassNames = new Map([
        ['.escaped-nesting-shell .escaped\\,comma', 'escaped,comma'],
        ['.escaped-nesting-shell .escaped\\&ampersand', 'escaped&ampersand'],
      ]);
      const className = escapedClassNames.get(selector);
      if (className) return this.classList.contains(className);
      return originalMatches?.value?.call(this, selector) ?? false;
    };
    Object.defineProperty(Element.prototype, 'matches', {
      configurable: true,
      value: matchesOverride,
    });
    window.getComputedStyle = getComputedStyleOverride;
    globalThis.getComputedStyle = getComputedStyleOverride;

    try {
      const shell = document.createElement('section');
      shell.className = 'escaped-nesting-shell';
      const escapedComma = document.createElement('div');
      escapedComma.className = 'escaped,comma';
      const literalAmpersand = document.createElement('div');
      literalAmpersand.setAttribute('data-label', '&');
      const escapedAmpersand = document.createElement('div');
      escapedAmpersand.className = 'escaped&ampersand';
      shell.append(escapedComma, literalAmpersand, escapedAmpersand);
      document.body.appendChild(shell);

      const escapedCommaRule = createStyleRule({
        selectorText: '.escaped\\,comma',
        direction: 'ltr',
      });
      const literalAmpersandRule = createStyleRule({
        selectorText: '[data-label="&"]',
        direction: 'ltr',
      });
      const escapedAmpersandRule = createStyleRule({
        selectorText: '.escaped\\&ampersand',
        direction: 'ltr',
      });
      const outerRule = createStyleRule({
        selectorText: '.escaped-nesting-shell',
        cssRules: [escapedCommaRule, literalAmpersandRule, escapedAmpersandRule],
      });
      for (const rule of [escapedCommaRule, literalAmpersandRule, escapedAmpersandRule])
        Object.defineProperty(rule, 'parentRule', { configurable: true, value: outerRule });

      withDocumentStyleSheets([{ cssRules: [outerRule] }], () => {
        expect(elementDirectionStyleOverride(escapedComma)).toBe('ltr');
        expect(elementDirectionStyleOverride(literalAmpersand)).toBe('ltr');
        expect(elementDirectionStyleOverride(escapedAmpersand)).toBe('ltr');
      });
    } finally {
      if (originalMatches) Object.defineProperty(Element.prototype, 'matches', originalMatches);
      window.getComputedStyle = originalWindowGetComputedStyle;
      globalThis.getComputedStyle = originalGlobalGetComputedStyle;
    }
  });
  test('preserves delimiters and commas inside quoted nested selector values', () => {
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
      const shell = document.createElement('section');
      shell.className = 'quoted-nesting-shell';
      const element = document.createElement('div');
      element.setAttribute('data-label', '),');
      shell.appendChild(element);
      document.body.appendChild(shell);

      const nestedRule = createStyleRule({
        selectorText: '[data-label="),"]',
        direction: 'ltr',
      });
      const outerRule = createStyleRule({
        selectorText: '.quoted-nesting-shell',
        cssRules: [nestedRule],
      });
      Object.defineProperty(nestedRule, 'parentRule', { configurable: true, value: outerRule });

      expect(
        withDocumentStyleSheets([{ cssRules: [outerRule] }], () =>
          elementDirectionStyleOverride(element),
        ),
      ).toBe('ltr');
    } finally {
      window.getComputedStyle = originalWindowGetComputedStyle;
      globalThis.getComputedStyle = originalGlobalGetComputedStyle;
    }
  });

  test('ignores direction rules inside inactive container-query shims', () => {
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
      wrapper.className = 'container-ltr-reset';
      const element = document.createElement('div');
      wrapper.appendChild(element);
      document.body.appendChild(wrapper);

      const nestedRule = createStyleRule({
        selectorText: '.container-ltr-reset',
        direction: 'ltr',
      });
      const outerRule = createCssRule({
        cssText: '@container style(--example: true) { .container-ltr-reset { direction: ltr; } }',
        type: 0,
        conditionText: 'style(--example: true)',
        cssRules: [nestedRule],
      });

      const direction = withDocumentStyleSheets([{ cssRules: [outerRule] }], () =>
        resolveTextDirection(element, 'rtl'),
      );
      expect(direction).toBe('rtl');
    } finally {
      window.getComputedStyle = originalWindowGetComputedStyle;
      globalThis.getComputedStyle = originalGlobalGetComputedStyle;
    }
  });

  test('treats container queries as inactive without computed styles', () => {
    const originalWindowGetComputedStyle = Object.getOwnPropertyDescriptor(
      window,
      'getComputedStyle',
    );
    const originalGlobalGetComputedStyle = Object.getOwnPropertyDescriptor(
      globalThis,
      'getComputedStyle',
    );
    Object.defineProperty(window, 'getComputedStyle', { configurable: true, value: undefined });
    Object.defineProperty(globalThis, 'getComputedStyle', { configurable: true, value: undefined });
    try {
      const element = document.createElement('div');
      document.body.appendChild(element);
      const nestedRule = createStyleRule({ selectorText: 'div', direction: 'ltr' });
      const outerRule = createCssRule({
        cssText: '@container (min-width: 1px) { div { direction: ltr; } }',
        type: 0,
        conditionText: '(min-width: 1px)',
        cssRules: [nestedRule],
      });
      const direction = withDocumentStyleSheets([{ cssRules: [outerRule] }], () =>
        resolveTextDirection(element, 'rtl'),
      );
      expect(direction).toBe('rtl');
    } finally {
      if (originalWindowGetComputedStyle) {
        Object.defineProperty(window, 'getComputedStyle', originalWindowGetComputedStyle);
      }
      if (originalGlobalGetComputedStyle) {
        Object.defineProperty(globalThis, 'getComputedStyle', originalGlobalGetComputedStyle);
      }
    }
  });

  test('fails closed for a malformed negated container query before applying direction', () => {
    const container = document.createElement('section');
    container.style.setProperty('container-type', 'inline-size');
    Object.defineProperty(container, 'offsetWidth', { value: 400, configurable: true });
    const element = document.createElement('div');
    element.className = 'malformed-negated-container-ltr';
    container.appendChild(element);
    document.body.appendChild(container);
    const nestedRule = createStyleRule({
      selectorText: '.malformed-negated-container-ltr',
      direction: 'ltr',
    });
    const outerRule = createCssRule({
      cssText:
        '@container not min-width: 20px { .malformed-negated-container-ltr { direction: ltr; } }',
      type: 0,
      conditionText: 'not min-width: 20px',
      cssRules: [nestedRule],
    });
    try {
      expect(
        withDocumentStyleSheets([{ cssRules: [outerRule] }], () =>
          resolveTextDirection(element, 'rtl'),
        ),
      ).toBe('rtl');
    } finally {
      container.remove();
    }
  });
});
