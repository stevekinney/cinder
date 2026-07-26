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
    if (
      styledDirection &&
      (hasElementDirectionStylingHint(element, directionStyleRuleCache) ||
        styledDirection !== rootComputedDirection)
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
  const styleQuery = /style\(\s*(--[\w-]+)\s*:\s*([^)]+)\)/i.exec(conditionText);
  if (styleQuery) {
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
    if (
      (typeof containerName !== 'string' ||
        !containerName ||
        name.split(/\s+/).includes(containerName)) &&
      type &&
      type !== 'normal'
    ) {
      break;
    }
    container = container.parentElement;
  }
  if (!container) return false;
  const width = container.getBoundingClientRect().width;
  const minimum = /min-width\s*:\s*([\d.]+)(px|rem)/i.exec(conditionText);
  const maximum = /max-width\s*:\s*([\d.]+)(px|rem)/i.exec(conditionText);
  const rootFontSize = Number.parseFloat(
    getComputedStyle(element.ownerDocument.documentElement).fontSize,
  );
  const remSize = Number.isFinite(rootFontSize) && rootFontSize > 0 ? rootFontSize : 16;
  const toPixels = (value: RegExpExecArray) =>
    Number(value[1]) * (value[2]!.toLowerCase() === 'rem' ? remSize : 1);
  const matches =
    (!minimum || width >= toPixels(minimum)) && (!maximum || width <= toPixels(maximum));
  const range = /width\s*(>=|>|<=|<)\s*([\d.]+)(px|rem)/i.exec(conditionText);
  if (range) {
    const threshold = Number(range[2]) * (range[3]!.toLowerCase() === 'rem' ? remSize : 1);
    if (range[1] === '>=' && width < threshold) return false;
    if (range[1] === '>' && width <= threshold) return false;
    if (range[1] === '<=' && width > threshold) return false;
    if (range[1] === '<' && width >= threshold) return false;
    return /^\s*not\b/i.test(conditionText) ? false : true;
  }
  return /^\s*not\b/i.test(conditionText) ? !matches : matches;
}

function isContainerRule(rule: CSSRule): boolean {
  return rule.constructor.name === 'CSSContainerRule' || Reflect.get(rule, 'type') === 0;
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
      observer.observe(currentElement, {
        attributes: true,
        attributeFilter: ['dir', 'style', 'class'],
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
