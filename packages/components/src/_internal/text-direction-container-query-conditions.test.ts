import { describe, expect, test } from 'bun:test';

import {
  createCssRule,
  createStyleRule,
  withDocumentStyleSheets,
} from './text-direction-test-helpers.ts';
import { resolveTextDirection } from './text-direction.ts';

describe('resolveTextDirection', () => {
  test('treats a container size query with an unimplemented feature as inactive', () => {
    // `height` (and block-size, aspect-ratio, orientation) are not
    // implemented by this evaluator at all — neither regex captures them, so
    // it must fail closed rather than default to "matches" regardless of
    // the container's actual height.
    const container = document.createElement('section');
    container.style.setProperty('container-type', 'size');
    Object.defineProperty(container, 'offsetWidth', { value: 400, configurable: true });
    Object.defineProperty(container, 'offsetHeight', { value: 100, configurable: true });
    const element = document.createElement('div');
    element.className = 'unsupported-feature-container-ltr';
    container.appendChild(element);
    document.body.appendChild(container);
    const nestedRule = createStyleRule({
      selectorText: '.unsupported-feature-container-ltr',
      direction: 'ltr',
    });
    const outerRule = createCssRule({
      cssText:
        '@container (min-height: 40rem) { .unsupported-feature-container-ltr { direction: ltr; } }',
      type: 0,
      conditionText: '(min-height: 40rem)',
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

  test('evaluates a disjunctive inline-size query', () => {
    // Disjunction handling previously only triggered for physical `width`
    // queries; an `inline-size` disjunction fell through to the AND-only
    // fallback and combined the min/max terms incorrectly.
    const container = document.createElement('section');
    container.style.setProperty('container-type', 'inline-size');
    Object.defineProperty(container, 'offsetWidth', { value: 400, configurable: true });
    const element = document.createElement('div');
    element.className = 'disjunctive-inline-size-container-ltr';
    container.appendChild(element);
    document.body.appendChild(container);
    const nestedRule = createStyleRule({
      selectorText: '.disjunctive-inline-size-container-ltr',
      direction: 'ltr',
    });
    const outerRule = createCssRule({
      cssText:
        '@container (max-inline-size: 10rem) or (min-inline-size: 20rem) { .disjunctive-inline-size-container-ltr { direction: ltr; } }',
      type: 0,
      conditionText: '(max-inline-size: 10rem) or (min-inline-size: 20rem)',
      cssRules: [nestedRule],
    });
    try {
      // 400px satisfies the second clause (>= 20rem / 320px), so the
      // disjunction as a whole is active even though it fails the first.
      expect(
        withDocumentStyleSheets([{ cssRules: [outerRule] }], () =>
          resolveTextDirection(element, 'rtl'),
        ),
      ).toBe('ltr');
    } finally {
      container.remove();
    }
  });

  test('preserves grouped OR precedence under an outer AND', () => {
    const container = document.createElement('section');
    container.style.setProperty('container-type', 'inline-size');
    Object.defineProperty(container, 'offsetWidth', { value: 320, configurable: true });
    const element = document.createElement('div');
    element.className = 'grouped-or-container-ltr';
    container.append(element);
    document.body.append(container);
    const nestedRule = createStyleRule({
      selectorText: '.grouped-or-container-ltr',
      direction: 'ltr',
    });
    const outerRule = createCssRule({
      cssText: '@container ((max-width: 30rem) or (width > 50rem)) and (width > 40rem) {}',
      type: 0,
      conditionText: '((max-width: 30rem) OR (width > 50rem)) AND (width > 40rem)',
      cssRules: [nestedRule],
    });
    expect(
      withDocumentStyleSheets([{ cssRules: [outerRule] }], () =>
        resolveTextDirection(element, 'rtl'),
      ),
    ).toBe('rtl');
  });

  test('matches balanced function values in style queries', () => {
    const container = document.createElement('section');
    container.style.setProperty('--swatch', 'rgb(0 0 0)');
    const element = document.createElement('div');
    element.className = 'balanced-style-container-ltr';
    container.append(element);
    document.body.append(container);
    const nestedRule = createStyleRule({
      selectorText: '.balanced-style-container-ltr',
      direction: 'ltr',
    });
    const outerRule = createCssRule({
      cssText: '@container style(--swatch: rgb(0 0 0)) {}',
      type: 0,
      conditionText: 'style(--swatch: rgb(0 0 0))',
      cssRules: [nestedRule],
    });
    expect(
      withDocumentStyleSheets([{ cssRules: [outerRule] }], () =>
        resolveTextDirection(element, 'rtl'),
      ),
    ).toBe('ltr');
  });

  test('scans same-origin linked stylesheets inside a shadow root', () => {
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    Object.defineProperty(link, 'sheet', {
      configurable: true,
      value: {
        cssRules: [createStyleRule({ selectorText: '.shadow-linked-ltr', direction: 'ltr' })],
      },
    });
    const element = document.createElement('div');
    element.className = 'shadow-linked-ltr';
    shadow.append(link, element);
    document.body.append(host);
    expect(withDocumentStyleSheets([], () => resolveTextDirection(element, 'rtl'))).toBe('ltr');
  });

  test('rejects an equality container query outside its exact width', () => {
    // `(width: 20rem)` has no min-/max- prefix and no comparison operator,
    // so neither the minimum/maximum captures nor evaluateRangeComparisons()
    // recognize it. Without explicit equality handling `matches` silently
    // defaults to true at every width; a 400px container must not match.
    const container = document.createElement('section');
    container.style.setProperty('container-type', 'inline-size');
    Object.defineProperty(container, 'offsetWidth', { value: 400, configurable: true });
    const element = document.createElement('div');
    element.className = 'equality-container-ltr';
    container.appendChild(element);
    document.body.appendChild(container);
    const nestedRule = createStyleRule({
      selectorText: '.equality-container-ltr',
      direction: 'ltr',
    });
    const outerRule = createCssRule({
      cssText: '@container (width: 20rem) { .equality-container-ltr { direction: ltr; } }',
      type: 0,
      conditionText: '(width: 20rem)',
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

  test('matches an equality container query at its exact width', () => {
    const container = document.createElement('section');
    container.style.setProperty('container-type', 'inline-size');
    Object.defineProperty(container, 'offsetWidth', { value: 320, configurable: true });
    const element = document.createElement('div');
    element.className = 'equality-exact-container-ltr';
    container.appendChild(element);
    document.body.appendChild(container);
    const nestedRule = createStyleRule({
      selectorText: '.equality-exact-container-ltr',
      direction: 'ltr',
    });
    const outerRule = createCssRule({
      cssText: '@container (width: 20rem) { .equality-exact-container-ltr { direction: ltr; } }',
      type: 0,
      conditionText: '(width: 20rem)',
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

  test('ignores direction rules in a disabled stylesheet', () => {
    const styleElement = document.createElement('style');
    styleElement.textContent = '.disabled-sheet-ltr { direction: ltr; }';
    document.head.append(styleElement);
    const styleSheet = styleElement.sheet;
    if (styleSheet === null) throw new Error('disabled stylesheet fixture did not create a sheet');
    styleSheet.disabled = true;
    const element = document.createElement('div');
    element.className = 'disabled-sheet-ltr';
    document.body.appendChild(element);

    expect(resolveTextDirection(element, 'rtl')).toBe('rtl');
    styleElement.remove();
  });
});
