import { describe, expect, test } from 'bun:test';

import {
  createCssRule,
  createStyleRule,
  withComputedStyle,
  withDocumentStyleSheets,
} from './text-direction-test-helpers.ts';
import { resolveTextDirection } from './text-direction.ts';

describe('resolveTextDirection', () => {
  test('fails closed for a comma-separated @container condition list when .conditions is absent', () => {
    // Environments lacking `CSSContainerRule.conditions` keep falling
    // closed exactly as before this module understood the property at
    // all — this is an enhancement, not a requirement to polyfill it.
    const container = document.createElement('section');
    container.style.setProperty('container-type', 'inline-size');
    Object.defineProperty(container, 'offsetWidth', { value: 700, configurable: true });
    const element = document.createElement('div');
    element.className = 'condition-list-no-conditions-property-ltr';
    container.appendChild(element);
    document.body.appendChild(container);
    const nestedRule = createStyleRule({
      selectorText: '.condition-list-no-conditions-property-ltr',
      direction: 'ltr',
    });
    const outerRule = createCssRule({
      cssText:
        '@container (min-width: 20rem), (min-width: 40rem) { .condition-list-no-conditions-property-ltr { direction: ltr; } }',
      type: 0,
      conditionText: '(min-width: 20rem), (min-width: 40rem)',
      containerName: '',
      containerQuery: '',
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

  test('uses composed shadow ancestry for named style containers', () => {
    const host = document.createElement('div');
    host.style.setProperty('container-name', 'sidebar');
    host.style.setProperty('--flow', 'rtl');
    const shadow = host.attachShadow({ mode: 'open' });
    const container = document.createElement('section');
    const element = document.createElement('div');
    element.className = 'shadow-named-style-ltr';
    container.append(element);
    shadow.append(container);
    document.body.append(host);
    const nestedRule = createStyleRule({
      selectorText: '.shadow-named-style-ltr',
      direction: 'ltr',
    });
    const outerRule = createCssRule({
      cssText: '@container sidebar style(--flow: rtl) {}',
      type: 0,
      conditionText: 'style(--flow: rtl)',
      containerName: 'sidebar',
      cssRules: [nestedRule],
    });
    expect(
      withDocumentStyleSheets([{ cssRules: [outerRule] }], () =>
        resolveTextDirection(element, 'rtl'),
      ),
    ).toBe('ltr');
  });
  test('uses fractional computed container width over integer client width', () => {
    const container = document.createElement('section');
    container.style.setProperty('container-type', 'inline-size');
    Object.defineProperty(container, 'clientWidth', { value: 320, configurable: true });
    Object.defineProperty(container, 'offsetWidth', { value: 320, configurable: true });
    const element = document.createElement('div');
    element.className = 'fractional-container-ltr';
    container.append(element);
    document.body.append(container);
    const nestedRule = createStyleRule({
      selectorText: '.fractional-container-ltr',
      direction: 'ltr',
    });
    const outerRule = createCssRule({
      cssText: '@container (min-width: 320.25px) {}',
      type: 0,
      conditionText: '(min-width: 320.25px)',
      cssRules: [nestedRule],
    });
    const original = window.getComputedStyle;
    const override = ((target: Element) => {
      let style = original(target);
      if (target === container) style = withComputedStyle(style, { width: '320.5px' });
      return style;
    }) as typeof window.getComputedStyle;
    window.getComputedStyle = override;
    globalThis.getComputedStyle = override;
    try {
      expect(
        withDocumentStyleSheets([{ cssRules: [outerRule] }], () =>
          resolveTextDirection(element, 'rtl'),
        ),
      ).toBe('ltr');
    } finally {
      window.getComputedStyle = original;
      globalThis.getComputedStyle = original;
      container.remove();
    }
  });

  test('evaluates range-syntax size queries', () => {
    const container = document.createElement('section');
    container.style.setProperty('container-type', 'inline-size');
    Object.defineProperty(container, 'offsetWidth', { value: 400, configurable: true });
    const element = document.createElement('div');
    element.className = 'range-container-ltr';
    container.appendChild(element);
    document.body.appendChild(container);
    const nestedRule = createStyleRule({ selectorText: '.range-container-ltr', direction: 'ltr' });
    const outerRule = createCssRule({
      cssText: '@container (width >= 20rem) { .range-container-ltr { direction: ltr; } }',
      type: 0,
      conditionText: '(width >= 20rem)',
      cssRules: [nestedRule],
    });
    try {
      expect(
        withDocumentStyleSheets([{ cssRules: [outerRule] }], () =>
          resolveTextDirection(element, 'rtl'),
        ),
      ).toBe('ltr');
    } finally {
      container.remove();
    }
  });

  test('evaluates every comparison in a conjunctive range query', () => {
    // `(width >= 20rem) and (width <= 40rem)` has two range comparisons;
    // a container above the upper bound must be treated as inactive even
    // though the first (lower-bound) comparison alone would match.
    const container = document.createElement('section');
    container.style.setProperty('container-type', 'inline-size');
    Object.defineProperty(container, 'offsetWidth', { value: 700, configurable: true });
    const element = document.createElement('div');
    element.className = 'conjunctive-range-container-ltr';
    container.appendChild(element);
    document.body.appendChild(container);
    const nestedRule = createStyleRule({
      selectorText: '.conjunctive-range-container-ltr',
      direction: 'ltr',
    });
    const outerRule = createCssRule({
      cssText:
        '@container (width >= 20rem) and (width <= 40rem) { .conjunctive-range-container-ltr { direction: ltr; } }',
      type: 0,
      conditionText: '(width >= 20rem) and (width <= 40rem)',
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

  test('combines legacy min-width with conjunctive range constraints', () => {
    const container = document.createElement('section');
    container.style.setProperty('container-type', 'inline-size');
    Object.defineProperty(container, 'offsetWidth', { value: 240, configurable: true });
    const element = document.createElement('div');
    element.className = 'mixed-constraint-container-ltr';
    container.appendChild(element);
    document.body.appendChild(container);
    const nestedRule = createStyleRule({
      selectorText: '.mixed-constraint-container-ltr',
      direction: 'ltr',
    });
    const outerRule = createCssRule({
      cssText:
        '@container (min-width: 20rem) and (width <= 40rem) { .mixed-constraint-container-ltr { direction: ltr; } }',
      type: 0,
      conditionText: '(min-width: 20rem) and (width <= 40rem)',
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
