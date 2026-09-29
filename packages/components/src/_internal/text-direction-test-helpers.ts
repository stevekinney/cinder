/// <reference lib="dom" />
import { afterEach } from 'bun:test';

import { setupHappyDom } from '@lostgradient/testing';
setupHappyDom();

afterEach(() => {
  document.documentElement.removeAttribute('dir');
  document.body.replaceChildren();
});

export function withDocumentStyleSheets<T>(styleSheets: unknown[], callback: () => T): T {
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

export function withDocumentAdoptedStyleSheets<T>(styleSheets: unknown[], callback: () => T): T {
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

export function createStyleRule(options: {
  selectorText: string;
  direction?: string;
  cssRules?: unknown;
}): CSSRule {
  const sheet = createFixtureStyleSheet();
  sheet.insertRule(`:root { direction: ${options.direction ?? 'ltr'}; }`, 0);
  const rule = sheet.cssRules[0]!;
  Object.defineProperty(rule, 'selectorText', { configurable: true, value: options.selectorText });
  Object.defineProperty(rule, 'cssText', { configurable: true, value: options.selectorText });
  if (rule instanceof CSSStyleRule) rule.style.direction = options.direction ?? '';
  if ('cssRules' in options) {
    Object.defineProperty(rule, 'cssRules', {
      configurable: true,
      get: () => options.cssRules,
    });
  }
  return rule;
}

export function createRuleWithThrowingCssRules(): CSSRule {
  const sheet = createFixtureStyleSheet();
  sheet.insertRule('@media all {}', 0);
  const rule = sheet.cssRules[0]!;
  Object.defineProperty(rule, 'cssRules', {
    configurable: true,
    get: () => {
      throw new Error('stylesheet unavailable');
    },
  });
  return rule;
}

export function createStyleSheetWithThrowingRules(): CSSStyleSheet {
  const sheet = createFixtureStyleSheet();
  Object.defineProperty(sheet, 'cssRules', {
    configurable: true,
    get: () => {
      throw new Error('stylesheet unavailable');
    },
  });
  return sheet;
}

function createFixtureStyleSheet(): CSSStyleSheet {
  return new CSSStyleSheet();
}

export function withComputedStyle(
  style: CSSStyleDeclaration,
  overrides: Record<string, string>,
): CSSStyleDeclaration {
  return new Proxy(style, {
    get(target, property, receiver) {
      return typeof property === 'string' && property in overrides
        ? overrides[property]
        : Reflect.get(target, property, receiver);
    },
  });
}

export function withComputedDirection(
  style: CSSStyleDeclaration,
  direction: string,
): CSSStyleDeclaration {
  return withComputedStyle(style, { direction });
}

export function createCssRule(options: {
  cssText: string;
  type?: number;
  selectorText?: string;
  conditionText?: string;
  containerQuery?: string;
  conditions?: unknown[];
  containerName?: string;
  cssRules?: unknown;
  media?: MediaList;
  styleSheet?: CSSStyleSheet | null;
  parentRule?: CSSRule | null;
}): CSSRule {
  const sheet = new CSSStyleSheet();
  let rule: CSSRule;
  let usedFallback = false;
  try {
    sheet.insertRule(options.cssText, 0);
    rule = sheet.cssRules[0]!;
  } catch {
    usedFallback = true;
    sheet.insertRule('@media all {}', 0);
    rule = sheet.cssRules[0]!;
  }
  if (usedFallback) {
    for (const property of [
      'selectorText',
      'style',
      'conditionText',
      'containerQuery',
      'containerName',
      'conditions',
      'cssRules',
      'media',
    ]) {
      if (!(property in options))
        Object.defineProperty(rule, property, { configurable: true, value: undefined });
    }
  }
  const overrides: Array<[string, unknown]> = [
    ['cssText', options.cssText],
    ['type', options.type],
    ['selectorText', options.selectorText],
    ['conditionText', options.conditionText],
    ['containerQuery', options.containerQuery],
    ['conditions', options.conditions],
    ['containerName', options.containerName],
    ['cssRules', options.cssRules],
    ['media', options.media],
    ['styleSheet', options.styleSheet],
    ['parentRule', options.parentRule],
  ];
  for (const [property, value] of overrides) {
    if (value !== undefined) {
      Object.defineProperty(rule, property, {
        configurable: true,
        value,
      });
    }
  }
  return rule;
}

export function createStyleSheetWithRules(rules: CSSRule[]): CSSStyleSheet {
  return createStyleSheetWithRuleCollection(rules);
}

export function createStyleSheetWithRuleCollection(rules: unknown): CSSStyleSheet {
  const sheet = new CSSStyleSheet();
  Object.defineProperty(sheet, 'cssRules', { configurable: true, value: rules });
  return sheet;
}

export function createMediaList(mediaText: string): MediaList {
  const sheet = new CSSStyleSheet();
  sheet.insertRule(`@media ${mediaText} {}`, 0);
  const rule = sheet.cssRules[0];
  if (!(rule instanceof CSSMediaRule)) {
    throw new Error('Expected a CSS media rule fixture');
  }
  Object.defineProperty(rule.media, 'mediaText', {
    configurable: true,
    value: mediaText,
  });
  return rule.media;
}

export function createMediaQueryList(
  query: string,
  matches: boolean,
  listeners?: Set<EventListener>,
  onAddListener?: () => void,
  onRemoveListener?: () => void,
): MediaQueryList {
  const mediaQueryList = window.matchMedia(query);
  Object.defineProperty(mediaQueryList, 'matches', { configurable: true, value: matches });
  Object.defineProperty(mediaQueryList, 'media', { configurable: true, value: query });
  if (listeners) {
    Object.defineProperties(mediaQueryList, {
      addEventListener: {
        configurable: true,
        value: (_type: string, listener: EventListener) => {
          listeners.add(listener);
          onAddListener?.();
        },
      },
      removeEventListener: {
        configurable: true,
        value: (_type: string, listener: EventListener) => {
          listeners.delete(listener);
          onRemoveListener?.();
        },
      },
    });
  }
  return mediaQueryList;
}
