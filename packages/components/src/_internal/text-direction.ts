import type { TextDirection } from './locale-context.ts';

export function resolveTextDirection(
  element: HTMLElement | null | undefined,
  fallback?: TextDirection,
  options?: { ignoreElementDirectionAttribute?: boolean },
): TextDirection | undefined {
  const ignoreElementDirectionAttribute = options?.ignoreElementDirectionAttribute ?? false;
  const directionStyleRuleCache = new WeakMap<HTMLElement, boolean>();
  if (ignoreElementDirectionAttribute && element) {
    const styledDirection = readComputedTextDirection(element);
    const rootComputedDirection = readComputedTextDirection(element.ownerDocument.documentElement);
    // A computed direction that differs from the root is only trustworthy here when
    // something other than the element's own `dir` attribute could be causing it — in
    // browsers where getComputedStyle() reflects `dir` (which this option exists to
    // ignore), a bare divergence-from-root check would let that attribute leak back in.
    const elementDirectionAttribute = element.getAttribute('dir')?.toLowerCase();
    const differsFromRootViaStyling =
      styledDirection !== rootComputedDirection && styledDirection !== elementDirectionAttribute;
    if (
      styledDirection &&
      (hasElementDirectionStylingHint(element, directionStyleRuleCache) ||
        differsFromRootViaStyling)
    )
      return styledDirection;
  }

  let currentElement: HTMLElement | null = ignoreElementDirectionAttribute
    ? (element?.parentElement ?? null)
    : (element ?? null);
  let documentDirection: TextDirection | undefined;
  let styledDirectionElement: HTMLElement | null = null;
  while (currentElement) {
    if (
      !styledDirectionElement &&
      currentElement !== currentElement.ownerDocument.documentElement &&
      (currentElement.style.direction === 'rtl' ||
        currentElement.style.direction === 'ltr' ||
        matchesDirectionStyleRuleCached(currentElement, directionStyleRuleCache))
    ) {
      styledDirectionElement = currentElement;
    }
    const direction = currentElement.getAttribute('dir')?.toLowerCase();
    if (direction === 'rtl' || direction === 'ltr') {
      if (typeof getComputedStyle === 'function' && styledDirectionElement) {
        const styledDirection = getComputedStyle(styledDirectionElement).direction;
        if (styledDirection === 'rtl' || styledDirection === 'ltr') return styledDirection;
      }
      if (currentElement === currentElement.ownerDocument.documentElement) {
        documentDirection = direction;
        break;
      }
      return direction;
    }
    if (direction === 'auto' && typeof getComputedStyle === 'function') {
      const computedDirection = getComputedStyle(currentElement).direction;
      if (computedDirection === 'rtl' || computedDirection === 'ltr') return computedDirection;
    }
    const styledDirection = currentElement.style.direction;
    if (!styledDirectionElement && (styledDirection === 'rtl' || styledDirection === 'ltr')) {
      styledDirectionElement = currentElement;
    }
    currentElement = currentElement.parentElement;
  }

  if (typeof getComputedStyle === 'function' && styledDirectionElement) {
    const direction = getComputedStyle(styledDirectionElement).direction;
    if (direction === 'rtl' || direction === 'ltr') return direction;
  }

  const computedDirection = readComputedTextDirection(element);
  const rootComputedDirection = readComputedTextDirection(element?.ownerDocument.documentElement);
  if (
    !ignoreElementDirectionAttribute &&
    computedDirection &&
    computedDirection !== rootComputedDirection
  )
    return computedDirection;
  if (
    computedDirection &&
    fallback &&
    computedDirection !== fallback &&
    hasDirectionStylingHint(element, false, directionStyleRuleCache)
  ) {
    return computedDirection;
  }
  if (!fallback && computedDirection === 'rtl') return computedDirection;

  if (fallback) return fallback;
  if (documentDirection) return documentDirection;

  return undefined;
}

function hasElementDirectionStylingHint(
  element: HTMLElement,
  cache: WeakMap<HTMLElement, boolean>,
): boolean {
  return Boolean(element.style.direction) || matchesDirectionStyleRuleCached(element, cache);
}

function readComputedTextDirection(
  element: HTMLElement | null | undefined,
): TextDirection | undefined {
  if (!element || typeof getComputedStyle !== 'function') return undefined;
  const direction = getComputedStyle(element).direction;
  return direction === 'rtl' || direction === 'ltr' ? direction : undefined;
}

function hasDirectionStylingHint(
  element: HTMLElement | null | undefined,
  includeElement = false,
  cache?: WeakMap<HTMLElement, boolean>,
): boolean {
  let currentElement = includeElement ? element : element?.parentElement;
  while (currentElement && currentElement !== currentElement.ownerDocument.documentElement) {
    if (currentElement.style.direction) return true;
    if (matchesDirectionStyleRuleCached(currentElement, cache)) return true;
    currentElement = currentElement.parentElement;
  }
  return false;
}

function matchesDirectionStyleRule(element: HTMLElement): boolean {
  for (const sheet of Array.from(element.ownerDocument.styleSheets)) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    if (matchesDirectionStyleRuleList(element, rules)) return true;
  }
  return false;
}

function matchesDirectionStyleRuleCached(
  element: HTMLElement,
  cache?: WeakMap<HTMLElement, boolean>,
): boolean {
  if (!cache) return matchesDirectionStyleRule(element);
  const cached = cache.get(element);
  if (cached !== undefined) return cached;
  const matched = matchesDirectionStyleRule(element);
  cache.set(element, matched);
  return matched;
}

function matchesDirectionStyleRuleList(
  element: HTMLElement,
  rules: CSSRuleList | Iterable<CSSRule>,
): boolean {
  for (const rule of Array.from(rules)) {
    if (isCssStyleRule(rule)) {
      if (!rule.style.direction) {
        const nestedRules = readNestedCssRules(rule);
        if (nestedRules && matchesDirectionStyleRuleList(element, nestedRules)) return true;
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
      isConditionalRuleActive(rule, element) &&
      matchesDirectionStyleRuleList(element, nestedRules)
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

function isConditionalRuleActive(rule: CSSRule, element: HTMLElement): boolean {
  const conditionText = Reflect.get(rule, 'conditionText');
  if (typeof conditionText !== 'string' || !conditionText.trim()) return true;

  if (isContainerRule(rule)) return isContainerQueryActive(conditionText, element, rule);

  if (isMediaRule(rule) && typeof matchMedia === 'function') {
    return matchMedia(conditionText).matches;
  }

  if (isSupportsRule(rule) && typeof CSS !== 'undefined' && typeof CSS.supports === 'function')
    return CSS.supports(conditionText);

  return true;
}

function isContainerQueryActive(
  conditionText: string,
  element: HTMLElement,
  rule: CSSRule,
): boolean {
  if (typeof getComputedStyle !== 'function') return false;
  const styleQuery = /style\(\s*(--[\w-]+)\s*:\s*([^)]+)\)/i.exec(conditionText);
  if (styleQuery) {
    const remainder = (
      conditionText.slice(0, styleQuery.index) +
      conditionText.slice(styleQuery.index + styleQuery[0].length)
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
    let ancestor = element.parentElement;
    while (ancestor) {
      if (typeof containerName === 'string' && containerName) {
        const computedStyle = getComputedStyle(ancestor);
        const name =
          computedStyle.containerName ||
          computedStyle.getPropertyValue('container-name') ||
          ancestor.style.containerName ||
          ancestor.style.getPropertyValue('container-name');
        if (!name.split(/\s+/).includes(containerName)) {
          ancestor = ancestor.parentElement;
          continue;
        }
      }
      const value =
        getComputedStyle(ancestor).getPropertyValue(styleQuery[1]!).trim() ||
        ancestor.style.getPropertyValue(styleQuery[1]!).trim();
      if (value) return value === styleQuery[2]!.trim();
      ancestor = ancestor.parentElement;
    }
    return false;
  }
  const containerName = Reflect.get(rule, 'containerName');
  const queriesPhysicalWidth = /(?:^|[\s(])(?:width|min-width|max-width)\s*[:<>=]/i.test(
    conditionText,
  );
  let container = element.parentElement;
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
    container = container.parentElement;
  }
  if (!container) return false;
  const computedContainerStyle = getComputedStyle(container);
  const readInset = (property: string, fallbackProperty: string): number => {
    const value =
      computedContainerStyle.getPropertyValue(property).trim() ||
      container.style.getPropertyValue(property).trim() ||
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
  const box = container.getBoundingClientRect();
  const borderBoxSize = verticalInlineAxis ? box.height : box.width;
  // A physical `width` query is always a horizontal measurement. Under a
  // vertical writing mode the logical inline insets resolve to top/bottom,
  // not left/right, so a physical query must subtract physical left/right
  // insets instead — falling back to the logical inline name only under a
  // horizontal writing mode, where the two resolve to the same value (some
  // environments only resolve the property name that was actually set).
  const firstInset = verticalInlineAxis
    ? readInset('padding-block-start', 'padding-top') +
      readInset('border-block-start-width', 'border-top-width')
    : usesInlineSize
      ? readInset('padding-inline-start', 'padding-left') +
        readInset('border-inline-start-width', 'border-left-width')
      : readInset('padding-left', isVerticalWritingMode ? 'padding-left' : 'padding-inline-start') +
        readInset(
          'border-left-width',
          isVerticalWritingMode ? 'border-left-width' : 'border-inline-start-width',
        );
  const secondInset = verticalInlineAxis
    ? readInset('padding-block-end', 'padding-bottom') +
      readInset('border-block-end-width', 'border-bottom-width')
    : usesInlineSize
      ? readInset('padding-inline-end', 'padding-right') +
        readInset('border-inline-end-width', 'border-right-width')
      : readInset('padding-right', isVerticalWritingMode ? 'padding-right' : 'padding-inline-end') +
        readInset(
          'border-right-width',
          isVerticalWritingMode ? 'border-right-width' : 'border-inline-end-width',
        );
  const width = Math.max(0, borderBoxSize - firstInset - secondInset);
  const rootFontSize = Number.parseFloat(
    getComputedStyle(element.ownerDocument.documentElement).fontSize,
  );
  const remSize = Number.isFinite(rootFontSize) && rootFontSize > 0 ? rootFontSize : 16;
  const queryUsesPhysicalWidth = /(?:^|[\s(])(?:width|min-width|max-width)\s*[:<>=]/i.test(
    conditionText,
  );
  // This evaluator only understands `px`/`rem` length units. A condition
  // using any other CSS length unit (`em`, `vw`, `%`, ...) cannot be
  // decided here — fail closed instead of silently defaulting to "matches"
  // (an inactive rule at the current size would otherwise be treated as an
  // active styling hint).
  if (hasUnsupportedSizeUnit(conditionText)) return false;
  if (queryUsesPhysicalWidth && /\bor\b/i.test(conditionText)) {
    return conditionText
      .split(/\s+or\s+/i)
      .some((clause) => evaluateContainerSizeCondition(clause, width, remSize));
  }
  const minimum = /min-(?:width|inline-size)\s*:\s*([\d.]+)(px|rem)/i.exec(conditionText);
  const maximum = /max-(?:width|inline-size)\s*:\s*([\d.]+)(px|rem)/i.exec(conditionText);
  const toPixels = (value: RegExpExecArray) =>
    Number(value[1]) * (value[2]!.toLowerCase() === 'rem' ? remSize : 1);
  const matches =
    (!minimum || width >= toPixels(minimum)) && (!maximum || width <= toPixels(maximum));
  const range = /(?:width|inline-size)\s*(>=|>|<=|<)\s*([\d.]+)(px|rem)/i.exec(conditionText);
  if (range) {
    const threshold = Number(range[2]) * (range[3]!.toLowerCase() === 'rem' ? remSize : 1);
    if (range[1] === '>=' && width < threshold) return false;
    if (range[1] === '>' && width <= threshold) return false;
    if (range[1] === '<=' && width > threshold) return false;
    if (range[1] === '<' && width >= threshold) return false;
    return !/^\s*not\b/i.test(conditionText);
  }
  return /^\s*not\b/i.test(conditionText) ? !matches : matches;
}

// True when the condition references a width/inline-size comparison whose
// unit is not `px` or `rem` — the only units this evaluator can resolve to
// pixels. Callers should fail closed rather than guess.
function hasUnsupportedSizeUnit(conditionText: string): boolean {
  const match = /(?:min-|max-)?(?:width|inline-size)\s*(?:>=|>|<=|<|:)\s*[\d.]+([a-z%]+)/i.exec(
    conditionText,
  );
  return match !== null && !/^(?:px|rem)$/i.test(match[1]!);
}

function evaluateContainerSizeCondition(
  conditionText: string,
  width: number,
  remSize: number,
): boolean {
  if (hasUnsupportedSizeUnit(conditionText)) return false;
  const minimum = /min-(?:width|inline-size)\s*:\s*([\d.]+)(px|rem)/i.exec(conditionText);
  const maximum = /max-(?:width|inline-size)\s*:\s*([\d.]+)(px|rem)/i.exec(conditionText);
  const toPixels = (value: RegExpExecArray) =>
    Number(value[1]) * (value[2]!.toLowerCase() === 'rem' ? remSize : 1);
  const matches =
    (!minimum || width >= toPixels(minimum)) && (!maximum || width <= toPixels(maximum));
  const range = /(?:width|inline-size)\s*(>=|>|<=|<)\s*([\d.]+)(px|rem)/i.exec(conditionText);
  if (!range) return /^\s*not\b/i.test(conditionText) ? !matches : matches;
  const threshold = Number(range[2]) * (range[3]!.toLowerCase() === 'rem' ? remSize : 1);
  if (range[1] === '>=' && width < threshold) return false;
  if (range[1] === '>' && width <= threshold) return false;
  if (range[1] === '<=' && width > threshold) return false;
  if (range[1] === '<' && width >= threshold) return false;
  return !/^\s*not\b/i.test(conditionText);
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

export function isRightToLeftElement(element: HTMLElement | null | undefined): boolean {
  return resolveTextDirection(element) === 'rtl';
}

export function observeTextDirection(
  element: HTMLElement | null | undefined,
  onChange: () => void,
): (() => void) | undefined {
  if (!element || typeof MutationObserver === 'undefined') return undefined;
  const observedElement = element;
  const observer = new MutationObserver((mutations) => {
    if (
      mutations.some(
        (mutation) => mutation.type === 'attributes' && mutation.attributeName === 'dir',
      )
    ) {
      observeDirectionChain();
    }
    onChange();
  });

  function observeDirectionChain(): void {
    observer.disconnect();
    let currentElement: HTMLElement | null = observedElement;
    while (currentElement) {
      const isAutoDirection = currentElement.getAttribute('dir')?.toLowerCase() === 'auto';
      // No `attributeFilter`: a selector can key its `direction` styling off
      // any ancestor attribute (e.g. `[data-flow='rtl']`), not just `dir`,
      // `class`, or `style`, so every attribute mutation must be observed to
      // catch a direction change driven by one of those selectors.
      observer.observe(currentElement, {
        attributes: true,
        childList: isAutoDirection,
        characterData: isAutoDirection,
        subtree: isAutoDirection,
      });
      currentElement = currentElement.parentElement;
    }
  }

  observeDirectionChain();
  return () => observer.disconnect();
}
