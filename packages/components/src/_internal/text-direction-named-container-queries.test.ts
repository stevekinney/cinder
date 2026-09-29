import { describe, expect, test } from 'bun:test';

import {
  createCssRule,
  createMediaQueryList,
  createStyleRule,
  withDocumentStyleSheets,
} from './text-direction-test-helpers.ts';
import { resolveTextDirection } from './text-direction.ts';

describe('resolveTextDirection', () => {
  test('ignores direction rules in a stylesheet whose media does not match', () => {
    const originalMatchMedia = globalThis.matchMedia;
    globalThis.matchMedia = (query: string) => createMediaQueryList(query, false);
    try {
      const nestedRule = createStyleRule({ selectorText: '.print-only-ltr', direction: 'ltr' });
      const element = document.createElement('div');
      element.className = 'print-only-ltr';
      document.body.appendChild(element);

      expect(
        withDocumentStyleSheets(
          [{ disabled: false, media: { mediaText: 'print' }, cssRules: [nestedRule] }],
          () => resolveTextDirection(element, 'rtl'),
        ),
      ).toBe('rtl');
    } finally {
      globalThis.matchMedia = originalMatchMedia;
    }
  });

  test('uses CSSContainerRule.containerName for named size queries', () => {
    const container = document.createElement('section');
    container.style.setProperty('container-type', 'inline-size');
    container.style.setProperty('container-name', 'sidebar');
    Object.defineProperty(container, 'offsetWidth', { value: 400, configurable: true });
    const wrapper = document.createElement('div');
    wrapper.style.setProperty('container-type', 'inline-size');
    Object.defineProperty(wrapper, 'offsetWidth', { value: 100, configurable: true });
    const element = document.createElement('div');
    element.className = 'named-container-ltr';
    wrapper.appendChild(element);
    container.appendChild(wrapper);
    document.body.appendChild(container);
    const nestedRule = createStyleRule({ selectorText: '.named-container-ltr', direction: 'ltr' });
    const outerRule = createCssRule({
      cssText: '@container sidebar (min-width: 20rem) { .named-container-ltr { direction: ltr; } }',
      type: 0,
      conditionText: '(min-width: 20rem)',
      containerName: 'sidebar',
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

  test('uses CSSContainerRule.containerName for named style queries', () => {
    const namedContainer = document.createElement('section');
    namedContainer.style.setProperty('container-name', 'sidebar');
    namedContainer.style.setProperty('--theme', 'dark');
    const nearerContainer = document.createElement('div');
    nearerContainer.style.setProperty('--theme', 'light');
    const element = document.createElement('div');
    element.className = 'named-style-ltr';
    nearerContainer.appendChild(element);
    namedContainer.appendChild(nearerContainer);
    document.body.appendChild(namedContainer);
    const nestedRule = createStyleRule({ selectorText: '.named-style-ltr', direction: 'ltr' });
    const outerRule = createCssRule({
      cssText: '@container sidebar style(--theme: dark) { .named-style-ltr { direction: ltr; } }',
      type: 0,
      conditionText: 'style(--theme: dark)',
      containerName: 'sidebar',
      cssRules: [nestedRule],
    });
    try {
      expect(
        withDocumentStyleSheets([{ cssRules: [outerRule] }], () =>
          resolveTextDirection(element, 'rtl'),
        ),
      ).toBe('ltr');
    } finally {
      namedContainer.remove();
    }
  });

  test('fails closed when a named style() query finds no ancestor with a matching container-name', () => {
    const container = document.createElement('section');
    // No container-name set anywhere in the ancestor chain — the walk must
    // reach the document root without ever matching "sidebar" and fail
    // closed rather than looping forever or matching the wrong container.
    const element = document.createElement('div');
    element.className = 'unnamed-container-style-target';
    container.appendChild(element);
    document.body.appendChild(container);
    const nestedRule = createStyleRule({
      selectorText: '.unnamed-container-style-target',
      direction: 'ltr',
    });
    const outerRule = createCssRule({
      cssText:
        '@container sidebar style(--theme: dark) { .unnamed-container-style-target { direction: ltr; } }',
      type: 0,
      conditionText: 'style(--theme: dark)',
      containerName: 'sidebar',
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
  test('strips a real CSSContainerRule.conditionText container-name prefix for named size queries', () => {
    // A real `CSSContainerRule.conditionText` for a named rule serializes the
    // container name ahead of the query — `@container sidebar (min-width:
    // 20rem)` reads back as `"sidebar (min-width: 20rem)"`, not just the
    // query. The size-query grammar only understands the query itself, so
    // without stripping the name this must not silently fail closed.
    const container = document.createElement('section');
    container.style.setProperty('container-type', 'inline-size');
    container.style.setProperty('container-name', 'sidebar');
    Object.defineProperty(container, 'offsetWidth', { value: 400, configurable: true });
    const wrapper = document.createElement('div');
    wrapper.style.setProperty('container-type', 'inline-size');
    Object.defineProperty(wrapper, 'offsetWidth', { value: 100, configurable: true });
    const element = document.createElement('div');
    element.className = 'real-named-container-ltr';
    wrapper.appendChild(element);
    container.appendChild(wrapper);
    document.body.appendChild(container);
    const nestedRule = createStyleRule({
      selectorText: '.real-named-container-ltr',
      direction: 'ltr',
    });
    const outerRule = createCssRule({
      cssText:
        '@container sidebar (min-width: 20rem) { .real-named-container-ltr { direction: ltr; } }',
      type: 0,
      conditionText: 'sidebar (min-width: 20rem)',
      containerName: 'sidebar',
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

  test('strips a real CSSContainerRule.conditionText container-name prefix for named style queries', () => {
    const namedContainer = document.createElement('section');
    namedContainer.style.setProperty('container-name', 'sidebar');
    namedContainer.style.setProperty('--theme', 'dark');
    const nearerContainer = document.createElement('div');
    nearerContainer.style.setProperty('--theme', 'light');
    const element = document.createElement('div');
    element.className = 'real-named-style-ltr';
    nearerContainer.appendChild(element);
    namedContainer.appendChild(nearerContainer);
    document.body.appendChild(namedContainer);
    const nestedRule = createStyleRule({ selectorText: '.real-named-style-ltr', direction: 'ltr' });
    const outerRule = createCssRule({
      cssText:
        '@container sidebar style(--theme: dark) { .real-named-style-ltr { direction: ltr; } }',
      type: 0,
      conditionText: 'sidebar style(--theme: dark)',
      containerName: 'sidebar',
      cssRules: [nestedRule],
    });
    try {
      expect(
        withDocumentStyleSheets([{ cssRules: [outerRule] }], () =>
          resolveTextDirection(element, 'rtl'),
        ),
      ).toBe('ltr');
    } finally {
      namedContainer.remove();
    }
  });
});
