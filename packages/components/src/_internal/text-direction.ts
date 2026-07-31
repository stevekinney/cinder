import type { TextDirection } from './locale-context.ts';

// Returns the direction implied by an inline style or CSS rule targeting
// this exact element — ignoring the element's own `dir` attribute and any
// ancestor entirely (no inheritance walk). For a component that renders its
// own resolved direction as a generated `dir` attribute but takes an
// explicit `direction` prop, this is the right check for "did the consumer
// deliberately override it with CSS on this element" — unlike
// `resolveTextDirection(el, fallback, { ignoreElementDirectionAttribute: true })`,
// which also walks ancestors and would let an ancestor's `dir` attribute
// incorrectly outrank the explicit prop.
export function elementDirectionStyleOverride(
  element: HTMLElement | null | undefined,
): TextDirection | undefined {
  if (!element) return undefined;
  if (element.style.direction) return readComputedTextDirection(element);
  if (!matchesDirectionStyleRuleCached(element)) return undefined;
  return readComputedTextDirection(element);
}

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
    ? element
      ? composedParentElement(element)
      : null
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
    currentElement = composedParentElement(currentElement);
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
  let currentElement = includeElement ? element : element ? composedParentElement(element) : null;
  while (currentElement && currentElement !== currentElement.ownerDocument.documentElement) {
    if (currentElement.style.direction) return true;
    if (matchesDirectionStyleRuleCached(currentElement, cache)) return true;
    currentElement = composedParentElement(currentElement);
  }
  return false;
}

function matchesDirectionStyleRule(element: HTMLElement): boolean {
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
  }
  for (const sheet of styleSheets) {
    if (!isActiveStyleSheet(sheet)) continue;
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
    if (Reflect.get(rule, 'type') === 3) {
      const imported = Reflect.get(rule, 'styleSheet');
      if (imported) {
        try {
          const importedRules = Reflect.get(imported, 'cssRules');
          if (
            isCssRuleCollection(importedRules) &&
            matchesDirectionStyleRuleList(element, importedRules)
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
    let ancestor = composedParentElement(element);
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
      return /^\s*not\b/i.test(conditionText)
        ? value !== styleQuery[2]!.trim()
        : value === styleQuery[2]!.trim();
    }
    return false;
  }
  const containerName = Reflect.get(rule, 'containerName');
  const queriesPhysicalWidth =
    /(?:^|[\s(])(?:width|min-width|max-width)\s*[:<>=]/i.test(conditionText) ||
    /[\d.]+(?:px|rem)\s*(?:<=|<|>=|>)\s*width\b/i.test(conditionText);
  let container = composedParentElement(element);
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
    container = composedParentElement(container);
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
    ? readInset('padding-block-start', 'padding-top') +
      readInset('padding-block-end', 'padding-bottom')
    : physicalInsets;
  const inlineBorders = verticalInlineAxis
    ? readInset('border-block-start-width', 'border-top-width') +
      readInset('border-block-end-width', 'border-bottom-width')
    : physicalBorders;
  const physicalClientSize = container.clientWidth;
  const inlineClientSize = verticalInlineAxis ? container.clientHeight : physicalClientSize;
  const width = Math.max(
    0,
    physicalClientSize > 0
      ? physicalClientSize - physicalInsets
      : container.offsetWidth - physicalBorders - physicalInsets,
  );
  const inlineSize = Math.max(
    0,
    inlineClientSize > 0
      ? inlineClientSize - inlineInsets
      : (verticalInlineAxis ? container.offsetHeight : container.offsetWidth) -
          inlineBorders -
          inlineInsets,
  );
  const rootFontSize = Number.parseFloat(
    getComputedStyle(element.ownerDocument.documentElement).fontSize,
  );
  const remSize = Number.isFinite(rootFontSize) && rootFontSize > 0 ? rootFontSize : 16;
  const queryUsesPhysicalWidth =
    /(?:^|[\s(])(?:width|min-width|max-width)\s*[:<>=]/i.test(conditionText) ||
    /[\d.]+(?:px|rem)\s*(?:<=|<|>=|>)\s*width\b/i.test(conditionText);
  // This evaluator only understands `px`/`rem` length units and the
  // width/inline-size features. A condition using any other CSS length unit
  // (`em`, `vw`, `%`, ...), or a size feature it doesn't implement (`height`,
  // `block-size`, `aspect-ratio`, `orientation`, ...), cannot be decided here
  // — fail closed instead of silently defaulting to "matches" (an inactive
  // rule at the current size would otherwise be treated as an active
  // styling hint).
  if (hasUnsupportedContainerSizeQuery(conditionText)) return false;
  if ((queryUsesPhysicalWidth || usesInlineSize) && /\bor\b/i.test(conditionText)) {
    return conditionText
      .split(/\s+or\s+/i)
      .some((clause) => evaluateContainerSizeCondition(clause, width, remSize, inlineSize));
  }
  return evaluateContainerSizeConstraints(conditionText, width, remSize, inlineSize);
}

function composedParentElement(element: HTMLElement): HTMLElement | null {
  if (element.parentElement) return element.parentElement;
  const root = element.getRootNode();
  return typeof ShadowRoot !== 'undefined' &&
    typeof HTMLElement !== 'undefined' &&
    root instanceof ShadowRoot &&
    root.host instanceof HTMLElement
    ? root.host
    : null;
}

// True when the condition references a width/inline-size comparison whose
// unit is not `px` or `rem` — the only units this evaluator can resolve to
// pixels — or references a size feature this evaluator doesn't implement at
// all (`height`, `block-size`, `aspect-ratio`, `orientation`, ...). Callers
// should fail closed rather than guess.
function hasUnsupportedContainerSizeQuery(conditionText: string): boolean {
  if (/(?:min-|max-)?(?:height|block-size)\b/i.test(conditionText)) return true;
  if (/\baspect-ratio\b/i.test(conditionText)) return true;
  if (/\borientation\s*:/i.test(conditionText)) return true;
  const unitMatches = conditionText.matchAll(
    /(?:min-|max-)?(?:width|inline-size)\s*(?:>=|>|<=|<|:)\s*[\d.]+([a-z%]+)/gi,
  );
  return [...unitMatches].some((match) => !/^(?:px|rem)$/i.test(match[1]!));
}

// A conjunctive range condition — e.g. `(width >= 20rem) and (width <= 40rem)`
// — has more than one range comparison to satisfy. Evaluate every one
// (`matchAll`, not a single `exec()`) and require all of them to hold.
// Returns undefined when the condition contains no range comparison at all.
function evaluateRangeComparisons(
  conditionText: string,
  width: number,
  remSize: number,
): boolean | undefined {
  const featureFirstPattern = /(?:width|inline-size)\s*(>=|>|<=|<)\s*([\d.]+)(px|rem)/gi;
  const valueFirstPattern = /([\d.]+)(px|rem)\s*(<=|<|>=|>)\s*(width|inline-size)/gi;
  const comparisons: { operator: string; threshold: string; unit: string }[] = [];
  for (const comparison of conditionText.matchAll(featureFirstPattern)) {
    const operator = comparison[1];
    const threshold = comparison[2];
    const unit = comparison[3];
    if (operator && threshold && unit) comparisons.push({ operator, threshold, unit });
  }
  for (const comparison of conditionText.matchAll(valueFirstPattern)) {
    const threshold = comparison[1];
    const unit = comparison[2];
    const operator =
      comparison[3] === '<='
        ? '>='
        : comparison[3] === '<'
          ? '>'
          : comparison[3] === '>='
            ? '<='
            : '<';
    if (threshold && unit) comparisons.push({ operator, threshold, unit });
  }
  if (comparisons.length === 0) return undefined;
  const satisfiesAll = comparisons.every((comparison) => {
    const { operator } = comparison;
    const threshold =
      Number(comparison.threshold) * (comparison.unit.toLowerCase() === 'rem' ? remSize : 1);
    if (operator === '>=') return width >= threshold;
    if (operator === '>') return width > threshold;
    if (operator === '<=') return width <= threshold;
    return width < threshold;
  });
  return satisfiesAll;
}

// The equality form — e.g. `(width: 20rem)` — has no `min-`/`max-` prefix
// and no comparison operator, so neither `minimum`/`maximum` nor
// evaluateRangeComparisons() recognizes it; without this, `matches`
// silently defaults to true regardless of the container's actual size.
// Returns undefined when the condition contains no bare equality term.
function evaluateEqualityComparison(
  conditionText: string,
  width: number,
  remSize: number,
): boolean | undefined {
  const equalityPattern = /(?:^|[\s(])(?:width|inline-size)\s*:\s*([\d.]+)(px|rem)/gi;
  const comparisons = [...conditionText.matchAll(equalityPattern)];
  if (comparisons.length === 0) return undefined;
  const satisfiesAll = comparisons.every((comparison) => {
    const threshold =
      Number(comparison[1]) * (comparison[2]!.toLowerCase() === 'rem' ? remSize : 1);
    return width === threshold;
  });
  return satisfiesAll;
}

function evaluateContainerSizeConstraints(
  conditionText: string,
  width: number,
  remSize: number,
  inlineSize = width,
): boolean {
  const measuredSize =
    /\binline-size\b/i.test(conditionText) && !/\bwidth\b/i.test(conditionText)
      ? inlineSize
      : width;
  if (
    /\bwidth\b/i.test(conditionText) &&
    /\binline-size\b/i.test(conditionText) &&
    /\band\b/i.test(conditionText)
  ) {
    return conditionText
      .split(/\s+and\s+/i)
      .every((clause) =>
        evaluateContainerSizeConstraints(
          clause,
          /\binline-size\b/i.test(clause) ? inlineSize : width,
          remSize,
          inlineSize,
        ),
      );
  }
  const minimum = /min-(?:width|inline-size)\s*:\s*([\d.]+)(px|rem)/i.exec(conditionText);
  const maximum = /max-(?:width|inline-size)\s*:\s*([\d.]+)(px|rem)/i.exec(conditionText);
  const toPixels = (value: RegExpExecArray) =>
    Number(value[1]) * (value[2]!.toLowerCase() === 'rem' ? remSize : 1);
  const legacyMatches =
    (!minimum || measuredSize >= toPixels(minimum)) &&
    (!maximum || measuredSize <= toPixels(maximum));
  const rangeMatches = evaluateRangeComparisons(conditionText, measuredSize, remSize) ?? true;
  const equalityMatches = evaluateEqualityComparison(conditionText, measuredSize, remSize) ?? true;
  const hasSizeFeature = /\b(?:width|inline-size)\b/i.test(conditionText);
  const hasRecognizedRange =
    /(?:width|inline-size)\s*(?:>=|>|<=|<)\s*[\d.]+(?:px|rem)/i.test(conditionText) ||
    /[\d.]+(?:px|rem)\s*(?:<=|<|>=|>)\s*(?:width|inline-size)/i.test(conditionText);
  const hasRecognizedEquality = /(?:width|inline-size)\s*:\s*[\d.]+(?:px|rem)/i.test(conditionText);
  if (hasSizeFeature && !minimum && !maximum && !hasRecognizedRange && !hasRecognizedEquality)
    return false;
  const combinedMatches = legacyMatches && rangeMatches && equalityMatches;
  return /^\s*not\b/i.test(conditionText) ? !combinedMatches : combinedMatches;
}

function evaluateContainerSizeCondition(
  conditionText: string,
  width: number,
  remSize: number,
  inlineSize = width,
): boolean {
  if (hasUnsupportedContainerSizeQuery(conditionText)) return false;
  return evaluateContainerSizeConstraints(conditionText, width, remSize, inlineSize);
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
        (mutation) =>
          (mutation.type === 'attributes' && mutation.attributeName === 'dir') ||
          mutation.type === 'childList',
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
        childList: true,
        characterData: isAutoDirection,
        subtree: isAutoDirection,
      });
      currentElement = composedParentElement(currentElement);
    }
  }

  observeDirectionChain();
  return () => observer.disconnect();
}
