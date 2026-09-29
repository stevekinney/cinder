import { describe, expect, test } from 'bun:test';

import {
  createCssRule,
  createRuleWithThrowingCssRules,
  createStyleRule,
  createStyleSheetWithThrowingRules,
  withComputedDirection,
  withDocumentStyleSheets,
} from './text-direction-test-helpers.ts';
import { resolveTextDirection } from './text-direction.ts';

describe('resolveTextDirection', () => {
  test('resolves rem thresholds from the document root font size', () => {
    const root = document.documentElement;
    const previousFontSize = root.style.fontSize;
    root.style.fontSize = '20px';
    const container = document.createElement('section');
    container.style.setProperty('container-type', 'inline-size');
    Object.defineProperty(container, 'offsetWidth', { value: 350, configurable: true });
    const element = document.createElement('div');
    element.className = 'rem-container-ltr';
    container.appendChild(element);
    document.body.appendChild(container);
    const nestedRule = createStyleRule({ selectorText: '.rem-container-ltr', direction: 'ltr' });
    const outerRule = createCssRule({
      cssText: '@container (min-width: 20rem) { .rem-container-ltr { direction: ltr; } }',
      type: 0,
      conditionText: '(min-width: 20rem)',
      cssRules: [nestedRule],
    });
    try {
      expect(
        withDocumentStyleSheets([{ cssRules: [outerRule] }], () =>
          resolveTextDirection(element, 'rtl'),
        ),
      ).toBe('rtl');
    } finally {
      root.style.fontSize = previousFontSize;
      container.remove();
    }
  });

  test('measures the container against its pre-transform layout size, not the post-transform rect', () => {
    // `getBoundingClientRect()` reports the box after a CSS `transform` is
    // applied; container size queries measure the pre-transform layout
    // content box instead. A 200px container scaled 2x would incorrectly
    // "satisfy" `min-width: 300px` if the post-transform rect were used —
    // `offsetWidth` (unaffected by `transform`) must be read instead.
    const container = document.createElement('section');
    container.style.setProperty('container-type', 'inline-size');
    container.style.transform = 'scale(2)';
    Object.defineProperty(container, 'offsetWidth', { value: 200, configurable: true });
    Object.defineProperty(container, 'getBoundingClientRect', {
      value: () => ({ width: 400 }),
      configurable: true,
    });
    const element = document.createElement('div');
    element.className = 'transformed-container-ltr';
    container.appendChild(element);
    document.body.appendChild(container);
    const nestedRule = createStyleRule({
      selectorText: '.transformed-container-ltr',
      direction: 'ltr',
    });
    const outerRule = createCssRule({
      cssText: '@container (min-width: 300px) { .transformed-container-ltr { direction: ltr; } }',
      type: 0,
      conditionText: '(min-width: 300px)',
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

  test('ignores inaccessible and invalid CSS direction rules', () => {
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
      wrapper.className = 'invalid-selector-target';
      const element = document.createElement('div');
      wrapper.appendChild(element);
      document.body.appendChild(wrapper);

      const invalidSelectorRule = createStyleRule({
        selectorText: '[',
        direction: 'ltr',
      });
      const direction = withDocumentStyleSheets(
        [{ cssRules: [createRuleWithThrowingCssRules()] }, { cssRules: [invalidSelectorRule] }],
        () => resolveTextDirection(element, 'rtl'),
      );

      expect(direction).toBe('rtl');
    } finally {
      window.getComputedStyle = originalWindowGetComputedStyle;
      globalThis.getComputedStyle = originalGlobalGetComputedStyle;
    }
  });

  test('ignores inaccessible stylesheets and directionless style rules', () => {
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
      wrapper.className = 'directionless-rule-target';
      const element = document.createElement('div');
      wrapper.appendChild(element);
      document.body.appendChild(wrapper);

      const directionlessRule = createStyleRule({
        selectorText: '.directionless-rule-target',
      });
      const direction = withDocumentStyleSheets(
        [createStyleSheetWithThrowingRules(), { cssRules: [directionlessRule] }],
        () => resolveTextDirection(element, 'rtl'),
      );

      expect(direction).toBe('rtl');
    } finally {
      window.getComputedStyle = originalWindowGetComputedStyle;
      globalThis.getComputedStyle = originalGlobalGetComputedStyle;
    }
  });

  test('uses effective computed direction when stylesheet rules are inaccessible', () => {
    const originalWindowGetComputedStyle = window.getComputedStyle;
    const originalGlobalGetComputedStyle = globalThis.getComputedStyle;
    const getComputedStyleOverride = ((target: Element) => {
      let style = originalWindowGetComputedStyle(target);
      style = withComputedDirection(
        style,
        target instanceof HTMLElement && target.classList.contains('cross-origin-rtl')
          ? 'rtl'
          : 'ltr',
      );
      return style;
    }) as typeof window.getComputedStyle;
    window.getComputedStyle = getComputedStyleOverride;
    globalThis.getComputedStyle = getComputedStyleOverride;

    try {
      const element = document.createElement('div');
      element.className = 'cross-origin-rtl';
      element.dir = 'ltr';
      document.body.appendChild(element);

      const direction = withDocumentStyleSheets([createStyleSheetWithThrowingRules()], () =>
        resolveTextDirection(element, 'ltr', { ignoreElementDirectionAttribute: true }),
      );

      expect(direction).toBe('rtl');
    } finally {
      window.getComputedStyle = originalWindowGetComputedStyle;
      globalThis.getComputedStyle = originalGlobalGetComputedStyle;
    }
  });

  test('ignoreElementDirectionAttribute does not leak the dir attribute back in via computed style', () => {
    // Real browsers apply a UA rule (`[dir] { direction: attr(dir) }`-ish behavior) so
    // getComputedStyle(element).direction reflects the element's own `dir` attribute even
    // when it carries no inline style or matching author rule. This mock reproduces that so
    // the "ignore the element's own dir attribute" contract is exercised the way it would be
    // in a real browser rather than happy-dom's non-inheriting default.
    const originalWindowGetComputedStyle = window.getComputedStyle;
    const originalGlobalGetComputedStyle = globalThis.getComputedStyle;
    const getComputedStyleOverride = ((target: Element) => {
      let style = originalWindowGetComputedStyle(target);
      if (target instanceof HTMLElement) {
        const dir = target.getAttribute('dir');
        if (dir === 'rtl' || dir === 'ltr') {
          style = withComputedDirection(style, dir);
        }
      }
      return style;
    }) as typeof window.getComputedStyle;
    window.getComputedStyle = getComputedStyleOverride;
    globalThis.getComputedStyle = getComputedStyleOverride;

    try {
      document.documentElement.dir = 'ltr';
      const element = document.createElement('div');
      element.dir = 'rtl';
      document.body.appendChild(element);

      // No inline style and no matching CSS rule on the element — the only thing making
      // its computed direction differ from the root is the `dir` attribute this option
      // is meant to ignore, so the fallback must win.
      expect(resolveTextDirection(element, 'ltr', { ignoreElementDirectionAttribute: true })).toBe(
        'ltr',
      );
    } finally {
      window.getComputedStyle = originalWindowGetComputedStyle;
      globalThis.getComputedStyle = originalGlobalGetComputedStyle;
      document.documentElement.removeAttribute('dir');
    }
  });
});
