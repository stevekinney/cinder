export type ScopeRoot = Element | ShadowRoot;

export function isCssRuleCollection(value: unknown): value is CSSRuleList | Iterable<CSSRule> {
  if (typeof CSSRuleList !== 'undefined' && value instanceof CSSRuleList) return true;
  if (Array.isArray(value)) return value.every(isCssRule);
  if (typeof value !== 'object' || value === null) return false;
  return typeof Reflect.get(value, Symbol.iterator) === 'function';
}

function isCssRule(value: unknown): value is CSSRule {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof Reflect.get(value, 'cssText') === 'string' &&
    typeof Reflect.get(value, 'type') === 'number'
  );
}

export function isCssStyleRule(rule: CSSRule): rule is CSSStyleRule {
  return (
    typeof Reflect.get(rule, 'selectorText') === 'string' &&
    typeof Reflect.get(rule, 'style') === 'object' &&
    Reflect.get(rule, 'style') !== null
  );
}

export function readNestedCssRules(rule: CSSRule): CSSRuleList | Iterable<CSSRule> | undefined {
  if (!('cssRules' in rule)) return undefined;
  try {
    const nestedRules: unknown = Reflect.get(rule, 'cssRules');
    return isCssRuleCollection(nestedRules) ? nestedRules : undefined;
  } catch {
    return undefined;
  }
}

export function isMediaRule(rule: CSSRule): boolean {
  return typeof Reflect.get(rule, 'media') === 'object' && Reflect.get(rule, 'media') !== null;
}

export function matchesSelectorSafely(element: Element, selector: string): boolean {
  try {
    return element.matches(selector);
  } catch {
    return false;
  }
}

export function collectDirectionStyleSheets(
  element: HTMLElement,
): Map<CSSStyleSheet, ScopeRoot | null> {
  const styleSheets = new Map<CSSStyleSheet, ScopeRoot | null>();
  for (const sheet of Array.from(element.ownerDocument.styleSheets)) styleSheets.set(sheet, null);
  for (const sheet of Array.from(element.ownerDocument.adoptedStyleSheets ?? []))
    styleSheets.set(sheet, null);
  addShadowStyleSheets(element.getRootNode(), styleSheets);
  return styleSheets;
}

function addShadowStyleSheets(root: Node, styleSheets: Map<CSSStyleSheet, ScopeRoot | null>): void {
  if (typeof ShadowRoot !== 'undefined' && root instanceof ShadowRoot) {
    for (const sheet of root.adoptedStyleSheets) styleSheets.set(sheet, root);
    for (const styleElement of root.querySelectorAll('style')) {
      if (styleElement.sheet) styleSheets.set(styleElement.sheet, root);
    }
    for (const linkElement of root.querySelectorAll<HTMLLinkElement>('link[rel~="stylesheet"]')) {
      if (linkElement.sheet) styleSheets.set(linkElement.sheet, root);
    }
  }
}
