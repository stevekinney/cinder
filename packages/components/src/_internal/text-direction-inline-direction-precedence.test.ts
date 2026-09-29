import { describe, expect, test } from 'bun:test';

import {
  createCssRule,
  createStyleRule,
  withComputedDirection,
  withDocumentStyleSheets,
} from './text-direction-test-helpers.ts';
import {
  elementDirectionStyleOverride,
  isRightToLeftElement,
  resolveTextDirection,
} from './text-direction.ts';

describe('resolveTextDirection', () => {
  test('treats an unrecognized conditional at-rule as always active', () => {
    // Neither a container, media, nor supports rule — the conditional-rule
    // check has no way to evaluate its condition, so it fails open rather
    // than silently dropping every direction rule nested inside an at-rule
    // it doesn't recognize.
    const element = document.createElement('div');
    element.className = 'unrecognized-at-rule-target';
    document.body.append(element);
    const unrecognizedAtRule = createCssRule({
      type: 99,
      cssText: '@unknown-condition (foo) {}',
      conditionText: 'foo',
      cssRules: [
        createStyleRule({ selectorText: '.unrecognized-at-rule-target', direction: 'ltr' }),
      ],
    });
    expect(
      withDocumentStyleSheets([{ cssRules: [unrecognizedAtRule] }], () =>
        resolveTextDirection(element, 'rtl'),
      ),
    ).toBe('ltr');
    element.remove();
  });

  test('records the document root itself as the styled-direction element when only it carries inline direction', () => {
    // The document root is deliberately excluded from the loop's OTHER
    // styled-direction check (which never runs for it), so this specific
    // fallback check is the only thing that can ever record the root.
    const originalDirection = document.documentElement.style.direction;
    document.documentElement.style.direction = 'rtl';
    const child = document.createElement('div');
    document.body.append(child);
    try {
      expect(resolveTextDirection(child)).toBe('rtl');
    } finally {
      document.documentElement.style.direction = originalDirection;
      child.remove();
    }
  });

  test('returns undefined when no element, fallback, or document direction is available', () => {
    expect(resolveTextDirection(null)).toBeUndefined();
  });

  test('reports whether an element resolves to right-to-left direction', () => {
    const element = document.createElement('div');
    element.dir = 'rtl';
    document.body.appendChild(element);

    expect(isRightToLeftElement(element)).toBe(true);
    expect(isRightToLeftElement(null)).toBe(false);
  });

  test('prefers local DOM direction over provider fallback', () => {
    const wrapper = document.createElement('div');
    wrapper.dir = 'ltr';
    const element = document.createElement('div');
    wrapper.appendChild(element);
    document.body.appendChild(wrapper);

    expect(resolveTextDirection(element, 'rtl')).toBe('ltr');
  });

  test('can ignore a generated element direction while preserving its inline style', () => {
    const wrapper = document.createElement('div');
    wrapper.dir = 'rtl';
    const element = document.createElement('div');
    element.dir = 'rtl';
    element.style.direction = 'ltr';
    wrapper.append(element);
    document.body.append(wrapper);

    expect(
      resolveTextDirection(element, 'rtl', {
        ignoreElementDirectionAttribute: true,
      }),
    ).toBe('ltr');
  });

  test('resolves non-literal inline direction declarations through computed style', () => {
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
      element.style.direction = 'var(--flow)';
      document.body.append(element);
      expect(elementDirectionStyleOverride(element)).toBe('ltr');
    } finally {
      window.getComputedStyle = originalWindowGetComputedStyle;
      globalThis.getComputedStyle = originalGlobalGetComputedStyle;
    }
  });

  test('can ignore a generated element direction while preserving its class style', () => {
    const styleElement = document.createElement('style');
    styleElement.textContent = '.local-ltr { direction: ltr; }';
    document.head.append(styleElement);
    const wrapper = document.createElement('div');
    wrapper.dir = 'rtl';
    const element = document.createElement('div');
    element.dir = 'rtl';
    element.className = 'local-ltr';
    wrapper.append(element);
    document.body.append(wrapper);

    expect(
      resolveTextDirection(element, 'rtl', {
        ignoreElementDirectionAttribute: true,
      }),
    ).toBe('ltr');

    styleElement.remove();
  });

  test('prefers an ancestor inline style over a generated element direction', () => {
    const wrapper = document.createElement('div');
    wrapper.dir = 'rtl';
    wrapper.style.direction = 'ltr';
    const element = document.createElement('div');
    element.dir = 'rtl';
    wrapper.append(element);
    document.body.append(wrapper);

    expect(resolveTextDirection(element, 'rtl', { ignoreElementDirectionAttribute: true })).toBe(
      'ltr',
    );
  });
});
