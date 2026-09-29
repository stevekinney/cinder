import { describe, expect, test } from 'bun:test';

import {
  createCssRule,
  createStyleRule,
  withComputedStyle,
  withDocumentStyleSheets,
} from './text-direction-test-helpers.ts';
import { resolveTextDirection } from './text-direction.ts';

describe('resolveTextDirection', () => {
  test('uses an active style container query direction rule', () => {
    const wrapper = document.createElement('section');
    wrapper.style.setProperty('--example', 'true');
    const element = document.createElement('div');
    wrapper.appendChild(element);
    document.body.appendChild(wrapper);
    const nestedRule = createStyleRule({ selectorText: '.container-ltr-reset', direction: 'ltr' });
    element.className = 'container-ltr-reset';
    const outerRule = createCssRule({
      cssText: '@container style(--example: true) { .container-ltr-reset { direction: ltr; } }',
      type: 0,
      conditionText: 'style(--example: true)',
      cssRules: [nestedRule],
    });
    expect(
      withDocumentStyleSheets([{ cssRules: [outerRule] }], () =>
        resolveTextDirection(element, 'rtl'),
      ),
    ).toBe('ltr');
  });

  test('treats a compound style()-and-size container query as inactive', () => {
    // The style() term alone would match here, but the compound condition
    // also requires a size threshold this evaluator does not check against
    // the style()-query's own ancestor walk. Fail closed rather than acting
    // on the style() clause in isolation.
    const wrapper = document.createElement('section');
    wrapper.style.setProperty('--example', 'true');
    const element = document.createElement('div');
    wrapper.appendChild(element);
    document.body.appendChild(wrapper);
    const nestedRule = createStyleRule({
      selectorText: '.compound-container-ltr',
      direction: 'ltr',
    });
    element.className = 'compound-container-ltr';
    const outerRule = createCssRule({
      cssText:
        '@container style(--example: true) and (min-width: 40rem) { .compound-container-ltr { direction: ltr; } }',
      type: 0,
      conditionText: 'style(--example: true) and (min-width: 40rem)',
      cssRules: [nestedRule],
    });
    expect(
      withDocumentStyleSheets([{ cssRules: [outerRule] }], () =>
        resolveTextDirection(element, 'rtl'),
      ),
    ).toBe('rtl');
  });

  test('evaluates size queries against the nearest eligible query container', () => {
    const originalGetComputedStyle = window.getComputedStyle;
    const originalGlobalGetComputedStyle = globalThis.getComputedStyle;
    const container = document.createElement('section');
    container.style.setProperty('container-type', 'inline-size');
    Object.defineProperty(container, 'offsetWidth', { value: 400, configurable: true });
    const wrapper = document.createElement('div');
    Object.defineProperty(wrapper, 'offsetWidth', { value: 100, configurable: true });
    const element = document.createElement('div');
    element.className = 'container-ltr-reset';
    wrapper.appendChild(element);
    container.appendChild(wrapper);
    document.body.appendChild(container);
    const nestedRule = createStyleRule({ selectorText: '.container-ltr-reset', direction: 'ltr' });
    const outerRule = createCssRule({
      cssText: '@container (min-width: 20rem) { .container-ltr-reset { direction: ltr; } }',
      type: 0,
      conditionText: '(min-width: 20rem)',
      cssRules: [nestedRule],
    });
    const getComputedStyleOverride = ((target: Element) => {
      let style = originalGetComputedStyle(target);
      if (target === container) style = withComputedStyle(style, { containerType: 'inline-size' });
      return style;
    }) as typeof window.getComputedStyle;
    window.getComputedStyle = getComputedStyleOverride;
    globalThis.getComputedStyle = getComputedStyleOverride;
    try {
      expect(
        withDocumentStyleSheets([{ cssRules: [outerRule] }], () =>
          resolveTextDirection(element, 'rtl'),
        ),
      ).toBe('ltr');
    } finally {
      window.getComputedStyle = originalGetComputedStyle;
      globalThis.getComputedStyle = originalGlobalGetComputedStyle;
    }
  });

  test('evaluates size queries against the container content box', () => {
    const container = document.createElement('section');
    container.style.setProperty('container-type', 'inline-size');
    container.style.paddingInlineStart = '20px';
    container.style.paddingInlineEnd = '20px';
    Object.defineProperty(container, 'offsetWidth', { value: 340, configurable: true });
    const element = document.createElement('div');
    element.className = 'content-box-container-ltr';
    container.appendChild(element);
    document.body.appendChild(container);
    const nestedRule = createStyleRule({
      selectorText: '.content-box-container-ltr',
      direction: 'ltr',
    });
    const outerRule = createCssRule({
      cssText: '@container (min-width: 20rem) { .content-box-container-ltr { direction: ltr; } }',
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
      container.remove();
    }
  });

  test('treats a container size query with an unsupported length unit as inactive', () => {
    // The evaluator only resolves `px`/`rem`. A query written in `em` (or any
    // other unit) cannot be decided here, so it must fail closed instead of
    // defaulting to "matches" when neither `minimum` nor `maximum` parses.
    const container = document.createElement('section');
    container.style.setProperty('container-type', 'inline-size');
    Object.defineProperty(container, 'offsetWidth', { value: 400, configurable: true });
    const element = document.createElement('div');
    element.className = 'unsupported-unit-container-ltr';
    container.appendChild(element);
    document.body.appendChild(container);
    const nestedRule = createStyleRule({
      selectorText: '.unsupported-unit-container-ltr',
      direction: 'ltr',
    });
    const outerRule = createCssRule({
      cssText:
        '@container (min-width: 30em) { .unsupported-unit-container-ltr { direction: ltr; } }',
      type: 0,
      conditionText: '(min-width: 30em)',
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

  test('treats every unsupported unit in a mixed container query as inactive', () => {
    const container = document.createElement('section');
    container.style.setProperty('container-type', 'inline-size');
    Object.defineProperty(container, 'offsetWidth', { value: 320, configurable: true });
    const element = document.createElement('div');
    element.className = 'mixed-unit-container-ltr';
    container.appendChild(element);
    document.body.appendChild(container);
    const nestedRule = createStyleRule({
      selectorText: '.mixed-unit-container-ltr',
      direction: 'ltr',
    });
    const outerRule = createCssRule({
      cssText:
        '@container (min-width: 20px) and (max-width: 40em) { .mixed-unit-container-ltr { direction: ltr; } }',
      type: 0,
      conditionText: '(min-width: 20px) and (max-width: 40em)',
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

  test('treats a value-first unsupported unit as inactive', () => {
    const container = document.createElement('section');
    container.style.setProperty('container-type', 'inline-size');
    Object.defineProperty(container, 'offsetWidth', { value: 800, configurable: true });
    const element = document.createElement('div');
    element.className = 'value-first-unsupported-unit-ltr';
    container.append(element);
    document.body.append(container);
    const nestedRule = createStyleRule({
      selectorText: '.value-first-unsupported-unit-ltr',
      direction: 'ltr',
    });
    const outerRule = createCssRule({
      cssText: '@container (40em >= width >= 20px) {}',
      type: 0,
      conditionText: '(40em >= width >= 20px)',
      cssRules: [nestedRule],
    });

    expect(
      withDocumentStyleSheets([{ cssRules: [outerRule] }], () =>
        resolveTextDirection(element, 'rtl'),
      ),
    ).toBe('rtl');
  });
});
