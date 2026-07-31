import {
  evaluateLogicalContainerCondition,
  hasUnsupportedContainerSizeQuery,
  parseStyleQuery,
} from './text-direction-container.ts';

export type ParentElementResolver = (element: HTMLElement) => HTMLElement | null;

export function matchesDirectionStyleRule(
  element: HTMLElement,
  getParentElement: ParentElementResolver,
): boolean {
  const styleSheets = new Set<CSSStyleSheet>([
    ...Array.from(element.ownerDocument.styleSheets),
    ...Array.from(element.ownerDocument.adoptedStyleSheets ?? []),
  ]);
  const root = element.getRootNode();
  if (typeof ShadowRoot !== 'undefined' && root instanceof ShadowRoot) {
    for (const sheet of root.adoptedStyleSheets) styleSheets.add(sheet);
    for (const styleElement of root.querySelectorAll('style')) {
      if (styleElement.sheet) styleSheets.add(styleElement.sheet);
    }
    for (const linkElement of root.querySelectorAll<HTMLLinkElement>('link[rel~="stylesheet"]')) {
      if (linkElement.sheet) styleSheets.add(linkElement.sheet);
    }
  }
  for (const sheet of styleSheets) {
    if (!isActiveStyleSheet(sheet)) continue;
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    if (matchesDirectionStyleRuleList(element, rules, getParentElement)) return true;
  }
  return false;
}

// A disabled stylesheet, or one whose sheet-level `media` doesn't currently
// match, contributes no active styling — its rules must not be used as
// direction-styling hints even though they're still present in the CSSOM.
function isActiveStyleSheet(sheet: CSSStyleSheet): boolean {
  if (sheet.disabled) return false;
  const mediaText = sheet.media?.mediaText;
  if (!mediaText) return true;
  if (typeof matchMedia !== 'function') return true;
  return matchMedia(mediaText).matches;
}

export function matchesDirectionStyleRuleCached(
  element: HTMLElement,
  cache?: WeakMap<HTMLElement, boolean>,
  getParentElement?: ParentElementResolver,
): boolean {
  if (!getParentElement) return false;
  if (!cache) return matchesDirectionStyleRule(element, getParentElement);
  const cached = cache.get(element);
  if (cached !== undefined) return cached;
  const matched = matchesDirectionStyleRule(element, getParentElement);
  cache.set(element, matched);
  return matched;
}

function matchesDirectionStyleRuleList(
  element: HTMLElement,
  rules: CSSRuleList | Iterable<CSSRule>,
  getParentElement: ParentElementResolver,
): boolean {
  for (const rule of Array.from(rules)) {
    if (Reflect.get(rule, 'type') === 3) {
      const imported = Reflect.get(rule, 'styleSheet');
      if (imported) {
        try {
          const importedRules = Reflect.get(imported, 'cssRules');
          if (
            isCssRuleCollection(importedRules) &&
            matchesDirectionStyleRuleList(element, importedRules, getParentElement)
          )
            return true;
        } catch {
          // Cross-origin imports may deny CSSOM access.
        }
      }
      continue;
    }
    if (isCssStyleRule(rule)) {
      if (!rule.style.direction) {
        const nestedRules = readNestedCssRules(rule);
        if (nestedRules && matchesDirectionStyleRuleList(element, nestedRules, getParentElement))
          return true;
        continue;
      }
      try {
        if (element.matches(rule.selectorText)) return true;
      } catch {
        continue;
      }
    }

    const nestedRules = readNestedCssRules(rule);
    if (
      nestedRules &&
      isConditionalRuleActive(rule, element, getParentElement) &&
      matchesDirectionStyleRuleList(element, nestedRules, getParentElement)
    ) {
      return true;
    }
  }
  return false;
}

function readNestedCssRules(rule: CSSRule): CSSRuleList | Iterable<CSSRule> | undefined {
  if (!('cssRules' in rule)) return undefined;
  try {
    const nestedRules: unknown = Reflect.get(rule, 'cssRules');
    return isCssRuleCollection(nestedRules) ? nestedRules : undefined;
  } catch {
    return undefined;
  }
}

function isCssRuleCollection(value: unknown): value is CSSRuleList | Iterable<CSSRule> {
  if (typeof CSSRuleList !== 'undefined' && value instanceof CSSRuleList) return true;
  return Array.isArray(value) && value.every(isCssRule);
}

function isCssRule(value: unknown): value is CSSRule {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof Reflect.get(value, 'cssText') === 'string' &&
    typeof Reflect.get(value, 'type') === 'number'
  );
}

function isCssStyleRule(rule: CSSRule): rule is CSSStyleRule {
  return (
    typeof Reflect.get(rule, 'selectorText') === 'string' &&
    typeof Reflect.get(rule, 'style') === 'object' &&
    Reflect.get(rule, 'style') !== null
  );
}

function isConditionalRuleActive(
  rule: CSSRule,
  element: HTMLElement,
  getParentElement: ParentElementResolver,
): boolean {
  if (isScopeRule(rule)) return isScopeActive(rule, element);
  const conditionText = Reflect.get(rule, 'conditionText');
  if (typeof conditionText !== 'string' || !conditionText.trim()) return true;

  if (isContainerRule(rule))
    return isContainerQueryActive(conditionText, element, rule, getParentElement);

  if (isMediaRule(rule) && typeof matchMedia === 'function') {
    return matchMedia(conditionText).matches;
  }

  if (isSupportsRule(rule) && typeof CSS !== 'undefined' && typeof CSS.supports === 'function')
    return CSS.supports(conditionText);

  return true;
}

function isScopeRule(rule: CSSRule): boolean {
  if (rule.constructor.name === 'CSSScopeRule') return true;
  const cssText = Reflect.get(rule, 'cssText');
  return typeof cssText === 'string' && /^\s*@scope\b/i.test(cssText);
}

function isScopeActive(rule: CSSRule, element: HTMLElement): boolean {
  const cssText = Reflect.get(rule, 'cssText');
  if (typeof cssText !== 'string') return false;
  const prelude = /^\s*@scope\s*([^{]*)\{/i.exec(cssText)?.[1]?.trim();
  if (prelude === undefined) return false;
  const toMatch = /\bto\s*\(([^()]*)\)\s*$/i.exec(prelude);
  const rootText = (toMatch ? prelude.slice(0, toMatch.index) : prelude).trim();
  const rootSelector = rootText.replace(/^\((.*)\)$/s, '$1').trim();
  try {
    if (toMatch && splitScopeSelectors(toMatch[1]!).length === 0) return false;
    if (
      rootSelector &&
      !splitScopeSelectors(rootSelector).some(
        (selector) => element.matches(selector) || element.closest(selector),
      )
    )
      return false;
    if (
      toMatch?.[1] &&
      splitScopeSelectors(toMatch[1]).some((selector) => element.closest(selector))
    )
      return false;
    return true;
  } catch {
    return false;
  }
}

function splitScopeSelectors(value: string): string[] {
  const selectors: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === '(') depth += 1;
    else if (value[index] === ')') depth -= 1;
    else if (value[index] === ',' && depth === 0) {
      const selector = value.slice(start, index).trim();
      if (!selector) return [];
      selectors.push(selector);
      start = index + 1;
    }
  }
  if (depth !== 0) return [];
  const selector = value.slice(start).trim();
  if (!selector) return [];
  selectors.push(selector);
  return selectors;
}

function isContainerQueryActive(
  conditionText: string,
  element: HTMLElement,
  rule: CSSRule,
  getParentElement: ParentElementResolver,
): boolean {
  if (typeof getComputedStyle !== 'function') return false;
  const styleQuery = parseStyleQuery(conditionText);
  if (styleQuery) {
    const remainder = (
      conditionText.slice(0, styleQuery.index) + conditionText.slice(styleQuery.end)
    )
      .replace(/^\s*(?:and|or|not)\b/i, '')
      .replace(/^\(|\)$/g, '')
      .trim();
    // A compound condition — e.g. `style(--x: y) and (min-width: 40rem)` —
    // is not fully evaluated below: only the style() clause is checked
    // against ancestors. Fail closed rather than deciding solely from the
    // style() term, which would wrongly treat an inactive compound rule as
    // an active styling hint.
    if (remainder) return false;
    const containerName = Reflect.get(rule, 'containerName');
    let ancestor = getParentElement(element);
    while (ancestor) {
      if (typeof containerName === 'string' && containerName) {
        const computedStyle = getComputedStyle(ancestor);
        const name =
          computedStyle.containerName ||
          computedStyle.getPropertyValue('container-name') ||
          ancestor.style.containerName ||
          ancestor.style.getPropertyValue('container-name');
        if (!name.split(/\s+/).includes(containerName)) {
          ancestor = getParentElement(ancestor);
          continue;
        }
      }
      const value =
        getComputedStyle(ancestor).getPropertyValue(styleQuery.name).trim() ||
        ancestor.style.getPropertyValue(styleQuery.name).trim();
      return /^\s*not\b/i.test(conditionText)
        ? value !== styleQuery.value.trim()
        : value === styleQuery.value.trim();
    }
    return false;
  }
  const containerName = Reflect.get(rule, 'containerName');
  const queriesPhysicalWidth =
    /(?:^|[\s(])(?:width|min-width|max-width)\s*[:<>=]/i.test(conditionText) ||
    /[\d.]+(?:px|rem)\s*(?:<=|<|>=|>)\s*width\b/i.test(conditionText);
  let container = getParentElement(element);
  while (container) {
    const computedStyle = getComputedStyle(container);
    const type =
      computedStyle.containerType ||
      computedStyle.getPropertyValue('container-type') ||
      container.style.containerType ||
      container.style.getPropertyValue('container-type');
    const name =
      computedStyle.containerName ||
      computedStyle.getPropertyValue('container-name') ||
      container.style.containerName ||
      container.style.getPropertyValue('container-name');
    const writingMode =
      computedStyle.writingMode ||
      computedStyle.getPropertyValue('writing-mode') ||
      container.style.writingMode ||
      container.style.getPropertyValue('writing-mode');
    if (
      (typeof containerName !== 'string' ||
        !containerName ||
        name.split(/\s+/).includes(containerName)) &&
      type &&
      type !== 'normal' &&
      !(
        queriesPhysicalWidth &&
        /^(?:vertical|sideways)-/i.test(writingMode) &&
        type === 'inline-size'
      )
    ) {
      break;
    }
    container = getParentElement(container);
  }
  if (!container) return false;
  const computedContainerStyle = getComputedStyle(container);
  const readInset = (property: string, fallbackProperty: string): number => {
    const camel = property.replace(/-([a-z])/g, (_, character: string) => character.toUpperCase());
    const fallbackCamel = fallbackProperty.replace(/-([a-z])/g, (_, character: string) =>
      character.toUpperCase(),
    );
    const value =
      Reflect.get(computedContainerStyle, camel) ||
      Reflect.get(container.style, camel) ||
      computedContainerStyle.getPropertyValue(property).trim() ||
      container.style.getPropertyValue(property).trim() ||
      Reflect.get(computedContainerStyle, fallbackCamel) ||
      Reflect.get(container.style, fallbackCamel) ||
      computedContainerStyle.getPropertyValue(fallbackProperty).trim() ||
      container.style.getPropertyValue(fallbackProperty).trim();
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  };
  const writingMode =
    computedContainerStyle.writingMode ||
    computedContainerStyle.getPropertyValue('writing-mode') ||
    container.style.writingMode ||
    container.style.getPropertyValue('writing-mode');
  const usesInlineSize = /(?:inline-size|min-inline-size|max-inline-size)/i.test(conditionText);
  const isVerticalWritingMode = /^(?:vertical|sideways)-/i.test(writingMode);
  const verticalInlineAxis = usesInlineSize && isVerticalWritingMode;
  // `offsetWidth`/`offsetHeight` report the border-box size from layout,
  // unaffected by a CSS `transform` on the container. `getBoundingClientRect()`
  // reports the post-transform box, which container size queries never use —
  // a `scale(2)` container would otherwise look twice as large as the layout
  // engine (and any real `@container` query) considers it to be.
  // A physical `width` query is always a horizontal measurement. Under a
  // vertical writing mode the logical inline insets resolve to top/bottom,
  // not left/right, so a physical query must subtract physical left/right
  // insets instead — falling back to the logical inline name only under a
  // horizontal writing mode, where the two resolve to the same value (some
  // environments only resolve the property name that was actually set).
  const physicalInsets =
    readInset('padding-left', 'padding-inline-start') +
    readInset('padding-right', 'padding-inline-end');
  const physicalBorders =
    readInset('border-left-width', 'border-inline-start-width') +
    readInset('border-right-width', 'border-inline-end-width');
  const inlineInsets = verticalInlineAxis
    ? readInset('padding-inline-start', 'padding-top') +
      readInset('padding-inline-end', 'padding-bottom')
    : physicalInsets;
  const inlineBorders = verticalInlineAxis
    ? readInset('border-inline-start-width', 'border-top-width') +
      readInset('border-inline-end-width', 'border-bottom-width')
    : physicalBorders;
  const readUsedContentSize = (
    axis: 'width' | 'height',
    fallback: number,
    insets: number,
    borders: number,
  ) => {
    const parsed = Number.parseFloat(computedContainerStyle[axis]);
    if (!Number.isFinite(parsed)) return fallback;
    const boxSizing = computedContainerStyle.boxSizing || container.style.boxSizing;
    return boxSizing === 'border-box' ? Math.max(0, parsed - insets - borders) : parsed;
  };
  const physicalClientSize = container.clientWidth;
  const inlineClientSize = verticalInlineAxis ? container.clientHeight : physicalClientSize;
  const width = Math.max(
    0,
    readUsedContentSize(
      'width',
      physicalClientSize > 0
        ? physicalClientSize - physicalInsets
        : container.offsetWidth - physicalBorders - physicalInsets,
      physicalInsets,
      physicalBorders,
    ),
  );
  const inlineSize = Math.max(
    0,
    readUsedContentSize(
      verticalInlineAxis ? 'height' : 'width',
      inlineClientSize > 0
        ? inlineClientSize - inlineInsets
        : (verticalInlineAxis ? container.offsetHeight : container.offsetWidth) -
            inlineBorders -
            inlineInsets,
      inlineInsets,
      inlineBorders,
    ),
  );
  const rootFontSize = Number.parseFloat(
    getComputedStyle(element.ownerDocument.documentElement).fontSize,
  );
  const remSize = Number.isFinite(rootFontSize) && rootFontSize > 0 ? rootFontSize : 16;
  // This evaluator only understands `px`/`rem` length units and the
  // width/inline-size features. A condition using any other CSS length unit
  // (`em`, `vw`, `%`, ...), or a size feature it doesn't implement (`height`,
  // `block-size`, `aspect-ratio`, `orientation`, ...), cannot be decided here
  // — fail closed instead of silently defaulting to "matches" (an inactive
  // rule at the current size would otherwise be treated as an active
  // styling hint).
  if (hasUnsupportedContainerSizeQuery(conditionText)) return false;
  return evaluateLogicalContainerCondition(conditionText, width, remSize, inlineSize);
}

export function isContainerRule(rule: CSSRule): boolean {
  if (rule.constructor.name === 'CSSContainerRule') return true;
  if (Reflect.get(rule, 'type') !== 0) return false;
  const cssText = Reflect.get(rule, 'cssText');
  return typeof cssText === 'string' && /^\s*@container\b/i.test(cssText);
}

function isMediaRule(rule: CSSRule): boolean {
  return typeof Reflect.get(rule, 'media') === 'object' && Reflect.get(rule, 'media') !== null;
}

function isSupportsRule(rule: CSSRule): boolean {
  return rule.constructor.name === 'CSSSupportsRule' || Reflect.get(rule, 'type') === 12;
}

export function observeTextDirectionMediaQueries(
  element: HTMLElement | null | undefined,
  onChange: () => void,
): (() => void) | undefined {
  if (!element || typeof matchMedia !== 'function') return undefined;
  const sheets = new Set<CSSStyleSheet>(Array.from(element.ownerDocument.styleSheets));
  for (const sheet of element.ownerDocument.adoptedStyleSheets ?? []) sheets.add(sheet);
  const root = element.getRootNode();
  if (typeof ShadowRoot !== 'undefined' && root instanceof ShadowRoot) {
    for (const sheet of root.adoptedStyleSheets) sheets.add(sheet);
    for (const style of root.querySelectorAll<HTMLStyleElement | HTMLLinkElement>(
      'style,link[rel~="stylesheet"]',
    )) {
      const sheet = style.sheet;
      if (sheet) sheets.add(sheet);
    }
  }
  const queries = new Set<string>();
  const visit = (rules: CSSRuleList | Iterable<CSSRule>) => {
    for (const rule of Array.from(rules)) {
      if (isMediaRule(rule)) {
        const condition = Reflect.get(rule, 'conditionText');
        if (typeof condition === 'string' && condition) queries.add(condition);
      }
      const nested = readNestedCssRules(rule);
      if (nested) visit(nested);
    }
  };
  for (const sheet of sheets) {
    try {
      visit(sheet.cssRules);
    } catch {
      // Ignore inaccessible cross-origin stylesheets.
    }
  }
  const mediaQueries = [...queries].map((query) => matchMedia(query));
  const handler = () => onChange();
  for (const mediaQuery of mediaQueries) mediaQuery.addEventListener?.('change', handler);
  return () => {
    for (const mediaQuery of mediaQueries) mediaQuery.removeEventListener?.('change', handler);
  };
}
