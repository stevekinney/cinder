/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../test/happy-dom.ts';
import {
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

  test('evaluates size queries against the nearest eligible query container', () => {
    const originalGetComputedStyle = window.getComputedStyle;
    const originalGlobalGetComputedStyle = globalThis.getComputedStyle;
    const container = document.createElement('section');
    container.style.setProperty('container-type', 'inline-size');
    Object.defineProperty(container, 'getBoundingClientRect', {
      value: () => ({ width: 400 }),
    });
    const wrapper = document.createElement('div');
    Object.defineProperty(wrapper, 'getBoundingClientRect', {
      value: () => ({ width: 100 }),
    });
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
    Object.defineProperty(container, 'getBoundingClientRect', {
      value: () => ({ width: 340 }),
    });
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

  test('uses CSSContainerRule.containerName for named size queries', () => {
    const container = document.createElement('section');
    container.style.setProperty('container-type', 'inline-size');
    container.style.setProperty('container-name', 'sidebar');
    Object.defineProperty(container, 'getBoundingClientRect', { value: () => ({ width: 400 }) });
    const wrapper = document.createElement('div');
    wrapper.style.setProperty('container-type', 'inline-size');
    Object.defineProperty(wrapper, 'getBoundingClientRect', { value: () => ({ width: 100 }) });
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
    Object.defineProperty(container, 'getBoundingClientRect', { value: () => ({ width: 400 }) });
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

  test('evaluates inline-size range queries against the content box', () => {
    const container = document.createElement('section');
    container.style.setProperty('container-type', 'inline-size');
    container.style.paddingInlineStart = '20px';
    container.style.paddingInlineEnd = '20px';
    Object.defineProperty(container, 'getBoundingClientRect', { value: () => ({ width: 340 }) });
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

  test('resolves rem thresholds from the document root font size', () => {
    const root = document.documentElement;
    const previousFontSize = root.style.fontSize;
    root.style.fontSize = '20px';
    const container = document.createElement('section');
    container.style.setProperty('container-type', 'inline-size');
    Object.defineProperty(container, 'getBoundingClientRect', { value: () => ({ width: 350 }) });
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

  test('does not observe a missing element', () => {
    expect(observeTextDirection(null, () => {})).toBeUndefined();
  });
});
