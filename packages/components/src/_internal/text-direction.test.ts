/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../test/happy-dom.ts';
import {
  elementDirectionStyleOverride,
  isContainerRule,
  isRightToLeftElement,
  observeTextDirection,
  resolveTextDirection,
} from './text-direction.ts';

setupHappyDom();

afterEach(() => {
  document.documentElement.removeAttribute('dir');
  document.body.replaceChildren();
});

function withDocumentStyleSheets<T>(styleSheets: unknown[], callback: () => T): T {
  const originalDescriptor = Object.getOwnPropertyDescriptor(document, 'styleSheets');
  Object.defineProperty(document, 'styleSheets', {
    configurable: true,
    value: styleSheets,
  });
  try {
    return callback();
  } finally {
    if (originalDescriptor) {
      Object.defineProperty(document, 'styleSheets', originalDescriptor);
    } else {
      Reflect.deleteProperty(document, 'styleSheets');
    }
  }
}

function withDocumentAdoptedStyleSheets<T>(styleSheets: unknown[], callback: () => T): T {
  const originalDescriptor = Object.getOwnPropertyDescriptor(document, 'adoptedStyleSheets');
  Object.defineProperty(document, 'adoptedStyleSheets', {
    configurable: true,
    value: styleSheets,
  });
  try {
    return callback();
  } finally {
    if (originalDescriptor)
      Object.defineProperty(document, 'adoptedStyleSheets', originalDescriptor);
    else Reflect.deleteProperty(document, 'adoptedStyleSheets');
  }
}

function createStyleRule(options: {
  selectorText: string;
  direction?: string;
  cssRules?: unknown;
}): CSSRule {
  const rule = {
    cssText: options.selectorText,
    type: 1,
    selectorText: options.selectorText,
    style: { direction: options.direction ?? '' },
  };
  if ('cssRules' in options) {
    Object.defineProperty(rule, 'cssRules', {
      configurable: true,
      get: () => options.cssRules,
    });
  }
  return rule as unknown as CSSRule;
}

function createRuleWithThrowingCssRules(): CSSRule {
  const rule = { cssText: '@media all {}', type: 4, conditionText: 'all', media: {} };
  Object.defineProperty(rule, 'cssRules', {
    configurable: true,
    get: () => {
      throw new Error('stylesheet unavailable');
    },
  });
  return rule as unknown as CSSRule;
}

function createStyleSheetWithThrowingRules(): CSSStyleSheet {
  const sheet = {};
  Object.defineProperty(sheet, 'cssRules', {
    configurable: true,
    get: () => {
      throw new Error('stylesheet unavailable');
    },
  });
  return sheet as CSSStyleSheet;
}

describe('resolveTextDirection', () => {
  test('only treats unknown CSS rules with container at-rule text as container rules', () => {
    const unknownRule = { cssText: '@unknown (min-width: 1px) {}', type: 0 } as unknown as CSSRule;
    const containerRule = {
      cssText: '@container (min-width: 1px) {}',
      type: 0,
    } as unknown as CSSRule;
    expect(isContainerRule(unknownRule)).toBe(false);
    expect(isContainerRule(containerRule)).toBe(true);
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
      const style = originalWindowGetComputedStyle(target);
      Object.defineProperty(style, 'direction', { value: 'ltr', configurable: true });
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

  test('prefers an ancestor class style over a generated element direction', () => {
    const styleElement = document.createElement('style');
    styleElement.textContent = '.ancestor-ltr { direction: ltr; }';
    document.head.append(styleElement);
    const wrapper = document.createElement('div');
    wrapper.dir = 'rtl';
    wrapper.className = 'ancestor-ltr';
    const element = document.createElement('div');
    element.dir = 'rtl';
    wrapper.append(element);
    document.body.append(wrapper);

    expect(resolveTextDirection(element, 'rtl', { ignoreElementDirectionAttribute: true })).toBe(
      'ltr',
    );
    styleElement.remove();
  });

  test('prefers provider fallback over document root direction', () => {
    document.documentElement.dir = 'ltr';
    const element = document.createElement('div');
    document.body.appendChild(element);

    expect(resolveTextDirection(element, 'rtl')).toBe('rtl');
  });

  test('prefers provider fallback over root CSS direction', () => {
    const styleElement = document.createElement('style');
    styleElement.textContent = 'html { direction: ltr; }';
    document.head.append(styleElement);
    const element = document.createElement('div');
    document.body.appendChild(element);

    expect(resolveTextDirection(element, 'rtl')).toBe('rtl');
    styleElement.remove();
  });

  test('uses document root direction when no local or provider direction exists', () => {
    document.documentElement.dir = 'rtl';
    const element = document.createElement('div');
    document.body.appendChild(element);

    expect(resolveTextDirection(element)).toBe('rtl');
  });

  test('uses computed direction for local auto direction before parent fallback', () => {
    const originalWindowGetComputedStyle = window.getComputedStyle;
    const originalGlobalGetComputedStyle = globalThis.getComputedStyle;
    const getComputedStyleOverride = ((target: Element) => {
      const style = originalWindowGetComputedStyle(target);
      if (target instanceof HTMLElement && target.dir === 'auto') {
        Object.defineProperty(style, 'direction', { value: 'rtl', configurable: true });
      }
      return style;
    }) as typeof window.getComputedStyle;
    window.getComputedStyle = getComputedStyleOverride;
    globalThis.getComputedStyle = getComputedStyleOverride;

    try {
      const wrapper = document.createElement('div');
      wrapper.dir = 'ltr';
      const element = document.createElement('div');
      element.dir = 'auto';
      wrapper.appendChild(element);
      document.body.appendChild(wrapper);

      expect(resolveTextDirection(element)).toBe('rtl');
    } finally {
      window.getComputedStyle = originalWindowGetComputedStyle;
      globalThis.getComputedStyle = originalGlobalGetComputedStyle;
    }
  });

  test('uses computed direction from an auto ancestor before provider fallback', () => {
    const originalWindowGetComputedStyle = window.getComputedStyle;
    const originalGlobalGetComputedStyle = globalThis.getComputedStyle;
    const getComputedStyleOverride = ((target: Element) => {
      const style = originalWindowGetComputedStyle(target);
      if (target instanceof HTMLElement && target.dir === 'auto') {
        Object.defineProperty(style, 'direction', { value: 'ltr', configurable: true });
      }
      return style;
    }) as typeof window.getComputedStyle;
    window.getComputedStyle = getComputedStyleOverride;
    globalThis.getComputedStyle = getComputedStyleOverride;

    try {
      const wrapper = document.createElement('div');
      wrapper.dir = 'auto';
      const element = document.createElement('div');
      wrapper.appendChild(element);
      document.body.appendChild(wrapper);

      expect(resolveTextDirection(element, 'rtl')).toBe('ltr');
    } finally {
      window.getComputedStyle = originalWindowGetComputedStyle;
      globalThis.getComputedStyle = originalGlobalGetComputedStyle;
    }
  });

  test('uses computed direction before provider fallback', () => {
    const wrapper = document.createElement('section');
    wrapper.style.direction = 'ltr';
    const element = document.createElement('div');
    wrapper.appendChild(element);
    document.body.appendChild(wrapper);

    expect(resolveTextDirection(element, 'rtl')).toBe('ltr');
  });

  test('uses inherited CSS direction before provider fallback', () => {
    const originalWindowGetComputedStyle = window.getComputedStyle;
    const originalGlobalGetComputedStyle = globalThis.getComputedStyle;
    const getComputedStyleOverride = ((target: Element) => {
      const style = originalWindowGetComputedStyle(target);
      const direction =
        target === document.documentElement
          ? 'ltr'
          : target instanceof HTMLElement && target.closest('.css-direction')
            ? 'rtl'
            : style.direction;
      Object.defineProperty(style, 'direction', { value: direction, configurable: true });
      return style;
    }) as typeof window.getComputedStyle;
    window.getComputedStyle = getComputedStyleOverride;
    globalThis.getComputedStyle = getComputedStyleOverride;

    try {
      const wrapper = document.createElement('section');
      wrapper.className = 'css-direction';
      const element = document.createElement('div');
      wrapper.appendChild(element);
      document.body.appendChild(wrapper);

      expect(resolveTextDirection(element, 'ltr')).toBe('rtl');
    } finally {
      window.getComputedStyle = originalWindowGetComputedStyle;
      globalThis.getComputedStyle = originalGlobalGetComputedStyle;
    }
  });

  test('uses class-applied computed direction before provider fallback', () => {
    const originalWindowGetComputedStyle = window.getComputedStyle;
    const originalGlobalGetComputedStyle = globalThis.getComputedStyle;
    const styleElement = document.createElement('style');
    styleElement.textContent = '.ltr-reset { direction: ltr; }';
    document.head.appendChild(styleElement);
    const getComputedStyleOverride = ((target: Element) => {
      const style = originalWindowGetComputedStyle(target);
      Object.defineProperty(style, 'direction', { value: 'ltr', configurable: true });
      return style;
    }) as typeof window.getComputedStyle;
    window.getComputedStyle = getComputedStyleOverride;
    globalThis.getComputedStyle = getComputedStyleOverride;

    try {
      const wrapper = document.createElement('section');
      wrapper.className = 'ltr-reset';
      const element = document.createElement('div');
      wrapper.appendChild(element);
      document.body.appendChild(wrapper);

      expect(resolveTextDirection(element, 'rtl')).toBe('ltr');
    } finally {
      window.getComputedStyle = originalWindowGetComputedStyle;
      globalThis.getComputedStyle = originalGlobalGetComputedStyle;
      styleElement.remove();
    }
  });

  test('uses grouped CSS direction rules before provider fallback', () => {
    const originalWindowGetComputedStyle = window.getComputedStyle;
    const originalGlobalGetComputedStyle = globalThis.getComputedStyle;
    const styleElement = document.createElement('style');
    styleElement.textContent = '@media all { .ltr-reset-grouped { direction: ltr; } }';
    document.head.appendChild(styleElement);
    const getComputedStyleOverride = ((target: Element) => {
      const style = originalWindowGetComputedStyle(target);
      Object.defineProperty(style, 'direction', { value: 'ltr', configurable: true });
      return style;
    }) as typeof window.getComputedStyle;
    window.getComputedStyle = getComputedStyleOverride;
    globalThis.getComputedStyle = getComputedStyleOverride;

    try {
      const wrapper = document.createElement('section');
      wrapper.className = 'ltr-reset-grouped';
      const element = document.createElement('div');
      wrapper.appendChild(element);
      document.body.appendChild(wrapper);

      expect(resolveTextDirection(element, 'rtl')).toBe('ltr');
    } finally {
      window.getComputedStyle = originalWindowGetComputedStyle;
      globalThis.getComputedStyle = originalGlobalGetComputedStyle;
      styleElement.remove();
    }
  });

  test('uses nested style rules that do not set direction on the outer rule', () => {
    const originalWindowGetComputedStyle = window.getComputedStyle;
    const originalGlobalGetComputedStyle = globalThis.getComputedStyle;
    const getComputedStyleOverride = ((target: Element) => {
      const style = originalWindowGetComputedStyle(target);
      Object.defineProperty(style, 'direction', { value: 'ltr', configurable: true });
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

  test('ignores direction rules inside inactive container-query shims', () => {
    const originalWindowGetComputedStyle = window.getComputedStyle;
    const originalGlobalGetComputedStyle = globalThis.getComputedStyle;
    const getComputedStyleOverride = ((target: Element) => {
      const style = originalWindowGetComputedStyle(target);
      Object.defineProperty(style, 'direction', { value: 'ltr', configurable: true });
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
      const outerRule = {
        cssText: '@container style(--example: true) { .container-ltr-reset { direction: ltr; } }',
        type: 0,
        conditionText: 'style(--example: true)',
        cssRules: [nestedRule],
      } as unknown as CSSRule;

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
    const originalWindowGetComputedStyle = window.getComputedStyle;
    const originalGlobalGetComputedStyle = globalThis.getComputedStyle;
    window.getComputedStyle = undefined as unknown as typeof window.getComputedStyle;
    globalThis.getComputedStyle = undefined as unknown as typeof globalThis.getComputedStyle;
    try {
      const element = document.createElement('div');
      document.body.appendChild(element);
      const nestedRule = createStyleRule({ selectorText: 'div', direction: 'ltr' });
      const outerRule = {
        cssText: '@container (min-width: 1px) { div { direction: ltr; } }',
        type: 0,
        conditionText: '(min-width: 1px)',
        cssRules: [nestedRule],
      } as unknown as CSSRule;
      const direction = withDocumentStyleSheets([{ cssRules: [outerRule] }], () =>
        resolveTextDirection(element, 'rtl'),
      );
      expect(direction).toBe('rtl');
    } finally {
      window.getComputedStyle = originalWindowGetComputedStyle;
      globalThis.getComputedStyle = originalGlobalGetComputedStyle;
    }
  });

  test('uses an active style container query direction rule', () => {
    const wrapper = document.createElement('section');
    wrapper.style.setProperty('--example', 'true');
    const element = document.createElement('div');
    wrapper.appendChild(element);
    document.body.appendChild(wrapper);
    const nestedRule = createStyleRule({ selectorText: '.container-ltr-reset', direction: 'ltr' });
    element.className = 'container-ltr-reset';
    const outerRule = {
      cssText: '@container style(--example: true) { .container-ltr-reset { direction: ltr; } }',
      type: 0,
      conditionText: 'style(--example: true)',
      cssRules: [nestedRule],
    } as unknown as CSSRule;
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
    const outerRule = {
      cssText:
        '@container style(--example: true) and (min-width: 40rem) { .compound-container-ltr { direction: ltr; } }',
      type: 0,
      conditionText: 'style(--example: true) and (min-width: 40rem)',
      cssRules: [nestedRule],
    } as unknown as CSSRule;
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
    const outerRule = {
      cssText: '@container (min-width: 20rem) { .container-ltr-reset { direction: ltr; } }',
      type: 0,
      conditionText: '(min-width: 20rem)',
      cssRules: [nestedRule],
    } as unknown as CSSRule;
    const getComputedStyleOverride = ((target: Element) => {
      const style = originalGetComputedStyle(target);
      if (target === container)
        Object.defineProperty(style, 'containerType', { value: 'inline-size' });
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
    const outerRule = {
      cssText: '@container (min-width: 20rem) { .content-box-container-ltr { direction: ltr; } }',
      type: 0,
      conditionText: '(min-width: 20rem)',
      cssRules: [nestedRule],
    } as unknown as CSSRule;
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
    const outerRule = {
      cssText:
        '@container (min-width: 30em) { .unsupported-unit-container-ltr { direction: ltr; } }',
      type: 0,
      conditionText: '(min-width: 30em)',
      cssRules: [nestedRule],
    } as unknown as CSSRule;
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
    const outerRule = {
      cssText:
        '@container (min-width: 20px) and (max-width: 40em) { .mixed-unit-container-ltr { direction: ltr; } }',
      type: 0,
      conditionText: '(min-width: 20px) and (max-width: 40em)',
      cssRules: [nestedRule],
    } as unknown as CSSRule;
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
    const outerRule = {
      cssText:
        '@container (min-height: 40rem) { .unsupported-feature-container-ltr { direction: ltr; } }',
      type: 0,
      conditionText: '(min-height: 40rem)',
      cssRules: [nestedRule],
    } as unknown as CSSRule;
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
    const outerRule = {
      cssText:
        '@container (max-inline-size: 10rem) or (min-inline-size: 20rem) { .disjunctive-inline-size-container-ltr { direction: ltr; } }',
      type: 0,
      conditionText: '(max-inline-size: 10rem) or (min-inline-size: 20rem)',
      cssRules: [nestedRule],
    } as unknown as CSSRule;
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
    const outerRule = {
      cssText: '@container ((max-width: 30rem) or (width > 50rem)) and (width > 40rem) {}',
      type: 0,
      conditionText: '((max-width: 30rem) OR (width > 50rem)) AND (width > 40rem)',
      cssRules: [nestedRule],
    } as unknown as CSSRule;
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
    const outerRule = {
      cssText: '@container style(--swatch: rgb(0 0 0)) {}',
      type: 0,
      conditionText: 'style(--swatch: rgb(0 0 0))',
      cssRules: [nestedRule],
    } as unknown as CSSRule;
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
    const outerRule = {
      cssText: '@container (width: 20rem) { .equality-container-ltr { direction: ltr; } }',
      type: 0,
      conditionText: '(width: 20rem)',
      cssRules: [nestedRule],
    } as unknown as CSSRule;
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
    const outerRule = {
      cssText: '@container (width: 20rem) { .equality-exact-container-ltr { direction: ltr; } }',
      type: 0,
      conditionText: '(width: 20rem)',
      cssRules: [nestedRule],
    } as unknown as CSSRule;
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
    (styleElement.sheet as CSSStyleSheet).disabled = true;
    const element = document.createElement('div');
    element.className = 'disabled-sheet-ltr';
    document.body.appendChild(element);

    expect(resolveTextDirection(element, 'rtl')).toBe('rtl');
    styleElement.remove();
  });

  test('ignores direction rules in a stylesheet whose media does not match', () => {
    const originalMatchMedia = globalThis.matchMedia;
    globalThis.matchMedia = ((query: string) =>
      ({ matches: false, media: query }) as MediaQueryList) as typeof matchMedia;
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
    const outerRule = {
      cssText: '@container sidebar (min-width: 20rem) { .named-container-ltr { direction: ltr; } }',
      type: 0,
      conditionText: '(min-width: 20rem)',
      containerName: 'sidebar',
      cssRules: [nestedRule],
    } as unknown as CSSRule;
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
    const outerRule = {
      cssText: '@container sidebar style(--theme: dark) { .named-style-ltr { direction: ltr; } }',
      type: 0,
      conditionText: 'style(--theme: dark)',
      containerName: 'sidebar',
      cssRules: [nestedRule],
    } as unknown as CSSRule;
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

  test('evaluates range-syntax size queries', () => {
    const container = document.createElement('section');
    container.style.setProperty('container-type', 'inline-size');
    Object.defineProperty(container, 'offsetWidth', { value: 400, configurable: true });
    const element = document.createElement('div');
    element.className = 'range-container-ltr';
    container.appendChild(element);
    document.body.appendChild(container);
    const nestedRule = createStyleRule({ selectorText: '.range-container-ltr', direction: 'ltr' });
    const outerRule = {
      cssText: '@container (width >= 20rem) { .range-container-ltr { direction: ltr; } }',
      type: 0,
      conditionText: '(width >= 20rem)',
      cssRules: [nestedRule],
    } as unknown as CSSRule;
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
    const outerRule = {
      cssText:
        '@container (width >= 20rem) and (width <= 40rem) { .conjunctive-range-container-ltr { direction: ltr; } }',
      type: 0,
      conditionText: '(width >= 20rem) and (width <= 40rem)',
      cssRules: [nestedRule],
    } as unknown as CSSRule;
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
    const outerRule = {
      cssText:
        '@container (min-width: 20rem) and (width <= 40rem) { .mixed-constraint-container-ltr { direction: ltr; } }',
      type: 0,
      conditionText: '(min-width: 20rem) and (width <= 40rem)',
      cssRules: [nestedRule],
    } as unknown as CSSRule;
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

  test('evaluates value-first range syntax below, inside, and above the range', () => {
    const nestedRule = createStyleRule({
      selectorText: '.value-first-range-ltr',
      direction: 'ltr',
    });
    const outerRule = {
      cssText:
        '@container (20rem <= width <= 40rem) { .value-first-range-ltr { direction: ltr; } }',
      type: 0,
      conditionText: '(20rem <= width <= 40rem)',
      cssRules: [nestedRule],
    } as unknown as CSSRule;
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
      const style = originalWindowGetComputedStyle(target);
      Object.defineProperty(style, 'direction', { value: 'ltr', configurable: true });
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
      const style = originalWindowGetComputedStyle(target);
      Object.defineProperty(style, 'direction', { value: 'ltr', configurable: true });
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
    const outerRule = {
      cssText:
        '@container (inline-size >= 20rem) { .inline-size-container-ltr { direction: ltr; } }',
      type: 0,
      conditionText: '(inline-size >= 20rem)',
      cssRules: [nestedRule],
    } as unknown as CSSRule;
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
    container.style.paddingBlockStart = '20px';
    container.style.paddingBlockEnd = '20px';
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
    const outerRule = {
      cssText:
        '@container (inline-size >= 20rem) { .vertical-inline-size-container-ltr { direction: ltr; } }',
      type: 0,
      conditionText: '(inline-size >= 20rem)',
      cssRules: [nestedRule],
    } as unknown as CSSRule;
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
    const outerRule = {
      cssText:
        '@container (min-width: 20rem) { .vertical-physical-width-container-ltr { direction: ltr; } }',
      type: 0,
      conditionText: '(min-width: 20rem)',
      cssRules: [nestedRule],
    } as unknown as CSSRule;
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
    const outerRule = {
      cssText: '@container (min-width: 20rem) { .rem-container-ltr { direction: ltr; } }',
      type: 0,
      conditionText: '(min-width: 20rem)',
      cssRules: [nestedRule],
    } as unknown as CSSRule;
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
    const outerRule = {
      cssText: '@container (min-width: 300px) { .transformed-container-ltr { direction: ltr; } }',
      type: 0,
      conditionText: '(min-width: 300px)',
      cssRules: [nestedRule],
    } as unknown as CSSRule;
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
      const style = originalWindowGetComputedStyle(target);
      Object.defineProperty(style, 'direction', { value: 'ltr', configurable: true });
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
      const style = originalWindowGetComputedStyle(target);
      Object.defineProperty(style, 'direction', { value: 'ltr', configurable: true });
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
      const style = originalWindowGetComputedStyle(target);
      Object.defineProperty(style, 'direction', {
        value:
          target instanceof HTMLElement && target.classList.contains('cross-origin-rtl')
            ? 'rtl'
            : 'ltr',
        configurable: true,
      });
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
      const style = originalWindowGetComputedStyle(target);
      if (target instanceof HTMLElement) {
        const dir = target.getAttribute('dir');
        if (dir === 'rtl' || dir === 'ltr') {
          Object.defineProperty(style, 'direction', { value: dir, configurable: true });
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

  test('uses grouped CSS direction rules inside active media conditions', () => {
    const originalWindowGetComputedStyle = window.getComputedStyle;
    const originalGlobalGetComputedStyle = globalThis.getComputedStyle;
    const originalMatchMedia = globalThis.matchMedia;
    const styleElement = document.createElement('style');
    styleElement.textContent = '@media (min-width: 1px) { .active-ltr-reset { direction: ltr; } }';
    document.head.appendChild(styleElement);
    const getComputedStyleOverride = ((target: Element) => {
      const style = originalWindowGetComputedStyle(target);
      Object.defineProperty(style, 'direction', { value: 'ltr', configurable: true });
      return style;
    }) as typeof window.getComputedStyle;
    const matchMediaOverride = ((query: string) =>
      ({
        matches: true,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => true,
      }) satisfies MediaQueryList) as typeof globalThis.matchMedia;
    window.getComputedStyle = getComputedStyleOverride;
    globalThis.getComputedStyle = getComputedStyleOverride;
    globalThis.matchMedia = matchMediaOverride;

    try {
      const wrapper = document.createElement('section');
      wrapper.className = 'active-ltr-reset';
      const element = document.createElement('div');
      wrapper.appendChild(element);
      document.body.appendChild(wrapper);

      expect(resolveTextDirection(element, 'rtl')).toBe('ltr');
    } finally {
      window.getComputedStyle = originalWindowGetComputedStyle;
      globalThis.getComputedStyle = originalGlobalGetComputedStyle;
      globalThis.matchMedia = originalMatchMedia;
      styleElement.remove();
    }
  });

  test('uses grouped CSS direction rules inside active supports conditions', () => {
    const originalWindowGetComputedStyle = window.getComputedStyle;
    const originalGlobalGetComputedStyle = globalThis.getComputedStyle;
    const originalCssSupports = globalThis.CSS.supports;
    const styleElement = document.createElement('style');
    styleElement.textContent =
      '@supports (display: grid) { .supports-ltr-reset { direction: ltr; } }';
    document.head.appendChild(styleElement);
    const getComputedStyleOverride = ((target: Element) => {
      const style = originalWindowGetComputedStyle(target);
      Object.defineProperty(style, 'direction', { value: 'ltr', configurable: true });
      return style;
    }) as typeof window.getComputedStyle;
    globalThis.CSS.supports = (() => true) as typeof globalThis.CSS.supports;
    window.getComputedStyle = getComputedStyleOverride;
    globalThis.getComputedStyle = getComputedStyleOverride;

    try {
      const wrapper = document.createElement('section');
      wrapper.className = 'supports-ltr-reset';
      const element = document.createElement('div');
      wrapper.appendChild(element);
      document.body.appendChild(wrapper);

      expect(resolveTextDirection(element, 'rtl')).toBe('ltr');
    } finally {
      window.getComputedStyle = originalWindowGetComputedStyle;
      globalThis.getComputedStyle = originalGlobalGetComputedStyle;
      globalThis.CSS.supports = originalCssSupports;
      styleElement.remove();
    }
  });

  test('ignores grouped CSS direction rules inside inactive media conditions', () => {
    const originalWindowGetComputedStyle = window.getComputedStyle;
    const originalGlobalGetComputedStyle = globalThis.getComputedStyle;
    const originalMatchMedia = globalThis.matchMedia;
    const styleElement = document.createElement('style');
    styleElement.textContent =
      '@media (min-width: 99999px) { .inactive-ltr-reset { direction: ltr; } }';
    document.head.appendChild(styleElement);
    const getComputedStyleOverride = ((target: Element) => {
      const style = originalWindowGetComputedStyle(target);
      Object.defineProperty(style, 'direction', { value: 'ltr', configurable: true });
      return style;
    }) as typeof window.getComputedStyle;
    const matchMediaOverride = ((query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => true,
      }) satisfies MediaQueryList) as typeof globalThis.matchMedia;
    window.getComputedStyle = getComputedStyleOverride;
    globalThis.getComputedStyle = getComputedStyleOverride;
    globalThis.matchMedia = matchMediaOverride;

    try {
      const wrapper = document.createElement('section');
      wrapper.className = 'inactive-ltr-reset';
      const element = document.createElement('div');
      wrapper.appendChild(element);
      document.body.appendChild(wrapper);

      expect(resolveTextDirection(element, 'rtl')).toBe('rtl');
    } finally {
      window.getComputedStyle = originalWindowGetComputedStyle;
      globalThis.getComputedStyle = originalGlobalGetComputedStyle;
      globalThis.matchMedia = originalMatchMedia;
      styleElement.remove();
    }
  });

  test('uses provider fallback before unrelated app classes with default computed direction', () => {
    const originalWindowGetComputedStyle = window.getComputedStyle;
    const originalGlobalGetComputedStyle = globalThis.getComputedStyle;
    const getComputedStyleOverride = ((target: Element) => {
      const style = originalWindowGetComputedStyle(target);
      Object.defineProperty(style, 'direction', { value: 'ltr', configurable: true });
      return style;
    }) as typeof window.getComputedStyle;
    window.getComputedStyle = getComputedStyleOverride;
    globalThis.getComputedStyle = getComputedStyleOverride;

    try {
      const wrapper = document.createElement('section');
      wrapper.className = 'app-shell';
      const element = document.createElement('div');
      wrapper.appendChild(element);
      document.body.appendChild(wrapper);

      expect(resolveTextDirection(element, 'rtl')).toBe('rtl');
    } finally {
      window.getComputedStyle = originalWindowGetComputedStyle;
      globalThis.getComputedStyle = originalGlobalGetComputedStyle;
    }
  });

  test('prefers nearer inline style direction over farther dir ancestor', () => {
    const outer = document.createElement('div');
    outer.dir = 'rtl';
    const wrapper = document.createElement('section');
    wrapper.style.direction = 'ltr';
    const element = document.createElement('div');
    wrapper.appendChild(element);
    outer.appendChild(wrapper);
    document.body.appendChild(outer);

    expect(resolveTextDirection(element)).toBe('ltr');
  });

  test('observes text mutations under auto direction sources', async () => {
    const wrapper = document.createElement('section');
    wrapper.dir = 'auto';
    wrapper.textContent = 'Schedule';
    const element = document.createElement('div');
    wrapper.appendChild(element);
    document.body.appendChild(wrapper);

    let changes = 0;
    const disconnect = observeTextDirection(element, () => {
      changes += 1;
    });

    wrapper.firstChild!.textContent = 'جدول';
    await new Promise((resolve) => setTimeout(resolve, 0));
    disconnect?.();

    expect(changes).toBeGreaterThan(0);
  });

  test('observes direction attribute changes along the ancestor chain', async () => {
    const wrapper = document.createElement('section');
    const element = document.createElement('div');
    wrapper.appendChild(element);
    document.body.appendChild(wrapper);

    let changes = 0;
    const disconnect = observeTextDirection(element, () => {
      changes += 1;
    });

    wrapper.dir = 'rtl';
    await new Promise((resolve) => setTimeout(resolve, 0));
    disconnect?.();

    expect(changes).toBeGreaterThan(0);
  });

  test('observes ancestor attribute changes beyond dir, class, and style', async () => {
    // A selector can key its `direction` styling off any ancestor attribute
    // (e.g. `[data-flow='rtl']`), not only `dir`, `class`, or `style`, so the
    // observer must not filter those out.
    const wrapper = document.createElement('section');
    const element = document.createElement('div');
    wrapper.appendChild(element);
    document.body.appendChild(wrapper);

    let changes = 0;
    const disconnect = observeTextDirection(element, () => {
      changes += 1;
    });

    wrapper.setAttribute('data-flow', 'rtl');
    await new Promise((resolve) => setTimeout(resolve, 0));
    disconnect?.();

    expect(changes).toBeGreaterThan(0);
  });

  test('rebuilds direction observers after reparenting', async () => {
    const oldParent = document.createElement('section');
    oldParent.dir = 'ltr';
    const newParent = document.createElement('section');
    newParent.dir = 'rtl';
    const element = document.createElement('div');
    oldParent.append(element);
    document.body.append(oldParent, newParent);

    let changes = 0;
    const disconnect = observeTextDirection(element, () => {
      changes += 1;
    });
    newParent.append(element);
    await new Promise((resolve) => setTimeout(resolve, 0));
    disconnect?.();

    expect(changes).toBeGreaterThan(0);
    expect(resolveTextDirection(element)).toBe('rtl');
  });

  test('does not observe a missing element', () => {
    expect(observeTextDirection(null, () => {})).toBeUndefined();
  });
});
