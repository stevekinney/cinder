import { describe, expect, test } from 'bun:test';

import {
  createCssRule,
  createStyleRule,
  withComputedDirection,
  withDocumentAdoptedStyleSheets,
  withDocumentStyleSheets,
} from './text-direction-test-helpers.ts';
import { elementDirectionStyleOverride, resolveTextDirection } from './text-direction.ts';

describe('resolveTextDirection', () => {
  test('evaluates value-first range syntax below, inside, and above the range', () => {
    const nestedRule = createStyleRule({
      selectorText: '.value-first-range-ltr',
      direction: 'ltr',
    });
    const outerRule = createCssRule({
      cssText:
        '@container (20rem <= width <= 40rem) { .value-first-range-ltr { direction: ltr; } }',
      type: 0,
      conditionText: '(20rem <= width <= 40rem)',
      cssRules: [nestedRule],
    });
    for (const [offsetWidth, expected] of [
      [240, 'rtl'],
      [480, 'ltr'],
      [700, 'rtl'],
    ] as const) {
      const container = document.createElement('section');
      container.style.setProperty('container-type', 'inline-size');
      Object.defineProperty(container, 'offsetWidth', { value: offsetWidth, configurable: true });
      const element = document.createElement('div');
      element.className = 'value-first-range-ltr';
      container.appendChild(element);
      document.body.appendChild(container);
      try {
        expect(
          withDocumentStyleSheets([{ cssRules: [outerRule] }], () =>
            resolveTextDirection(element, 'rtl'),
          ),
        ).toBe(expected);
      } finally {
        container.remove();
      }
    }
  });

  test('includes adopted stylesheets in direction rule scans', () => {
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
      const element = document.createElement('div');
      element.className = 'adopted-ltr';
      document.body.append(element);
      const sheet = {
        cssRules: [createStyleRule({ selectorText: '.adopted-ltr', direction: 'ltr' })],
      };
      expect(
        withDocumentStyleSheets([], () =>
          withDocumentAdoptedStyleSheets([sheet], () => resolveTextDirection(element, 'rtl')),
        ),
      ).toBe('ltr');
    } finally {
      window.getComputedStyle = originalWindowGetComputedStyle;
      globalThis.getComputedStyle = originalGlobalGetComputedStyle;
    }
  });

  test('includes shadow-root style and adopted stylesheets in direction rule scans', () => {
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
      const host = document.createElement('div');
      const shadowRoot = host.attachShadow({ mode: 'open' });
      const styleElement = document.createElement('style');
      const styleSheet = {
        cssRules: [createStyleRule({ selectorText: '.shadow-ltr', direction: 'ltr' })],
      };
      Object.defineProperty(styleElement, 'sheet', { configurable: true, value: styleSheet });
      shadowRoot.append(styleElement);
      const element = document.createElement('div');
      element.className = 'shadow-ltr';
      shadowRoot.append(element);
      document.body.append(host);
      const adoptedSheet = {
        cssRules: [createStyleRule({ selectorText: '.adopted-shadow-ltr', direction: 'ltr' })],
      };
      Object.defineProperty(shadowRoot, 'adoptedStyleSheets', {
        configurable: true,
        value: [adoptedSheet],
      });
      expect(elementDirectionStyleOverride(element)).toBe('ltr');
      element.className = 'adopted-shadow-ltr';
      expect(elementDirectionStyleOverride(element)).toBe('ltr');
    } finally {
      window.getComputedStyle = originalWindowGetComputedStyle;
      globalThis.getComputedStyle = originalGlobalGetComputedStyle;
    }
  });

  test('evaluates inline-size range queries against the content box', () => {
    const container = document.createElement('section');
    container.style.setProperty('container-type', 'inline-size');
    container.style.paddingInlineStart = '20px';
    container.style.paddingInlineEnd = '20px';
    Object.defineProperty(container, 'offsetWidth', { value: 340, configurable: true });
    const element = document.createElement('div');
    element.className = 'inline-size-container-ltr';
    container.appendChild(element);
    document.body.appendChild(container);
    const nestedRule = createStyleRule({
      selectorText: '.inline-size-container-ltr',
      direction: 'ltr',
    });
    const outerRule = createCssRule({
      cssText:
        '@container (inline-size >= 20rem) { .inline-size-container-ltr { direction: ltr; } }',
      type: 0,
      conditionText: '(inline-size >= 20rem)',
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

  test('measures inline-size along the logical vertical axis', () => {
    const container = document.createElement('section');
    container.style.setProperty('container-type', 'inline-size');
    container.style.setProperty('writing-mode', 'vertical-rl');
    container.style.paddingInlineStart = '100px';
    container.style.paddingInlineEnd = '100px';
    container.style.borderInlineStartWidth = '1px';
    container.style.borderInlineEndWidth = '1px';
    Object.defineProperty(container, 'offsetWidth', { value: 100, configurable: true });
    Object.defineProperty(container, 'offsetHeight', { value: 500, configurable: true });
    const element = document.createElement('div');
    element.className = 'vertical-inline-size-container-ltr';
    container.appendChild(element);
    document.body.appendChild(container);
    const nestedRule = createStyleRule({
      selectorText: '.vertical-inline-size-container-ltr',
      direction: 'ltr',
    });
    const outerRule = createCssRule({
      cssText:
        '@container (inline-size >= 20rem) { .vertical-inline-size-container-ltr { direction: ltr; } }',
      type: 0,
      conditionText: '(inline-size >= 20rem)',
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

  test('measures a physical width query along the physical horizontal axis under vertical writing mode', () => {
    // Physical `width` always measures the horizontal axis. Under a vertical
    // writing mode, the logical inline insets resolve to top/bottom, so
    // subtracting them here (instead of the physical left/right insets)
    // would measure against the wrong axis entirely.
    const container = document.createElement('section');
    container.style.setProperty('container-type', 'inline-size');
    container.style.setProperty('writing-mode', 'vertical-rl');
    container.style.paddingLeft = '20px';
    container.style.paddingRight = '20px';
    Object.defineProperty(container, 'offsetWidth', { value: 340, configurable: true });
    Object.defineProperty(container, 'offsetHeight', { value: 500, configurable: true });
    const element = document.createElement('div');
    element.className = 'vertical-physical-width-container-ltr';
    container.appendChild(element);
    document.body.appendChild(container);
    const nestedRule = createStyleRule({
      selectorText: '.vertical-physical-width-container-ltr',
      direction: 'ltr',
    });
    const outerRule = createCssRule({
      cssText:
        '@container (min-width: 20rem) { .vertical-physical-width-container-ltr { direction: ltr; } }',
      type: 0,
      conditionText: '(min-width: 20rem)',
      cssRules: [nestedRule],
    });
    try {
      // Content width is 340 - 20 - 20 = 300px, below the 320px (20rem)
      // threshold, so the rule is inactive and the provider fallback holds.
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
