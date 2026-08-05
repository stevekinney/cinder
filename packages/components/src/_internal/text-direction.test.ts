/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../test/happy-dom.ts';
import {
  evaluateLogicalContainerCondition,
  isFullyParsedContainerCondition,
} from './text-direction-container.ts';
import {
  hasScopePseudoClass,
  matchesDirectionStyleRule,
  replaceScopePseudoClass,
} from './text-direction-css.ts';
import {
  elementDirectionStyleOverride,
  isContainerRule,
  isRightToLeftElement,
  observeTextDirection,
  observeTextDirectionMediaQueries,
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
  test('recognizes only the actual :scope pseudo-class token', () => {
    expect(hasScopePseudoClass(':scope')).toBe(true);
    expect(hasScopePseudoClass(':SCOPE > .target')).toBe(true);
    expect(hasScopePseudoClass(':scopeX')).toBe(false);
    expect(hasScopePseudoClass(':scoped')).toBe(false);
    expect(replaceScopePseudoClass(':scopeX :scoped', '[data-root]')).toBe(':scopeX :scoped');
  });

  test('fails closed when a container condition contains unparsed syntax', () => {
    const cases: [string, boolean][] = [
      ['(min-width: 20px)', true],
      ['(max-inline-size: 40rem)', true],
      ['(width: 20px)', true],
      ['(inline-size >= 20rem)', true],
      ['(20rem <= width <= 40rem)', true],
      ['(min-width: 20px) and (max-width: 40rem)', true],
      ['(min-width: 20px) or (max-width: 40rem)', true],
      ['not (min-width: 20px)', true],
      ['not ((min-width: 20px) or (max-width: 40rem))', true],
      ['not min-width: 20px', false],
      ['not(width >= 20px)', false],
      ['(min-width: 20px) unexpected', false],
      ['(width >= 20px) xor (width <= 40px)', false],
      ['foo(width >= 20px)', false],
      ['(min-width: 20px) and (unknown-feature: 1px)', false],
      ['(min-width: 1.2.3px)', false],
      ['min-width: 20px', false],
      ['min-width: 20px and max-width: 40px', false],
      ['(min-width: 20px) and (max-width: 40px) or (width: 100px)', false],
      ['(20px < width > 40px)', false],
      ['not (min-width: 20px) and (max-width: 40rem)', false],
      ['not (min-width: 20px) or (max-width: 40rem)', false],
      ['(not (min-width: 20px)) and (max-width: 40rem)', true],
    ];
    for (const [condition, expected] of cases) {
      expect(isFullyParsedContainerCondition(condition), condition).toBe(expected);
    }
  });

  test('evaluates grouped NOT over OR without treating it as an implicit conjunction', () => {
    const condition = 'not ((min-width: 20px) or (max-width: 10px))';
    expect(evaluateLogicalContainerCondition(condition, 5, 16, 5)).toBe(false);
    expect(evaluateLogicalContainerCondition(condition, 30, 16, 30)).toBe(false);
    expect(evaluateLogicalContainerCondition(condition, 15, 16, 15)).toBe(true);
    expect(evaluateLogicalContainerCondition('not (min-width: 20px)', 10, 16, 10)).toBe(true);
    expect(evaluateLogicalContainerCondition('not (min-width: 20px)', 30, 16, 30)).toBe(false);
    expect(evaluateLogicalContainerCondition('not min-width: 20px', 10, 16, 10)).toBe(false);
    expect(evaluateLogicalContainerCondition('not(width >= 20px)', 10, 16, 10)).toBe(false);
    expect(evaluateLogicalContainerCondition('min-width: 20px', 30, 16, 30)).toBe(false);
    expect(
      evaluateLogicalContainerCondition(
        '(min-width: 20px) and (max-width: 40px) or (width: 100px)',
        30,
        16,
        30,
      ),
    ).toBe(false);
    expect(evaluateLogicalContainerCondition('(20px < width > 40px)', 50, 16, 50)).toBe(false);
  });

  test('fails closed on an ungrouped NOT combined with AND/OR', () => {
    // `not (min-width: 20px) and (max-width: 40px)` is not valid CSS grammar
    // — `<media-and>` requires each operand to be `<media-in-parens>`, and a
    // bare `<media-not>` doesn't qualify without its own wrapping parens.
    // Without the fix this evaluated as `NOT(width >= 20px) AND (width <=
    // 40px)`, wrongly activating below 20px instead of failing closed.
    const ungrouped = 'not (min-width: 20px) and (max-width: 40px)';
    expect(evaluateLogicalContainerCondition(ungrouped, 10, 16, 10)).toBe(false);
    expect(evaluateLogicalContainerCondition(ungrouped, 30, 16, 30)).toBe(false);
    // The grouped equivalent remains valid and evaluates normally.
    const grouped = '(not (min-width: 20px)) and (max-width: 40px)';
    expect(evaluateLogicalContainerCondition(grouped, 10, 16, 10)).toBe(true);
    expect(evaluateLogicalContainerCondition(grouped, 30, 16, 30)).toBe(false);
  });

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

  test.each([
    ['inside the scope root', 'theme', 'rtl', 'ltr'],
    ['outside the scope root', 'other', 'rtl', 'rtl'],
    // A limit selector excludes an element's *proper descendants*, never
    // the scoping root itself — even when the root also happens to match
    // the limit selector (here `.theme` and `.stop` land on the same
    // element). Per the CSS Scoping spec, only a limit match strictly
    // between the root and the target excludes the target; the root
    // matching its own limit doesn't remove the root — or its
    // children — from scope.
    ['root also matching the scope limit stays in scope', 'theme stop', 'rtl', 'ltr'],
  ] as const)(
    'respects @scope boundaries when scanning direction rules: %s',
    (_, classes, fallback, expected) => {
      const originalWindowGetComputedStyle = window.getComputedStyle;
      const originalGlobalGetComputedStyle = globalThis.getComputedStyle;
      const getComputedStyleOverride = ((target: Element) => {
        const style = originalWindowGetComputedStyle(target);
        Object.defineProperty(style, 'direction', { value: 'ltr', configurable: true });
        return style;
      }) as typeof window.getComputedStyle;
      window.getComputedStyle = getComputedStyleOverride;
      globalThis.getComputedStyle = getComputedStyleOverride;

      const styleRule = createStyleRule({ selectorText: '.shell', direction: 'ltr' });
      const scopeRule = {
        type: 0,
        cssText: classes === 'theme stop' ? '@scope (.theme) to (.stop) {}' : '@scope (.theme) {}',
        cssRules: [styleRule],
      } as unknown as CSSRule;
      const wrapper = document.createElement('section');
      wrapper.className = classes;
      const element = document.createElement('div');
      element.className = 'shell';
      wrapper.appendChild(element);
      document.body.appendChild(wrapper);

      try {
        const direction = withDocumentStyleSheets([{ cssRules: [scopeRule] }], () =>
          resolveTextDirection(element, fallback),
        );
        expect(direction).toBe(expected);
      } finally {
        window.getComputedStyle = originalWindowGetComputedStyle;
        globalThis.getComputedStyle = originalGlobalGetComputedStyle;
      }
    },
  );

  test('supports selector-list scope roots and fails closed on malformed scope syntax', () => {
    const originalWindowGetComputedStyle = window.getComputedStyle;
    const originalGlobalGetComputedStyle = globalThis.getComputedStyle;
    const getComputedStyleOverride = ((target: Element) => {
      const style = originalWindowGetComputedStyle(target);
      Object.defineProperty(style, 'direction', { value: 'ltr', configurable: true });
      return style;
    }) as typeof window.getComputedStyle;
    window.getComputedStyle = getComputedStyleOverride;
    globalThis.getComputedStyle = getComputedStyleOverride;
    const styleRule = createStyleRule({ selectorText: '.shell', direction: 'ltr' });
    const wrapper = document.createElement('section');
    wrapper.className = 'alt';
    const element = document.createElement('div');
    element.className = 'shell';
    wrapper.append(element);
    document.body.append(wrapper);
    try {
      const selectorListScope = {
        type: 0,
        cssText: '@scope (.theme, .alt) {}',
        cssRules: [styleRule],
      } as unknown as CSSRule;
      expect(
        withDocumentStyleSheets([{ cssRules: [selectorListScope] }], () =>
          resolveTextDirection(element, 'rtl'),
        ),
      ).toBe('ltr');

      const malformedScope = {
        type: 0,
        cssText: '@scope (.theme, ) {}',
        cssRules: [styleRule],
      } as unknown as CSSRule;
      expect(
        withDocumentStyleSheets([{ cssRules: [malformedScope] }], () =>
          resolveTextDirection(element, 'rtl'),
        ),
      ).toBe('rtl');
    } finally {
      window.getComputedStyle = originalWindowGetComputedStyle;
      globalThis.getComputedStyle = originalGlobalGetComputedStyle;
    }
  });

  test('fails closed when scope root or limit selector matching throws', () => {
    const originalMatches = Element.prototype.matches;
    const originalWindowGetComputedStyle = window.getComputedStyle;
    const originalGlobalGetComputedStyle = globalThis.getComputedStyle;
    const getComputedStyleOverride = ((target: Element) => {
      const style = originalWindowGetComputedStyle(target);
      Object.defineProperty(style, 'direction', { value: 'ltr', configurable: true });
      return style;
    }) as typeof window.getComputedStyle;
    Element.prototype.matches = function (selector: string): boolean {
      if (selector === ':throwing-root' || selector === ':throwing-limit') {
        throw new SyntaxError(`Unsupported selector: ${selector}`);
      }
      return originalMatches.call(this, selector);
    };
    window.getComputedStyle = getComputedStyleOverride;
    globalThis.getComputedStyle = getComputedStyleOverride;

    const element = document.createElement('div');
    element.className = 'shell';
    document.body.append(element);
    const styleRule = createStyleRule({ selectorText: '.shell', direction: 'ltr' });
    const throwingRoot = {
      type: 0,
      cssText: '@scope (:throwing-root) {}',
      cssRules: [styleRule],
    } as unknown as CSSRule;
    const throwingLimit = {
      type: 0,
      cssText: '@scope () to (:throwing-limit) {}',
      cssRules: [styleRule],
    } as unknown as CSSRule;

    try {
      expect(
        withDocumentStyleSheets([{ cssRules: [throwingRoot] }], () =>
          resolveTextDirection(element, 'rtl'),
        ),
      ).toBe('rtl');
      expect(
        withDocumentStyleSheets([{ cssRules: [throwingLimit] }], () =>
          resolveTextDirection(element, 'rtl'),
        ),
      ).toBe('rtl');
    } finally {
      Element.prototype.matches = originalMatches;
      window.getComputedStyle = originalWindowGetComputedStyle;
      globalThis.getComputedStyle = originalGlobalGetComputedStyle;
    }
  });

  test('evaluates relative selectors against the resolved scope root', () => {
    const originalWindowGetComputedStyle = window.getComputedStyle;
    const originalGlobalGetComputedStyle = globalThis.getComputedStyle;
    const getComputedStyleOverride = ((target: Element) => {
      const style = originalWindowGetComputedStyle(target);
      Object.defineProperty(style, 'direction', { value: 'ltr', configurable: true });
      return style;
    }) as typeof window.getComputedStyle;
    window.getComputedStyle = getComputedStyleOverride;
    globalThis.getComputedStyle = getComputedStyleOverride;
    const root = document.createElement('section');
    root.className = 'theme';
    Object.defineProperty(root, 'querySelector', { value: () => null });
    const element = document.createElement('div');
    element.className = 'shell';
    root.append(element);
    document.body.append(root);
    const scopeRule = {
      type: 0,
      cssText: '@scope (.theme) {}',
      cssRules: [createStyleRule({ selectorText: ':scope > .shell', direction: 'ltr' })],
    } as unknown as CSSRule;
    try {
      expect(
        withDocumentStyleSheets([{ cssRules: [scopeRule] }], () =>
          resolveTextDirection(element, 'rtl'),
        ),
      ).toBe('ltr');
    } finally {
      window.getComputedStyle = originalWindowGetComputedStyle;
      globalThis.getComputedStyle = originalGlobalGetComputedStyle;
    }
  });

  test('matches the scope root itself when the selector is :scope', () => {
    const originalWindowGetComputedStyle = window.getComputedStyle;
    const originalGlobalGetComputedStyle = globalThis.getComputedStyle;
    const getComputedStyleOverride = ((target: Element) => {
      const style = originalWindowGetComputedStyle(target);
      Object.defineProperty(style, 'direction', { value: 'ltr', configurable: true });
      return style;
    }) as typeof window.getComputedStyle;
    window.getComputedStyle = getComputedStyleOverride;
    globalThis.getComputedStyle = getComputedStyleOverride;
    const root = document.createElement('section');
    root.className = 'theme';
    document.body.append(root);
    const scopeRule = {
      type: 0,
      cssText: '@scope (.theme) {}',
      cssRules: [createStyleRule({ selectorText: ':scope', direction: 'ltr' })],
    } as unknown as CSSRule;
    try {
      expect(
        withDocumentStyleSheets([{ cssRules: [scopeRule] }], () =>
          resolveTextDirection(root, 'rtl'),
        ),
      ).toBe('ltr');
    } finally {
      window.getComputedStyle = originalWindowGetComputedStyle;
      globalThis.getComputedStyle = originalGlobalGetComputedStyle;
    }
  });

  test('does not broaden an exact :scope scope-start beyond its stylesheet root', () => {
    const section = document.createElement('section');
    const styleElement = document.createElement('style');
    const target = document.createElement('div');
    target.className = 'shell';
    section.append(styleElement);
    document.body.append(section, target);
    const scopeRule = {
      type: 0,
      cssText: '@scope (:scope) {}',
      cssRules: [createStyleRule({ selectorText: '.shell', direction: 'ltr' })],
    } as unknown as CSSRule;
    expect(
      withDocumentStyleSheets([{ cssRules: [scopeRule], ownerNode: styleElement }], () =>
        matchesDirectionStyleRule(target, (parent) => parent.parentElement),
      ),
    ).toBe(false);
  });

  test('retains ordinary roots in mixed :scope root lists', () => {
    const theme = document.createElement('section');
    theme.className = 'theme';
    const target = document.createElement('div');
    target.className = 'shell';
    theme.append(target);
    document.body.append(theme);
    const scopeRule = {
      type: 0,
      cssText: '@scope (:scope, .theme) {}',
      cssRules: [createStyleRule({ selectorText: '.shell', direction: 'ltr' })],
    } as unknown as CSSRule;
    expect(
      withDocumentStyleSheets([{ cssRules: [scopeRule] }], () =>
        resolveTextDirection(target, 'rtl'),
      ),
    ).toBe('ltr');
  });

  test('does not activate the implicit root for an unsupported scope-pseudo selector', () => {
    // `:scope > .foo` IS now resolved (see the relative-`:scope`-root tests
    // below) — this stays 'rtl' because nothing at the top level is a
    // direct child of the implicit root matching `.foo`, and `.theme`
    // doesn't match anywhere either. It's a genuine non-match, not an
    // unsupported-selector short-circuit.
    const target = document.createElement('div');
    target.className = 'shell';
    document.body.append(target);
    const scopeRule = {
      type: 0,
      cssText: '@scope (:scope > .foo, .theme) {}',
      cssRules: [createStyleRule({ selectorText: '.shell', direction: 'ltr' })],
    } as unknown as CSSRule;
    expect(
      withDocumentStyleSheets([{ cssRules: [scopeRule] }], () =>
        resolveTextDirection(target, 'rtl'),
      ),
    ).toBe('rtl');
  });

  test('preserves the exact :scope alternative in an all-:scope root list when the other alternative cannot resolve', () => {
    // `@scope (:scope, :scope > .theme)` — the relative `:scope > .theme`
    // alternative doesn't structurally resolve to anything here (nothing
    // named `.theme` is a direct child of the implicit scope root), but the
    // supported exact `:scope` alternative must still independently
    // activate the scope. Previously, ANY non-exact `:scope`-containing
    // root selector in an all-`:scope` list (no ordinary selector to fall
    // back on) caused the whole prelude to fail closed, losing the exact
    // alternative too.
    const target = document.createElement('div');
    target.className = 'shell';
    document.body.append(target);
    const scopeRule = {
      type: 0,
      cssText: '@scope (:scope, :scope > .theme) {}',
      cssRules: [createStyleRule({ selectorText: '.shell', direction: 'ltr' })],
    } as unknown as CSSRule;
    expect(
      withDocumentStyleSheets([{ cssRules: [scopeRule] }], () =>
        resolveTextDirection(target, 'rtl'),
      ),
    ).toBe('ltr');
  });

  test('uses the document root for exact :scope scopes in document stylesheets', () => {
    const target = document.createElement('div');
    target.className = 'shell';
    document.body.append(target);
    const scopeRule = {
      type: 0,
      cssText: '@scope (:scope) {}',
      cssRules: [createStyleRule({ selectorText: '.shell', direction: 'ltr' })],
    } as unknown as CSSRule;
    expect(
      withDocumentStyleSheets([{ cssRules: [scopeRule] }], () =>
        resolveTextDirection(target, 'rtl'),
      ),
    ).toBe('ltr');
  });

  test('does not match descendants for a cloned :scope selector', () => {
    const originalWindowGetComputedStyle = window.getComputedStyle;
    const originalGlobalGetComputedStyle = globalThis.getComputedStyle;
    const getComputedStyleOverride = ((target: Element) => {
      const style = originalWindowGetComputedStyle(target);
      Object.defineProperty(style, 'direction', { value: 'ltr', configurable: true });
      return style;
    }) as typeof window.getComputedStyle;
    window.getComputedStyle = getComputedStyleOverride;
    globalThis.getComputedStyle = getComputedStyleOverride;
    const root = document.createElement('section');
    root.className = 'theme';
    const descendant = document.createElement('div');
    root.append(descendant);
    Object.defineProperty(root, 'querySelector', { value: () => null });
    document.body.append(root);
    const scopeRule = {
      type: 0,
      cssText: '@scope (.theme) {}',
      cssRules: [createStyleRule({ selectorText: ':scope', direction: 'ltr' })],
    } as unknown as CSSRule;
    try {
      expect(
        withDocumentStyleSheets([{ cssRules: [scopeRule] }], () =>
          matchesDirectionStyleRule(descendant, (parent) => parent.parentElement),
        ),
      ).toBe(false);
    } finally {
      window.getComputedStyle = originalWindowGetComputedStyle;
      globalThis.getComputedStyle = originalGlobalGetComputedStyle;
    }
  });

  test('fails closed for :scope selectors without an active scope context', () => {
    const originalWindowGetComputedStyle = window.getComputedStyle;
    const originalGlobalGetComputedStyle = globalThis.getComputedStyle;
    const getComputedStyleOverride = ((target: Element) => {
      const style = originalWindowGetComputedStyle(target);
      Object.defineProperty(style, 'direction', { value: 'ltr', configurable: true });
      return style;
    }) as typeof window.getComputedStyle;
    window.getComputedStyle = getComputedStyleOverride;
    globalThis.getComputedStyle = getComputedStyleOverride;
    const target = document.createElement('div');
    target.className = 'shell';
    document.body.append(target);
    const topLevelRule = createStyleRule({ selectorText: ':scope .shell', direction: 'ltr' });
    const scopedRootRule = {
      type: 0,
      cssText: '@scope (:scope > .theme) {}',
      cssRules: [createStyleRule({ selectorText: '.shell', direction: 'ltr' })],
    } as unknown as CSSRule;
    try {
      expect(
        withDocumentStyleSheets([{ cssRules: [topLevelRule] }], () =>
          resolveTextDirection(target, 'rtl'),
        ),
      ).toBe('rtl');
      expect(
        withDocumentStyleSheets([{ cssRules: [scopedRootRule] }], () =>
          resolveTextDirection(target, 'rtl'),
        ),
      ).toBe('rtl');
    } finally {
      window.getComputedStyle = originalWindowGetComputedStyle;
      globalThis.getComputedStyle = originalGlobalGetComputedStyle;
    }
  });

  test('binds relative selectors to the innermost scope and recognizes scope tokens safely', () => {
    const originalWindowGetComputedStyle = window.getComputedStyle;
    const originalGlobalGetComputedStyle = globalThis.getComputedStyle;
    const getComputedStyleOverride = ((target: Element) => {
      const style = originalWindowGetComputedStyle(target);
      Object.defineProperty(style, 'direction', { value: 'ltr', configurable: true });
      return style;
    }) as typeof window.getComputedStyle;
    window.getComputedStyle = getComputedStyleOverride;
    globalThis.getComputedStyle = getComputedStyleOverride;

    const outer = document.createElement('section');
    outer.className = 'outer';
    const inner = document.createElement('div');
    inner.className = 'inner';
    const target = document.createElement('div');
    target.className = 'shell';
    target.setAttribute('data-value', ':scope');
    inner.append(target);
    outer.append(inner);
    document.body.append(outer);
    const nestedScope = {
      type: 0,
      cssText: '@scope (.inner) {}',
      cssRules: [createStyleRule({ selectorText: ':SCOPE > .inner > .shell', direction: 'ltr' })],
    } as unknown as CSSRule;
    const outerScope = {
      type: 0,
      cssText: '@scope (.outer) {}',
      cssRules: [nestedScope],
    } as unknown as CSSRule;
    const attributeRule = {
      type: 0,
      cssText: '@scope (.outer) {}',
      cssRules: [createStyleRule({ selectorText: '[data-value=":scope"]', direction: 'ltr' })],
    } as unknown as CSSRule;
    try {
      expect(
        withDocumentStyleSheets([{ cssRules: [outerScope] }], () =>
          resolveTextDirection(target, 'rtl'),
        ),
      ).toBe('rtl');
      expect(
        withDocumentStyleSheets([{ cssRules: [attributeRule] }], () =>
          resolveTextDirection(target, 'rtl'),
        ),
      ).toBe('ltr');
    } finally {
      window.getComputedStyle = originalWindowGetComputedStyle;
      globalThis.getComputedStyle = originalGlobalGetComputedStyle;
    }
  });

  test('preserves quoted :scope text when replacing the pseudo-class', () => {
    const originalWindowGetComputedStyle = window.getComputedStyle;
    const originalGlobalGetComputedStyle = globalThis.getComputedStyle;
    const getComputedStyleOverride = ((target: Element) => {
      const style = originalWindowGetComputedStyle(target);
      Object.defineProperty(style, 'direction', { value: 'ltr', configurable: true });
      return style;
    }) as typeof window.getComputedStyle;
    window.getComputedStyle = getComputedStyleOverride;
    globalThis.getComputedStyle = getComputedStyleOverride;
    const root = document.createElement('section');
    root.className = 'theme';
    const target = document.createElement('div');
    target.setAttribute('data-value', ':scope');
    root.append(target);
    document.body.append(root);
    const scopeRule = {
      type: 0,
      cssText: '@scope (.theme) {}',
      cssRules: [
        createStyleRule({ selectorText: ':scope [data-value=":scope"]', direction: 'ltr' }),
      ],
    } as unknown as CSSRule;
    try {
      expect(
        withDocumentStyleSheets([{ cssRules: [scopeRule] }], () =>
          resolveTextDirection(target, 'rtl'),
        ),
      ).toBe('ltr');
    } finally {
      window.getComputedStyle = originalWindowGetComputedStyle;
      globalThis.getComputedStyle = originalGlobalGetComputedStyle;
    }
  });

  test('uses the inline style parent as the implicit scope root', () => {
    const originalWindowGetComputedStyle = window.getComputedStyle;
    const originalGlobalGetComputedStyle = globalThis.getComputedStyle;
    const getComputedStyleOverride = ((target: Element) => {
      const style = originalWindowGetComputedStyle(target);
      Object.defineProperty(style, 'direction', { value: 'ltr', configurable: true });
      return style;
    }) as typeof window.getComputedStyle;
    window.getComputedStyle = getComputedStyleOverride;
    globalThis.getComputedStyle = getComputedStyleOverride;
    const section = document.createElement('section');
    const styleElement = document.createElement('style');
    const inside = document.createElement('div');
    inside.className = 'shell';
    const outside = document.createElement('div');
    outside.className = 'shell';
    section.append(styleElement, inside);
    document.body.append(section, outside);
    const scopeRule = {
      type: 0,
      cssText: '@scope {}',
      cssRules: [createStyleRule({ selectorText: '.shell', direction: 'ltr' })],
    } as unknown as CSSRule;
    const sheet = { cssRules: [scopeRule], ownerNode: styleElement };
    try {
      expect(withDocumentStyleSheets([sheet], () => resolveTextDirection(inside, 'rtl'))).toBe(
        'ltr',
      );
      expect(withDocumentStyleSheets([sheet], () => resolveTextDirection(outside, 'rtl'))).toBe(
        'rtl',
      );
    } finally {
      window.getComputedStyle = originalWindowGetComputedStyle;
      globalThis.getComputedStyle = originalGlobalGetComputedStyle;
    }
  });

  test('recognizes SVG style elements as implicit scope owners', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const styleElement = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    const target = document.createElement('div');
    target.className = 'shell';
    svg.append(styleElement, target);
    document.body.append(svg);
    const scopeRule = {
      type: 0,
      cssText: '@scope {}',
      cssRules: [createStyleRule({ selectorText: '.shell', direction: 'ltr' })],
    } as unknown as CSSRule;
    expect(
      withDocumentStyleSheets([{ cssRules: [scopeRule], ownerNode: styleElement }], () =>
        resolveTextDirection(target, 'rtl'),
      ),
    ).toBe('ltr');
  });

  test('uses the enclosing shadow root as the implicit scope root', () => {
    const originalWindowGetComputedStyle = window.getComputedStyle;
    const originalGlobalGetComputedStyle = globalThis.getComputedStyle;
    const getComputedStyleOverride = ((target: Element) => {
      const style = originalWindowGetComputedStyle(target);
      Object.defineProperty(style, 'direction', { value: 'ltr', configurable: true });
      return style;
    }) as typeof window.getComputedStyle;
    window.getComputedStyle = getComputedStyleOverride;
    globalThis.getComputedStyle = getComputedStyleOverride;
    const host = document.createElement('div');
    const shadowRoot = host.attachShadow({ mode: 'open' });
    const styleElement = document.createElement('style');
    const target = document.createElement('div');
    target.className = 'shell';
    shadowRoot.append(styleElement, target);
    document.body.append(host);
    const scopeRule = {
      type: 0,
      cssText: '@scope {}',
      cssRules: [createStyleRule({ selectorText: '.shell', direction: 'ltr' })],
    } as unknown as CSSRule;
    const sheet = { cssRules: [scopeRule], ownerNode: styleElement };
    try {
      expect(withDocumentStyleSheets([sheet], () => resolveTextDirection(target, 'rtl'))).toBe(
        'ltr',
      );
    } finally {
      window.getComputedStyle = originalWindowGetComputedStyle;
      globalThis.getComputedStyle = originalGlobalGetComputedStyle;
    }
  });

  test('fails closed when an implicit scope is excluded by an enclosing scope', () => {
    const originalWindowGetComputedStyle = window.getComputedStyle;
    const originalGlobalGetComputedStyle = globalThis.getComputedStyle;
    const getComputedStyleOverride = ((target: Element) => {
      const style = originalWindowGetComputedStyle(target);
      Object.defineProperty(style, 'direction', { value: 'ltr', configurable: true });
      return style;
    }) as typeof window.getComputedStyle;
    window.getComputedStyle = getComputedStyleOverride;
    globalThis.getComputedStyle = getComputedStyleOverride;
    const section = document.createElement('section');
    const target = document.createElement('div');
    target.className = 'shell';
    section.append(target);
    document.body.append(section);
    const innerScope = {
      type: 0,
      cssText: '@scope {}',
      cssRules: [createStyleRule({ selectorText: '.shell', direction: 'ltr' })],
    } as unknown as CSSRule;
    const outerScope = {
      type: 0,
      cssText: '@scope (.missing) {}',
      cssRules: [innerScope],
    } as unknown as CSSRule;
    try {
      expect(
        withDocumentStyleSheets([{ cssRules: [outerScope] }], () =>
          resolveTextDirection(target, 'rtl'),
        ),
      ).toBe('rtl');
    } finally {
      window.getComputedStyle = originalWindowGetComputedStyle;
      globalThis.getComputedStyle = originalGlobalGetComputedStyle;
    }
  });

  test('uses the target shadow root for ownerless adopted stylesheets', () => {
    const originalWindowGetComputedStyle = window.getComputedStyle;
    const originalGlobalGetComputedStyle = globalThis.getComputedStyle;
    const getComputedStyleOverride = ((target: Element) => {
      const style = originalWindowGetComputedStyle(target);
      Object.defineProperty(style, 'direction', { value: 'ltr', configurable: true });
      return style;
    }) as typeof window.getComputedStyle;
    window.getComputedStyle = getComputedStyleOverride;
    globalThis.getComputedStyle = getComputedStyleOverride;
    const host = document.createElement('div');
    const shadowRoot = host.attachShadow({ mode: 'open' });
    const target = document.createElement('div');
    target.className = 'shell';
    shadowRoot.append(target);
    document.body.append(host);
    const scopeRule = {
      type: 0,
      cssText: '@scope {}',
      cssRules: [createStyleRule({ selectorText: '.shell', direction: 'ltr' })],
    } as unknown as CSSRule;
    try {
      expect(
        withDocumentStyleSheets([{ cssRules: [scopeRule] }], () =>
          resolveTextDirection(target, 'rtl'),
        ),
      ).toBe('rtl');
    } finally {
      window.getComputedStyle = originalWindowGetComputedStyle;
      globalThis.getComputedStyle = originalGlobalGetComputedStyle;
    }
  });

  test('fails closed for relative selectors when the implicit scope is a shadow root', () => {
    const originalWindowGetComputedStyle = window.getComputedStyle;
    const originalGlobalGetComputedStyle = globalThis.getComputedStyle;
    const getComputedStyleOverride = ((target: Element) => {
      const style = originalWindowGetComputedStyle(target);
      Object.defineProperty(style, 'direction', { value: 'ltr', configurable: true });
      return style;
    }) as typeof window.getComputedStyle;
    window.getComputedStyle = getComputedStyleOverride;
    globalThis.getComputedStyle = getComputedStyleOverride;
    const host = document.createElement('div');
    const shadowRoot = host.attachShadow({ mode: 'open' });
    const styleElement = document.createElement('style');
    const target = document.createElement('div');
    target.className = 'shell';
    shadowRoot.append(styleElement, target);
    document.body.append(host);
    const scopeRule = {
      type: 0,
      cssText: '@scope {}',
      cssRules: [createStyleRule({ selectorText: ':scope > .shell', direction: 'ltr' })],
    } as unknown as CSSRule;
    try {
      expect(
        withDocumentStyleSheets([{ cssRules: [scopeRule], ownerNode: styleElement }], () =>
          resolveTextDirection(target, 'rtl'),
        ),
      ).toBe('ltr');
    } finally {
      window.getComputedStyle = originalWindowGetComputedStyle;
      globalThis.getComputedStyle = originalGlobalGetComputedStyle;
    }
  });

  test('does not let a shadow clone wrapper satisfy root qualifiers', () => {
    const host = document.createElement('div');
    const shadowRoot = host.attachShadow({ mode: 'open' });
    const target = document.createElement('div');
    target.className = 'shell';
    shadowRoot.append(target);
    document.body.append(host);
    const scopeRule = {
      type: 0,
      cssText: '@scope {}',
      cssRules: [createStyleRule({ selectorText: ':scope:is(div) > .shell', direction: 'ltr' })],
    } as unknown as CSSRule;
    expect(
      withDocumentStyleSheets([{ cssRules: [scopeRule] }], () =>
        resolveTextDirection(target, 'rtl'),
      ),
    ).toBe('rtl');
  });

  test('evaluates :scope limits relative to the active scope root', () => {
    const originalWindowGetComputedStyle = window.getComputedStyle;
    const originalGlobalGetComputedStyle = globalThis.getComputedStyle;
    const getComputedStyleOverride = ((target: Element) => {
      const style = originalWindowGetComputedStyle(target);
      Object.defineProperty(style, 'direction', { value: 'ltr', configurable: true });
      return style;
    }) as typeof window.getComputedStyle;
    window.getComputedStyle = getComputedStyleOverride;
    globalThis.getComputedStyle = getComputedStyleOverride;
    const root = document.createElement('section');
    root.className = 'theme';
    const stop = document.createElement('div');
    stop.className = 'stop';
    const target = document.createElement('div');
    target.className = 'shell';
    stop.append(target);
    root.append(stop);
    document.body.append(root);
    const scopeRule = {
      type: 0,
      cssText: '@scope (.theme) to (:scope > .stop) {}',
      cssRules: [createStyleRule({ selectorText: '.shell', direction: 'ltr' })],
    } as unknown as CSSRule;
    try {
      expect(
        withDocumentStyleSheets([{ cssRules: [scopeRule] }], () =>
          resolveTextDirection(target, 'rtl'),
        ),
      ).toBe('rtl');
    } finally {
      window.getComputedStyle = originalWindowGetComputedStyle;
      globalThis.getComputedStyle = originalGlobalGetComputedStyle;
    }
  });

  test('resolves outside-ancestor context in a :scope limit selector', () => {
    // Limit selectors are evaluated through the same `matchesScopedSelector`
    // as rule selectors, so the outside-ancestor-context fix applies here
    // too: `to (main :scope > .stop)` requires the scope root to actually
    // have a `main` ancestor before the `.stop` boundary can be recognized.
    // Losing that outside context (as the clone-only fallback previously
    // did) would make the limit unrecognizable and leave the scope
    // active past its real boundary — the unsafe direction for a limit,
    // since a limit that never triggers over-applies the scope's rules
    // rather than under-applying them.
    const main = document.createElement('main');
    const root = document.createElement('section');
    root.className = 'theme';
    const stop = document.createElement('div');
    stop.className = 'stop';
    const target = document.createElement('div');
    target.className = 'shell';
    stop.append(target);
    root.append(stop);
    main.append(root);
    document.body.append(main);
    const scopeRule = {
      type: 0,
      cssText: '@scope (.theme) to (main :scope > .stop) {}',
      cssRules: [createStyleRule({ selectorText: '.shell', direction: 'ltr' })],
    } as unknown as CSSRule;
    expect(
      withDocumentStyleSheets([{ cssRules: [scopeRule] }], () =>
        resolveTextDirection(target, 'rtl'),
      ),
    ).toBe('rtl');
  });

  test('requires nested scopes to intersect every enclosing scope', () => {
    const originalWindowGetComputedStyle = window.getComputedStyle;
    const originalGlobalGetComputedStyle = globalThis.getComputedStyle;
    const getComputedStyleOverride = ((target: Element) => {
      const style = originalWindowGetComputedStyle(target);
      Object.defineProperty(style, 'direction', { value: 'ltr', configurable: true });
      return style;
    }) as typeof window.getComputedStyle;
    window.getComputedStyle = getComputedStyleOverride;
    globalThis.getComputedStyle = getComputedStyleOverride;
    const outer = document.createElement('section');
    outer.className = 'outer';
    const inside = document.createElement('div');
    inside.className = 'inner';
    const insideTarget = document.createElement('div');
    insideTarget.className = 'shell';
    inside.append(insideTarget);
    outer.append(inside);
    const outside = document.createElement('section');
    const outsideInner = document.createElement('div');
    outsideInner.className = 'inner';
    const outsideTarget = document.createElement('div');
    outsideTarget.className = 'shell';
    outsideInner.append(outsideTarget);
    outside.append(outsideInner);
    document.body.append(outer, outside);
    const nestedScope = {
      type: 0,
      cssText: '@scope (.inner) {}',
      cssRules: [createStyleRule({ selectorText: '.shell', direction: 'ltr' })],
    } as unknown as CSSRule;
    const outerScope = {
      type: 0,
      cssText: '@scope (.outer) {}',
      cssRules: [nestedScope],
    } as unknown as CSSRule;
    try {
      expect(
        withDocumentStyleSheets([{ cssRules: [outerScope] }], () =>
          resolveTextDirection(insideTarget, 'rtl'),
        ),
      ).toBe('ltr');
      expect(
        withDocumentStyleSheets([{ cssRules: [outerScope] }], () =>
          resolveTextDirection(outsideTarget, 'rtl'),
        ),
      ).toBe('rtl');
    } finally {
      window.getComputedStyle = originalWindowGetComputedStyle;
      globalThis.getComputedStyle = originalGlobalGetComputedStyle;
    }
  });

  test('keeps nested scope limits local to their enclosing root', () => {
    const originalWindowGetComputedStyle = window.getComputedStyle;
    const originalGlobalGetComputedStyle = globalThis.getComputedStyle;
    const getComputedStyleOverride = ((target: Element) => {
      const style = originalWindowGetComputedStyle(target);
      Object.defineProperty(style, 'direction', { value: 'ltr', configurable: true });
      return style;
    }) as typeof window.getComputedStyle;
    window.getComputedStyle = getComputedStyleOverride;
    globalThis.getComputedStyle = getComputedStyleOverride;
    const outer = document.createElement('section');
    outer.className = 'outer';
    const root = document.createElement('div');
    root.className = 'inner';
    const limit = document.createElement('div');
    limit.className = 'stop';
    const target = document.createElement('div');
    target.className = 'shell';
    limit.append(target);
    root.append(limit);
    outer.append(root);
    document.body.append(outer);
    const innerScope = {
      type: 0,
      cssText: '@scope (.inner) to (.stop) {}',
      cssRules: [createStyleRule({ selectorText: '.shell', direction: 'ltr' })],
    } as unknown as CSSRule;
    const outerScope = {
      type: 0,
      cssText: '@scope (.outer) {}',
      cssRules: [innerScope],
    } as unknown as CSSRule;
    try {
      expect(
        withDocumentStyleSheets([{ cssRules: [outerScope] }], () =>
          resolveTextDirection(target, 'rtl'),
        ),
      ).toBe('rtl');
    } finally {
      window.getComputedStyle = originalWindowGetComputedStyle;
      globalThis.getComputedStyle = originalGlobalGetComputedStyle;
    }
  });

  test('does not apply a scope limit that is outside the matched scope root', () => {
    const originalWindowGetComputedStyle = window.getComputedStyle;
    const originalGlobalGetComputedStyle = globalThis.getComputedStyle;
    const getComputedStyleOverride = ((target: Element) => {
      const style = originalWindowGetComputedStyle(target);
      Object.defineProperty(style, 'direction', { value: 'ltr', configurable: true });
      return style;
    }) as typeof window.getComputedStyle;
    window.getComputedStyle = getComputedStyleOverride;
    globalThis.getComputedStyle = getComputedStyleOverride;
    const styleRule = createStyleRule({ selectorText: '.shell', direction: 'ltr' });
    const outer = document.createElement('section');
    outer.className = 'stop';
    const root = document.createElement('div');
    root.className = 'theme';
    const element = document.createElement('div');
    element.className = 'shell';
    root.append(element);
    outer.append(root);
    document.body.append(outer);
    const scopeRule = {
      type: 0,
      cssText: '@scope (.theme) to (.stop) {}',
      cssRules: [styleRule],
    } as unknown as CSSRule;
    try {
      expect(
        withDocumentStyleSheets([{ cssRules: [scopeRule] }], () =>
          resolveTextDirection(element, 'rtl'),
        ),
      ).toBe('ltr');
    } finally {
      window.getComputedStyle = originalWindowGetComputedStyle;
      globalThis.getComputedStyle = originalGlobalGetComputedStyle;
    }
  });

  test('keeps a scope active when a later root candidate is not limited', () => {
    const originalWindowGetComputedStyle = window.getComputedStyle;
    const originalGlobalGetComputedStyle = globalThis.getComputedStyle;
    const getComputedStyleOverride = ((target: Element) => {
      const style = originalWindowGetComputedStyle(target);
      Object.defineProperty(style, 'direction', { value: 'ltr', configurable: true });
      return style;
    }) as typeof window.getComputedStyle;
    window.getComputedStyle = getComputedStyleOverride;
    globalThis.getComputedStyle = getComputedStyleOverride;
    const outer = document.createElement('section');
    outer.className = 'outer';
    const limit = document.createElement('div');
    limit.className = 'limit';
    const inner = document.createElement('div');
    inner.className = 'inner';
    const element = document.createElement('div');
    element.className = 'shell';
    inner.append(element);
    limit.append(inner);
    outer.append(limit);
    document.body.append(outer);
    const styleRule = createStyleRule({ selectorText: '.shell', direction: 'ltr' });
    const scopeRules = ['.inner, .outer', '.outer, .inner'].map((roots) => ({
      type: 0,
      cssText: `@scope (${roots}) to (.limit) {}`,
      cssRules: [styleRule],
    })) as unknown as CSSRule[];
    try {
      for (const scopeRule of scopeRules) {
        expect(
          withDocumentStyleSheets([{ cssRules: [scopeRule] }], () =>
            resolveTextDirection(element, 'rtl'),
          ),
        ).toBe('ltr');
      }
    } finally {
      window.getComputedStyle = originalWindowGetComputedStyle;
      globalThis.getComputedStyle = originalGlobalGetComputedStyle;
    }
  });

  test('evaluates scope limits independently of selector-list order', () => {
    const originalWindowGetComputedStyle = window.getComputedStyle;
    const originalGlobalGetComputedStyle = globalThis.getComputedStyle;
    const getComputedStyleOverride = ((target: Element) => {
      const style = originalWindowGetComputedStyle(target);
      Object.defineProperty(style, 'direction', { value: 'ltr', configurable: true });
      return style;
    }) as typeof window.getComputedStyle;
    window.getComputedStyle = getComputedStyleOverride;
    globalThis.getComputedStyle = getComputedStyleOverride;
    const above = document.createElement('div');
    above.className = 'above';
    const root = document.createElement('div');
    root.className = 'root';
    const element = document.createElement('div');
    element.className = 'shell';
    root.append(element);
    above.append(root);
    document.body.append(above);
    const styleRule = createStyleRule({ selectorText: '.shell', direction: 'ltr' });
    const scopeRules = ['.above, .root', '.root, .above'].flatMap((roots) =>
      ['.above, .missing', '.missing, .above'].map((limits) => ({
        type: 0,
        cssText: `@scope (${roots}) to (${limits}) {}`,
        cssRules: [styleRule],
      })),
    ) as unknown as CSSRule[];
    try {
      for (const scopeRule of scopeRules) {
        expect(
          withDocumentStyleSheets([{ cssRules: [scopeRule] }], () =>
            resolveTextDirection(element, 'rtl'),
          ),
        ).toBe('ltr');
      }
    } finally {
      window.getComputedStyle = originalWindowGetComputedStyle;
      globalThis.getComputedStyle = originalGlobalGetComputedStyle;
    }
  });

  test('keeps commas inside scope selector syntax intact', () => {
    const originalWindowGetComputedStyle = window.getComputedStyle;
    const originalGlobalGetComputedStyle = globalThis.getComputedStyle;
    const getComputedStyleOverride = ((target: Element) => {
      const style = originalWindowGetComputedStyle(target);
      Object.defineProperty(style, 'direction', { value: 'ltr', configurable: true });
      return style;
    }) as typeof window.getComputedStyle;
    window.getComputedStyle = getComputedStyleOverride;
    globalThis.getComputedStyle = getComputedStyleOverride;
    const styleRule = createStyleRule({ selectorText: '.shell', direction: 'ltr' });
    const root = document.createElement('div');
    root.setAttribute('data-scope', 'a,b');
    const element = document.createElement('div');
    element.className = 'shell';
    root.append(element);
    document.body.append(root);
    const scopeRule = {
      type: 0,
      cssText: '@scope ([data-scope="a\\,b"]) {}',
      cssRules: [styleRule],
    } as unknown as CSSRule;
    try {
      expect(
        withDocumentStyleSheets([{ cssRules: [scopeRule] }], () =>
          resolveTextDirection(element, 'rtl'),
        ),
      ).toBe('ltr');
    } finally {
      window.getComputedStyle = originalWindowGetComputedStyle;
      globalThis.getComputedStyle = originalGlobalGetComputedStyle;
    }
  });

  test('parses nested functional roots and limits in scope preludes', () => {
    const originalWindowGetComputedStyle = window.getComputedStyle;
    const originalGlobalGetComputedStyle = globalThis.getComputedStyle;
    const getComputedStyleOverride = ((target: Element) => {
      const style = originalWindowGetComputedStyle(target);
      Object.defineProperty(style, 'direction', { value: 'ltr', configurable: true });
      return style;
    }) as typeof window.getComputedStyle;
    window.getComputedStyle = getComputedStyleOverride;
    globalThis.getComputedStyle = getComputedStyleOverride;
    const root = document.createElement('div');
    root.className = 'theme';
    const element = document.createElement('div');
    element.className = 'shell stop';
    root.append(element);
    document.body.append(root);
    const styleRule = createStyleRule({ selectorText: '.shell', direction: 'ltr' });
    const scopeRule = {
      type: 0,
      cssText: '@scope (:is(.theme, .alt)) to (:is(.stop, .halt)) {}',
      cssRules: [styleRule],
    } as unknown as CSSRule;
    try {
      expect(
        withDocumentStyleSheets([{ cssRules: [scopeRule] }], () =>
          resolveTextDirection(element, 'rtl'),
        ),
      ).toBe('rtl');
    } finally {
      window.getComputedStyle = originalWindowGetComputedStyle;
      globalThis.getComputedStyle = originalGlobalGetComputedStyle;
    }
  });

  test('treats a bare & as an alias for the scope root', () => {
    const originalWindowGetComputedStyle = window.getComputedStyle;
    const originalGlobalGetComputedStyle = globalThis.getComputedStyle;
    const getComputedStyleOverride = ((target: Element) => {
      const style = originalWindowGetComputedStyle(target);
      Object.defineProperty(style, 'direction', { value: 'ltr', configurable: true });
      return style;
    }) as typeof window.getComputedStyle;
    window.getComputedStyle = getComputedStyleOverride;
    globalThis.getComputedStyle = getComputedStyleOverride;
    const root = document.createElement('section');
    root.className = 'theme';
    document.body.append(root);
    const scopeRule = {
      type: 0,
      cssText: '@scope (.theme) {}',
      cssRules: [createStyleRule({ selectorText: '&', direction: 'ltr' })],
    } as unknown as CSSRule;
    try {
      expect(
        withDocumentStyleSheets([{ cssRules: [scopeRule] }], () =>
          resolveTextDirection(root, 'rtl'),
        ),
      ).toBe('ltr');
    } finally {
      window.getComputedStyle = originalWindowGetComputedStyle;
      globalThis.getComputedStyle = originalGlobalGetComputedStyle;
    }
  });

  test('treats a leading combinator as relative to the scope root', () => {
    const originalWindowGetComputedStyle = window.getComputedStyle;
    const originalGlobalGetComputedStyle = globalThis.getComputedStyle;
    const getComputedStyleOverride = ((target: Element) => {
      const style = originalWindowGetComputedStyle(target);
      Object.defineProperty(style, 'direction', { value: 'ltr', configurable: true });
      return style;
    }) as typeof window.getComputedStyle;
    window.getComputedStyle = getComputedStyleOverride;
    globalThis.getComputedStyle = getComputedStyleOverride;
    const root = document.createElement('section');
    root.className = 'theme';
    const child = document.createElement('div');
    child.className = 'shell';
    // `element.matches('> .shell')` is not merely unmatched in a
    // spec-compliant engine — it's an invalid selector, and some engines
    // (including this suite's DOM shim) parse it leniently by dropping the
    // leading combinator, matching `.shell` at any depth instead of
    // rejecting it. A grandchild pins the correctly-scoped behavior against
    // that false positive: `> .shell` must bind to the scope root as
    // "direct child", so it may match `child` but must not match
    // `grandchild`.
    const middle = document.createElement('div');
    const grandchild = document.createElement('div');
    grandchild.className = 'shell';
    middle.append(grandchild);
    root.append(child, middle);
    document.body.append(root);
    const scopeRule = {
      type: 0,
      cssText: '@scope (.theme) {}',
      cssRules: [createStyleRule({ selectorText: '> .shell', direction: 'ltr' })],
    } as unknown as CSSRule;
    try {
      expect(
        withDocumentStyleSheets([{ cssRules: [scopeRule] }], () =>
          resolveTextDirection(child, 'rtl'),
        ),
      ).toBe('ltr');
      expect(
        withDocumentStyleSheets([{ cssRules: [scopeRule] }], () =>
          resolveTextDirection(grandchild, 'rtl'),
        ),
      ).toBe('rtl');
    } finally {
      window.getComputedStyle = originalWindowGetComputedStyle;
      globalThis.getComputedStyle = originalGlobalGetComputedStyle;
    }
  });

  test('normalizes each item of a rule selector list independently for leading combinators', () => {
    // `.unused, > .shell` — only the SECOND alternative needs its leading
    // combinator rewritten to `:scope > .shell`; normalization must operate
    // per comma-separated item, not gate on whether the whole list starts
    // with a combinator (the list as a whole starts with `.unused`, so a
    // whole-string check would leave the second alternative untouched).
    const root = document.createElement('section');
    root.className = 'theme';
    const child = document.createElement('div');
    child.className = 'shell';
    root.append(child);
    document.body.append(root);
    const scopeRule = {
      type: 0,
      cssText: '@scope (.theme) {}',
      cssRules: [createStyleRule({ selectorText: '.unused, > .shell', direction: 'ltr' })],
    } as unknown as CSSRule;
    expect(
      withDocumentStyleSheets([{ cssRules: [scopeRule] }], () =>
        resolveTextDirection(child, 'rtl'),
      ),
    ).toBe('ltr');
  });

  test('does not create a limit element for a limit that references :scope', () => {
    const originalWindowGetComputedStyle = window.getComputedStyle;
    const originalGlobalGetComputedStyle = globalThis.getComputedStyle;
    const getComputedStyleOverride = ((target: Element) => {
      const style = originalWindowGetComputedStyle(target);
      Object.defineProperty(style, 'direction', { value: 'ltr', configurable: true });
      return style;
    }) as typeof window.getComputedStyle;
    window.getComputedStyle = getComputedStyleOverride;
    globalThis.getComputedStyle = getComputedStyleOverride;
    const root = document.createElement('section');
    root.className = 'theme';
    const element = document.createElement('div');
    element.className = 'shell';
    root.append(element);
    document.body.append(root);
    const scopeRule = {
      type: 0,
      cssText: '@scope (.theme) to (:scope) {}',
      cssRules: [createStyleRule({ selectorText: '.shell', direction: 'ltr' })],
    } as unknown as CSSRule;
    try {
      expect(
        withDocumentStyleSheets([{ cssRules: [scopeRule] }], () =>
          resolveTextDirection(element, 'rtl'),
        ),
      ).toBe('ltr');
    } finally {
      window.getComputedStyle = originalWindowGetComputedStyle;
      globalThis.getComputedStyle = originalGlobalGetComputedStyle;
    }
  });

  test('binds an unrooted nested scope to the enclosing scope root, not the document', () => {
    const originalWindowGetComputedStyle = window.getComputedStyle;
    const originalGlobalGetComputedStyle = globalThis.getComputedStyle;
    const getComputedStyleOverride = ((target: Element) => {
      const style = originalWindowGetComputedStyle(target);
      Object.defineProperty(style, 'direction', { value: 'ltr', configurable: true });
      return style;
    }) as typeof window.getComputedStyle;
    window.getComputedStyle = getComputedStyleOverride;
    globalThis.getComputedStyle = getComputedStyleOverride;
    const outer = document.createElement('section');
    outer.className = 'outer';
    const target = document.createElement('div');
    target.className = 'shell';
    outer.append(target);
    document.body.append(outer);
    const innerScope = {
      type: 0,
      cssText: '@scope {}',
      cssRules: [createStyleRule({ selectorText: '.shell', direction: 'ltr' })],
    } as unknown as CSSRule;
    const outerScope = {
      type: 0,
      cssText: '@scope (.outer) {}',
      cssRules: [innerScope],
    } as unknown as CSSRule;
    try {
      expect(
        withDocumentStyleSheets([{ cssRules: [outerScope] }], () =>
          resolveTextDirection(target, 'rtl'),
        ),
      ).toBe('ltr');
    } finally {
      window.getComputedStyle = originalWindowGetComputedStyle;
      globalThis.getComputedStyle = originalGlobalGetComputedStyle;
    }
  });

  test('binds a nested exact :scope root to the enclosing scope, not the stylesheet root', () => {
    const originalWindowGetComputedStyle = window.getComputedStyle;
    const originalGlobalGetComputedStyle = globalThis.getComputedStyle;
    const getComputedStyleOverride = ((target: Element) => {
      const style = originalWindowGetComputedStyle(target);
      Object.defineProperty(style, 'direction', { value: 'ltr', configurable: true });
      return style;
    }) as typeof window.getComputedStyle;
    window.getComputedStyle = getComputedStyleOverride;
    globalThis.getComputedStyle = getComputedStyleOverride;
    const parent = document.createElement('section');
    parent.className = 'parent';
    const target = document.createElement('div');
    target.className = 'shell';
    parent.append(target);
    document.body.append(parent);
    const innerScope = {
      type: 0,
      cssText: '@scope (:scope) {}',
      cssRules: [createStyleRule({ selectorText: '.shell', direction: 'ltr' })],
    } as unknown as CSSRule;
    const outerScope = {
      type: 0,
      cssText: '@scope (.parent) {}',
      cssRules: [innerScope],
    } as unknown as CSSRule;
    try {
      expect(
        withDocumentStyleSheets([{ cssRules: [outerScope] }], () =>
          resolveTextDirection(target, 'rtl'),
        ),
      ).toBe('ltr');
    } finally {
      window.getComputedStyle = originalWindowGetComputedStyle;
      globalThis.getComputedStyle = originalGlobalGetComputedStyle;
    }
  });

  test('binds a nested exact :scope root to an enclosing ShadowRoot scope root', () => {
    // Same shape as the previous test, but the ENCLOSING scope's root is
    // itself a `ShadowRoot` (the implicit root of a shadow-owned
    // stylesheet — see 'uses the enclosing shadow root as the implicit
    // scope root' above), not an `Element`. `findRelativeScopeRootMatches`
    // used to walk only `parentElement` ancestors, so a `ShadowRoot`
    // candidate was silently unreachable and the inner `@scope (:scope)`
    // never activated.
    const originalWindowGetComputedStyle = window.getComputedStyle;
    const originalGlobalGetComputedStyle = globalThis.getComputedStyle;
    const getComputedStyleOverride = ((target: Element) => {
      const style = originalWindowGetComputedStyle(target);
      Object.defineProperty(style, 'direction', { value: 'ltr', configurable: true });
      return style;
    }) as typeof window.getComputedStyle;
    window.getComputedStyle = getComputedStyleOverride;
    globalThis.getComputedStyle = getComputedStyleOverride;
    const host = document.createElement('div');
    const shadowRoot = host.attachShadow({ mode: 'open' });
    const styleElement = document.createElement('style');
    const target = document.createElement('div');
    target.className = 'shell';
    shadowRoot.append(styleElement, target);
    document.body.append(host);
    const innerScope = {
      type: 0,
      cssText: '@scope (:scope) {}',
      cssRules: [createStyleRule({ selectorText: '.shell', direction: 'ltr' })],
    } as unknown as CSSRule;
    const outerScope = {
      type: 0,
      cssText: '@scope {}',
      cssRules: [innerScope],
    } as unknown as CSSRule;
    try {
      expect(
        withDocumentStyleSheets([{ cssRules: [outerScope], ownerNode: styleElement }], () =>
          resolveTextDirection(target, 'rtl'),
        ),
      ).toBe('ltr');
    } finally {
      window.getComputedStyle = originalWindowGetComputedStyle;
      globalThis.getComputedStyle = originalGlobalGetComputedStyle;
    }
  });

  test('binds a nested exact :scope root to an enclosing ShadowRoot root for an adopted stylesheet', () => {
    // Same bug as the previous test, but for an ownerless ADOPTED
    // stylesheet — `getImplicitScopeRoot` reaches the `ShadowRoot` via the
    // sheet's shadow-root association (`fallbackRoot`) instead of walking
    // up from an `ownerNode`, which is likewise a `ShadowRoot` the
    // enclosing scope's root must resolve to.
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
      const target = document.createElement('div');
      target.className = 'shell';
      shadowRoot.append(target);
      document.body.append(host);
      const innerScope = {
        type: 0,
        cssText: '@scope (:scope) {}',
        cssRules: [createStyleRule({ selectorText: '.shell', direction: 'ltr' })],
      } as unknown as CSSRule;
      const outerScope = {
        type: 0,
        cssText: '@scope {}',
        cssRules: [innerScope],
      };
      Object.defineProperty(shadowRoot, 'adoptedStyleSheets', {
        configurable: true,
        value: [{ cssRules: [outerScope] }],
      });
      expect(resolveTextDirection(target, 'rtl')).toBe('ltr');
    } finally {
      window.getComputedStyle = originalWindowGetComputedStyle;
      globalThis.getComputedStyle = originalGlobalGetComputedStyle;
    }
  });

  test('binds a nested relative :scope root selector to the enclosing scope root', () => {
    // `@scope (.parent) { @scope (:scope > .child) { .shell { … } } }` — a
    // relative (non-exact) `:scope` scope-start selector attached to a
    // combinator must resolve by testing candidate ancestors of the target
    // against the enclosing scope's root(s), not fail closed just because
    // it isn't the bare `:scope` token.
    const parent = document.createElement('section');
    parent.className = 'parent';
    const child = document.createElement('div');
    child.className = 'child';
    const target = document.createElement('div');
    target.className = 'shell';
    child.append(target);
    parent.append(child);
    document.body.append(parent);
    const innerScope = {
      type: 0,
      cssText: '@scope (:scope > .child) {}',
      cssRules: [createStyleRule({ selectorText: '.shell', direction: 'ltr' })],
    } as unknown as CSSRule;
    const outerScope = {
      type: 0,
      cssText: '@scope (.parent) {}',
      cssRules: [innerScope],
    } as unknown as CSSRule;
    expect(
      withDocumentStyleSheets([{ cssRules: [outerScope] }], () =>
        resolveTextDirection(target, 'rtl'),
      ),
    ).toBe('ltr');
  });

  test('does not promote a coincidentally-shaped descendant as a relative :scope root match', () => {
    // Regression guard for the resolution mechanism itself: the enclosing
    // scope's root (`.parent`) has no direct child matching `.child` — its
    // real direct child is a plain wrapper `<div>`. A DIFFERENT, deeper
    // descendant happens to be shaped identically (same tag, same
    // first-child position relative to its own real parent) and DOES have a
    // direct child named `.child`. Root resolution must use the real
    // ancestor/DOM relationship, not a structural coincidence, or this
    // would incorrectly promote the deeper element's child as a scope root.
    const parent = document.createElement('section');
    parent.className = 'parent';
    const wrapperDiv = document.createElement('div');
    const decoy = document.createElement('section');
    const child = document.createElement('div');
    child.className = 'child';
    const target = document.createElement('div');
    target.className = 'shell';
    child.append(target);
    decoy.append(child);
    wrapperDiv.append(decoy);
    parent.append(wrapperDiv);
    document.body.append(parent);
    const innerScope = {
      type: 0,
      cssText: '@scope (:scope > .child) {}',
      cssRules: [createStyleRule({ selectorText: '.shell', direction: 'ltr' })],
    } as unknown as CSSRule;
    const outerScope = {
      type: 0,
      cssText: '@scope (.parent) {}',
      cssRules: [innerScope],
    } as unknown as CSSRule;
    expect(
      withDocumentStyleSheets([{ cssRules: [outerScope] }], () =>
        resolveTextDirection(target, 'rtl'),
      ),
    ).toBe('rtl');
  });

  test('resolves outside-ancestor context for a scoped rule selector', () => {
    // `@scope (.theme) { main :scope .shell { … } }` — `main` describes
    // context OUTSIDE the scope root, which the clone-based matcher (which
    // only ever clones the root's own subtree) can never see on its own.
    // The outside portion must be verified against the scope root's real,
    // unmutated, uncloned ancestor chain instead.
    const main = document.createElement('main');
    const theme = document.createElement('section');
    theme.className = 'theme';
    const target = document.createElement('div');
    target.className = 'shell';
    theme.append(target);
    main.append(theme);
    document.body.append(main);
    const scopeRule = {
      type: 0,
      cssText: '@scope (.theme) {}',
      cssRules: [createStyleRule({ selectorText: 'main :scope .shell', direction: 'ltr' })],
    } as unknown as CSSRule;
    expect(
      withDocumentStyleSheets([{ cssRules: [scopeRule] }], () =>
        resolveTextDirection(target, 'rtl'),
      ),
    ).toBe('ltr');
  });

  test('does not satisfy outside-ancestor context via a coincidentally-shaped descendant', () => {
    // Regression guard for the outside-context check itself: the scope root
    // (`.theme`) has NO `main` ancestor at all. A deeper descendant happens
    // to share the root's exact tag+position shape AND does have a `main`
    // ancestor (inserted between the root and that descendant). The
    // outside-ancestor check must verify the ROOT's own real ancestor
    // chain specifically, not any coincidentally-shaped descendant's.
    const outerDiv = document.createElement('div');
    const theme = document.createElement('section');
    theme.className = 'theme';
    const main = document.createElement('main');
    const decoy = document.createElement('section');
    const target = document.createElement('div');
    target.className = 'shell';
    decoy.append(target);
    main.append(decoy);
    theme.append(main);
    outerDiv.append(theme);
    document.body.append(outerDiv);
    const scopeRule = {
      type: 0,
      cssText: '@scope (.theme) {}',
      cssRules: [createStyleRule({ selectorText: 'main :scope .shell', direction: 'ltr' })],
    } as unknown as CSSRule;
    expect(
      withDocumentStyleSheets([{ cssRules: [scopeRule] }], () =>
        resolveTextDirection(target, 'rtl'),
      ),
    ).toBe('rtl');
  });

  test('evaluates each selector-list alternative independently around outside-ancestor context', () => {
    // `.shell, main :scope .other` — the SECOND alternative's `main`
    // outside-ancestor requirement must not gate the FIRST, unrelated
    // alternative. `.shell` matches the target directly regardless of
    // whether `main` is an ancestor of the scope root (it isn't, here).
    const theme = document.createElement('section');
    theme.className = 'theme';
    const target = document.createElement('div');
    target.className = 'shell';
    theme.append(target);
    document.body.append(theme);
    const scopeRule = {
      type: 0,
      cssText: '@scope (.theme) {}',
      cssRules: [createStyleRule({ selectorText: '.shell, main :scope .other', direction: 'ltr' })],
    } as unknown as CSSRule;
    expect(
      withDocumentStyleSheets([{ cssRules: [scopeRule] }], () =>
        resolveTextDirection(target, 'rtl'),
      ),
    ).toBe('ltr');
  });

  test('does not let a :scope nested inside :is() misread the selector as outside-ancestor context', () => {
    // `:is(main :scope .shell, .fallback)` — the `:scope` inside `:is()`
    // must not be treated as a TOP-LEVEL token: doing so slices `:is(main`
    // off as literal "outside-ancestor" text, which can never resolve
    // (`:is(main` isn't a real selector), losing the ordinary `.fallback`
    // alternative along with it.
    const theme = document.createElement('section');
    theme.className = 'theme';
    const target = document.createElement('div');
    target.className = 'fallback';
    theme.append(target);
    document.body.append(theme);
    const scopeRule = {
      type: 0,
      cssText: '@scope (.theme) {}',
      cssRules: [
        createStyleRule({
          selectorText: ':is(main :scope .shell, .fallback)',
          direction: 'ltr',
        }),
      ],
    } as unknown as CSSRule;
    expect(
      withDocumentStyleSheets([{ cssRules: [scopeRule] }], () =>
        resolveTextDirection(target, 'rtl'),
      ),
    ).toBe('ltr');
  });

  test('resolves a native CSS nesting parent selector before matching direction rules', () => {
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
      const shell = document.createElement('section');
      shell.className = 'nested-shell';
      const element = document.createElement('div');
      element.className = 'nested-menu';
      shell.appendChild(element);
      document.body.appendChild(shell);

      const nestedRule = createStyleRule({ selectorText: '& .nested-menu', direction: 'ltr' });
      const outerRule = createStyleRule({ selectorText: '.nested-shell', cssRules: [nestedRule] });
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

  test('resolves multiple native CSS nesting parent selectors', () => {
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
      const shell = document.createElement('section');
      shell.className = 'multi-nested-shell';
      const region = document.createElement('div');
      region.className = 'multi-nested-region';
      const element = document.createElement('div');
      element.className = 'multi-nested-menu';
      region.appendChild(element);
      shell.appendChild(region);
      document.body.appendChild(shell);

      const innerRule = createStyleRule({ selectorText: '& .multi-nested-menu', direction: 'ltr' });
      const middleRule = createStyleRule({
        selectorText: '& .multi-nested-region',
        cssRules: [innerRule],
      });
      const outerRule = createStyleRule({
        selectorText: '.multi-nested-shell',
        cssRules: [middleRule],
      });
      Object.defineProperty(innerRule, 'parentRule', { configurable: true, value: middleRule });
      Object.defineProperty(middleRule, 'parentRule', { configurable: true, value: outerRule });

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

  test('walks through conditional rules to the nearest nested style parent', () => {
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
      const shell = document.createElement('section');
      shell.className = 'conditional-nested-shell';
      const element = document.createElement('div');
      element.className = 'conditional-nested-menu';
      shell.appendChild(element);
      document.body.appendChild(shell);

      const nestedRule = createStyleRule({
        selectorText: '& .conditional-nested-menu',
        direction: 'ltr',
      });
      const mediaRule = {
        cssText: '@media all {}',
        type: 4,
        conditionText: 'all',
        media: {},
        cssRules: [nestedRule],
      } as unknown as CSSRule;
      const outerRule = createStyleRule({
        selectorText: '.conditional-nested-shell',
        cssRules: [mediaRule],
      });
      Object.defineProperty(nestedRule, 'parentRule', { configurable: true, value: mediaRule });
      Object.defineProperty(mediaRule, 'parentRule', { configurable: true, value: outerRule });

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

  test('preserves parent selector-list grouping when resolving nesting', () => {
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
      const shell = document.createElement('section');
      shell.className = 'selector-list-first';
      const element = document.createElement('div');
      element.className = 'selector-list-menu';
      shell.appendChild(element);
      document.body.appendChild(shell);

      const nestedRule = createStyleRule({
        selectorText: '& .selector-list-menu',
        direction: 'ltr',
      });
      const outerRule = createStyleRule({
        selectorText: '.selector-list-first, .selector-list-second',
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

  test('preserves mixed parent-list combinations for multiple nesting references', () => {
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
      const container = document.createElement('section');
      const previous = document.createElement('div');
      previous.className = 'mixed-selector-first';
      const element = document.createElement('div');
      element.className = 'mixed-selector-second';
      container.append(previous, element);
      document.body.appendChild(container);

      const nestedRule = createStyleRule({ selectorText: '& + &', direction: 'ltr' });
      const outerRule = createStyleRule({
        selectorText: '.mixed-selector-first, .mixed-selector-second',
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

  test('prefixes implicit nesting in mixed nested selector lists', () => {
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
      element.className = 'mixed-nested-list-target';
      document.body.appendChild(element);

      const nestedRule = createStyleRule({
        selectorText: '& .mixed-nested-list-child, .mixed-nested-list-target',
        direction: 'ltr',
      });
      const outerRule = createStyleRule({
        selectorText: '.mixed-nested-list-first, .mixed-nested-list-second',
        cssRules: [nestedRule],
      });
      Object.defineProperty(nestedRule, 'parentRule', { configurable: true, value: outerRule });

      expect(
        withDocumentStyleSheets([{ cssRules: [outerRule] }], () =>
          resolveTextDirection(element, 'rtl'),
        ),
      ).toBe('rtl');
    } finally {
      window.getComputedStyle = originalWindowGetComputedStyle;
      globalThis.getComputedStyle = originalGlobalGetComputedStyle;
    }
  });

  test('resolves a native nesting parent selector used mid-selector', () => {
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
      const parent = document.createElement('section');
      parent.className = 'mid-selector-parent';
      const shell = document.createElement('div');
      shell.className = 'mid-selector-shell';
      parent.appendChild(shell);
      document.body.appendChild(parent);

      const nestedRule = createStyleRule({
        selectorText: '.mid-selector-parent:has(&)',
        direction: 'ltr',
      });
      const outerRule = createStyleRule({
        selectorText: '.mid-selector-shell',
        cssRules: [nestedRule],
      });
      Object.defineProperty(nestedRule, 'parentRule', { configurable: true, value: outerRule });

      expect(
        withDocumentStyleSheets([{ cssRules: [outerRule] }], () =>
          resolveTextDirection(parent, 'rtl'),
        ),
      ).toBe('ltr');
    } finally {
      window.getComputedStyle = originalWindowGetComputedStyle;
      globalThis.getComputedStyle = originalGlobalGetComputedStyle;
    }
  });

  test('preserves escaped delimiters and literal ampersands in nested selectors', () => {
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
      window.getComputedStyle = originalWindowGetComputedStyle;
      globalThis.getComputedStyle = originalGlobalGetComputedStyle;
    }
  });

  test('preserves delimiters and commas inside quoted nested selector values', () => {
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
    const outerRule = {
      cssText:
        '@container not min-width: 20px { .malformed-negated-container-ltr { direction: ltr; } }',
      type: 0,
      conditionText: 'not min-width: 20px',
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
    const outerRule = {
      cssText: '@container (40em >= width >= 20px) {}',
      type: 0,
      conditionText: '(40em >= width >= 20px)',
      cssRules: [nestedRule],
    } as unknown as CSSRule;

    expect(
      withDocumentStyleSheets([{ cssRules: [outerRule] }], () =>
        resolveTextDirection(element, 'rtl'),
      ),
    ).toBe('rtl');
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
    const outerRule = {
      cssText:
        '@container sidebar (min-width: 20rem) { .real-named-container-ltr { direction: ltr; } }',
      type: 0,
      conditionText: 'sidebar (min-width: 20rem)',
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
    const outerRule = {
      cssText:
        '@container sidebar style(--theme: dark) { .real-named-style-ltr { direction: ltr; } }',
      type: 0,
      conditionText: 'sidebar style(--theme: dark)',
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

  test('fails closed for a name-only container rule with an empty containerQuery', () => {
    // `@container sidebar {}` — a name with no condition — is valid CSS:
    // verified against real Chromium, it parses into a CSSContainerRule
    // whose `containerQuery` reads back as `''` (not undefined) and which
    // matches whenever a same-named queryable container exists. This
    // module doesn't reproduce that container-existence check on its own,
    // so it must fail closed instead of treating the bare container name
    // as if it were parseable query syntax.
    const container = document.createElement('section');
    container.style.setProperty('container-type', 'inline-size');
    container.style.setProperty('container-name', 'sidebar');
    Object.defineProperty(container, 'offsetWidth', { value: 400, configurable: true });
    const element = document.createElement('div');
    element.className = 'name-only-container-ltr';
    container.appendChild(element);
    document.body.appendChild(container);
    const nestedRule = createStyleRule({
      selectorText: '.name-only-container-ltr',
      direction: 'ltr',
    });
    const outerRule = {
      cssText: '@container sidebar { .name-only-container-ltr { direction: ltr; } }',
      type: 0,
      conditionText: 'sidebar',
      containerName: 'sidebar',
      containerQuery: '',
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

  test('evaluates a comma-separated @container condition list, matching a later entry when an earlier named entry misses', () => {
    // `CSSContainerRule.conditions` exposes each comma-separated entry as an
    // independent `{ name, query }` pair, blanking the legacy singular
    // `containerName`/`containerQuery` accessors to `''` (verified against
    // real Chromium). No ancestor is named "sidebar", so the first entry
    // can never match; the second (unnamed) entry must still be evaluated
    // independently against the nearest queryable container and match on
    // its own.
    const container = document.createElement('section');
    container.style.setProperty('container-type', 'inline-size');
    Object.defineProperty(container, 'offsetWidth', { value: 700, configurable: true });
    const element = document.createElement('div');
    element.className = 'condition-list-second-match-ltr';
    container.appendChild(element);
    document.body.appendChild(container);
    const nestedRule = createStyleRule({
      selectorText: '.condition-list-second-match-ltr',
      direction: 'ltr',
    });
    const outerRule = {
      cssText:
        '@container sidebar (min-width: 20rem), (min-width: 40rem) { .condition-list-second-match-ltr { direction: ltr; } }',
      type: 0,
      conditionText: 'sidebar (min-width: 20rem), (min-width: 40rem)',
      containerName: '',
      containerQuery: '',
      conditions: [
        { name: 'sidebar', query: '(min-width: 20rem)' },
        { name: '', query: '(min-width: 40rem)' },
      ],
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

  test('evaluates a named first entry independently of an unmatched unnamed second entry in a condition list', () => {
    // The inverse mix: the FIRST (named) entry matches its own
    // independently-resolved named ancestor while the SECOND (unnamed)
    // entry, resolved against the nearest queryable container regardless of
    // name, does not — proving each entry gets its own ancestor resolution
    // rather than sharing one across the whole list.
    const sidebar = document.createElement('section');
    sidebar.style.setProperty('container-type', 'inline-size');
    sidebar.style.setProperty('container-name', 'sidebar');
    Object.defineProperty(sidebar, 'offsetWidth', { value: 700, configurable: true });
    const wrapper = document.createElement('div');
    wrapper.style.setProperty('container-type', 'inline-size');
    Object.defineProperty(wrapper, 'offsetWidth', { value: 100, configurable: true });
    const element = document.createElement('div');
    element.className = 'condition-list-first-match-ltr';
    wrapper.appendChild(element);
    sidebar.appendChild(wrapper);
    document.body.appendChild(sidebar);
    const nestedRule = createStyleRule({
      selectorText: '.condition-list-first-match-ltr',
      direction: 'ltr',
    });
    const outerRule = {
      cssText:
        '@container sidebar (min-width: 20rem), (min-width: 40rem) { .condition-list-first-match-ltr { direction: ltr; } }',
      type: 0,
      conditionText: 'sidebar (min-width: 20rem), (min-width: 40rem)',
      containerName: '',
      containerQuery: '',
      conditions: [
        { name: 'sidebar', query: '(min-width: 20rem)' },
        { name: '', query: '(min-width: 40rem)' },
      ],
      cssRules: [nestedRule],
    } as unknown as CSSRule;
    try {
      expect(
        withDocumentStyleSheets([{ cssRules: [outerRule] }], () =>
          resolveTextDirection(element, 'rtl'),
        ),
      ).toBe('ltr');
    } finally {
      sidebar.remove();
    }
  });

  test('fails closed when no entry in a comma-separated @container condition list matches', () => {
    const container = document.createElement('section');
    container.style.setProperty('container-type', 'inline-size');
    Object.defineProperty(container, 'offsetWidth', { value: 100, configurable: true });
    const element = document.createElement('div');
    element.className = 'condition-list-no-match-ltr';
    container.appendChild(element);
    document.body.appendChild(container);
    const nestedRule = createStyleRule({
      selectorText: '.condition-list-no-match-ltr',
      direction: 'ltr',
    });
    const outerRule = {
      cssText:
        '@container (min-width: 20rem), (min-width: 40rem) { .condition-list-no-match-ltr { direction: ltr; } }',
      type: 0,
      conditionText: '(min-width: 20rem), (min-width: 40rem)',
      containerName: '',
      containerQuery: '',
      conditions: [
        { name: '', query: '(min-width: 20rem)' },
        { name: '', query: '(min-width: 40rem)' },
      ],
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

  test('fails closed when every entry in a comma-separated @container condition list is unparseable', () => {
    // Distinct from "no entry matches": these entries use size features and
    // units this module's grammar doesn't implement at all
    // (`hasUnsupportedContainerSizeQuery`), not ones that are merely
    // structurally false at the container's current size.
    const container = document.createElement('section');
    container.style.setProperty('container-type', 'inline-size');
    Object.defineProperty(container, 'offsetWidth', { value: 700, configurable: true });
    const element = document.createElement('div');
    element.className = 'condition-list-unparseable-ltr';
    container.appendChild(element);
    document.body.appendChild(container);
    const nestedRule = createStyleRule({
      selectorText: '.condition-list-unparseable-ltr',
      direction: 'ltr',
    });
    const outerRule = {
      cssText:
        '@container (min-height: 40rem), (min-width: 30em) { .condition-list-unparseable-ltr { direction: ltr; } }',
      type: 0,
      conditionText: '(min-height: 40rem), (min-width: 30em)',
      containerName: '',
      containerQuery: '',
      conditions: [
        { name: '', query: '(min-height: 40rem)' },
        { name: '', query: '(min-width: 30em)' },
      ],
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
    const outerRule = {
      cssText:
        '@container (min-width: 20rem), (min-width: 40rem) { .condition-list-no-conditions-property-ltr { direction: ltr; } }',
      type: 0,
      conditionText: '(min-width: 20rem), (min-width: 40rem)',
      containerName: '',
      containerQuery: '',
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
    const outerRule = {
      cssText: '@container sidebar style(--flow: rtl) {}',
      type: 0,
      conditionText: 'style(--flow: rtl)',
      containerName: 'sidebar',
      cssRules: [nestedRule],
    } as unknown as CSSRule;
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
    const outerRule = {
      cssText: '@container (min-width: 320.25px) {}',
      type: 0,
      conditionText: '(min-width: 320.25px)',
      cssRules: [nestedRule],
    } as unknown as CSSRule;
    const original = window.getComputedStyle;
    const override = ((target: Element) => {
      const style = original(target);
      if (target === container)
        Object.defineProperty(style, 'width', { value: '320.5px', configurable: true });
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

  test('prefers a non-literal ancestor inline direction over a provider fallback', () => {
    const originalWindowGetComputedStyle = window.getComputedStyle;
    const originalGlobalGetComputedStyle = globalThis.getComputedStyle;
    const wrapper = document.createElement('section');
    wrapper.style.direction = 'var(--flow)';
    const element = document.createElement('div');
    element.dir = 'rtl';
    wrapper.append(element);
    document.body.append(wrapper);
    const getComputedStyleOverride = ((target: Element) => {
      const style = originalWindowGetComputedStyle(target);
      if (target === wrapper)
        Object.defineProperty(style, 'direction', { value: 'ltr', configurable: true });
      return style;
    }) as typeof window.getComputedStyle;
    window.getComputedStyle = getComputedStyleOverride;
    globalThis.getComputedStyle = getComputedStyleOverride;

    try {
      expect(resolveTextDirection(element, 'rtl', { ignoreElementDirectionAttribute: true })).toBe(
        'ltr',
      );
    } finally {
      window.getComputedStyle = originalWindowGetComputedStyle;
      globalThis.getComputedStyle = originalGlobalGetComputedStyle;
    }
  });

  test('observes media queries in document-adopted stylesheets', () => {
    const originalMatchMedia = globalThis.matchMedia;
    const listeners = new Set<EventListener>();
    const mediaRule = {
      media: {},
      conditionText: '(prefers-color-scheme: dark)',
      cssRules: [],
    } as unknown as CSSRule;
    globalThis.matchMedia = ((query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: (_type: string, listener: EventListener) => {
          listeners.add(listener);
        },
        removeEventListener: (_type: string, listener: EventListener) => {
          listeners.delete(listener);
        },
        dispatchEvent: () => true,
      }) satisfies MediaQueryList) as typeof globalThis.matchMedia;
    const element = document.createElement('div');
    document.body.append(element);
    let changes = 0;

    try {
      const disconnect = withDocumentStyleSheets([], () =>
        withDocumentAdoptedStyleSheets([{ cssRules: [mediaRule] }], () =>
          observeTextDirectionMediaQueries(element, () => {
            changes += 1;
          }),
        ),
      );
      expect(listeners.size).toBe(1);
      for (const listener of listeners) listener(new Event('change'));
      expect(changes).toBe(1);
      disconnect?.();
      expect(listeners.size).toBe(0);
    } finally {
      globalThis.matchMedia = originalMatchMedia;
    }
  });

  test('observes media queries in recursively imported stylesheets', () => {
    const originalMatchMedia = globalThis.matchMedia;
    const listeners = new Set<EventListener>();
    let activeListenerCount = 0;
    const queries: string[] = [];
    const importedMediaRule = {
      cssText: '@media (prefers-color-scheme: dark) {}',
      type: 4,
      media: {},
      conditionText: '(prefers-color-scheme: dark)',
      cssRules: [],
    } as unknown as CSSRule;
    const importedRuleList = {
      [Symbol.iterator]: function* () {
        yield importedMediaRule;
      },
    };
    const importedSheet = { cssRules: importedRuleList } as unknown as CSSStyleSheet;
    const importRule = {
      type: 3,
      cssText: '@import url("theme.css") screen and (prefers-color-scheme: dark);',
      media: { mediaText: 'screen and (prefers-color-scheme: dark)' },
      styleSheet: importedSheet,
    } as unknown as CSSImportRule;
    globalThis.matchMedia = ((query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: (_type: string, listener: EventListener) => {
          listeners.add(listener);
          activeListenerCount += 1;
        },
        removeEventListener: (_type: string, listener: EventListener) => {
          listeners.delete(listener);
          activeListenerCount -= 1;
        },
        dispatchEvent: () => true,
      }) satisfies MediaQueryList) as typeof globalThis.matchMedia;
    const originalMatchMediaWithTracking = globalThis.matchMedia;
    globalThis.matchMedia = ((query: string) => {
      queries.push(query);
      return originalMatchMediaWithTracking(query);
    }) as typeof globalThis.matchMedia;
    const element = document.createElement('div');
    document.body.append(element);
    let changes = 0;

    try {
      const disconnect = withDocumentStyleSheets([{ cssRules: [importRule] }], () =>
        observeTextDirectionMediaQueries(element, () => {
          changes += 1;
        }),
      );
      expect(new Set(queries)).toEqual(
        new Set(['screen and (prefers-color-scheme: dark)', '(prefers-color-scheme: dark)']),
      );
      expect(activeListenerCount).toBe(2);
      for (const listener of listeners) listener(new Event('change'));
      expect(changes).toBeGreaterThan(0);
      disconnect?.();
      expect(activeListenerCount).toBe(0);
    } finally {
      globalThis.matchMedia = originalMatchMedia;
    }
  });

  test('deduplicates shared and cyclic imports while observing import media', () => {
    const originalMatchMedia = globalThis.matchMedia;
    const listeners = new Set<EventListener>();
    let activeListenerCount = 0;
    const queries: string[] = [];
    const sharedMediaRule = {
      cssText: '@media (prefers-contrast: more) {}',
      type: 4,
      media: {},
      conditionText: '(prefers-contrast: more)',
      cssRules: [],
    } as unknown as CSSRule;
    const rootSheet = { cssRules: [] } as unknown as CSSStyleSheet;
    const importedSheet = { cssRules: [] } as unknown as CSSStyleSheet;
    const sharedSheet = { cssRules: [sharedMediaRule] } as unknown as CSSStyleSheet;
    const rootImport = {
      type: 3,
      cssText: '@import url("nested.css") screen;',
      media: { mediaText: 'screen' },
      styleSheet: importedSheet,
    } as unknown as CSSImportRule;
    const duplicateSharedImport = {
      type: 3,
      cssText: '@import url("shared.css") screen;',
      media: { mediaText: 'screen' },
      styleSheet: sharedSheet,
    } as unknown as CSSImportRule;
    const cycleImport = {
      type: 3,
      cssText: '@import url("root.css");',
      media: { mediaText: '' },
      styleSheet: rootSheet,
    } as unknown as CSSImportRule;
    const sharedImport = {
      type: 3,
      cssText: '@import url("shared.css") screen;',
      media: { mediaText: 'screen' },
      styleSheet: sharedSheet,
    } as unknown as CSSImportRule;
    Object.defineProperty(rootSheet, 'cssRules', {
      configurable: true,
      value: [rootImport, duplicateSharedImport],
    });
    Object.defineProperty(importedSheet, 'cssRules', {
      configurable: true,
      value: [cycleImport, sharedImport],
    });
    globalThis.matchMedia = ((query: string) => {
      queries.push(query);
      return {
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: (_type: string, listener: EventListener) => {
          listeners.add(listener);
          activeListenerCount += 1;
        },
        removeEventListener: (_type: string, listener: EventListener) => {
          listeners.delete(listener);
          activeListenerCount -= 1;
        },
        dispatchEvent: () => true,
      } satisfies MediaQueryList;
    }) as typeof globalThis.matchMedia;
    const element = document.createElement('div');
    document.body.append(element);

    try {
      const disconnect = withDocumentStyleSheets([{ cssRules: rootSheet.cssRules }], () =>
        observeTextDirectionMediaQueries(element, () => {}),
      );
      expect(new Set(queries)).toEqual(new Set(['screen', '(prefers-contrast: more)']));
      expect(activeListenerCount).toBe(2);
      disconnect?.();
      expect(activeListenerCount).toBe(0);
    } finally {
      globalThis.matchMedia = originalMatchMedia;
    }
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
