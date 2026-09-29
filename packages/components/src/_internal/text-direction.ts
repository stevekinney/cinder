import type { TextDirection } from './locale-context.ts';
import { matchesDirectionStyleRuleCached } from './text-direction-css.ts';
export { isContainerRule } from './text-direction-container-runtime.ts';
export { observeTextDirectionMediaQueries } from './text-direction-media.ts';

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
  if (!matchesDirectionStyleRuleCached(element, undefined, composedParentElement)) return undefined;
  return readComputedTextDirection(element);
}

interface DirectionChainResult {
  direction: TextDirection | undefined;
  documentDirection: TextDirection | undefined;
  styledElement: HTMLElement | null;
}

export function resolveTextDirection(
  element: HTMLElement | null | undefined,
  fallback?: TextDirection,
  options?: { ignoreElementDirectionAttribute?: boolean },
): TextDirection | undefined {
  const ignoreElementAttribute = options?.ignoreElementDirectionAttribute ?? false;
  const cache = new WeakMap<HTMLElement, boolean>();
  const ownStyle = ignoreElementAttribute
    ? directionIgnoringOwnAttribute(element, cache)
    : undefined;
  if (ownStyle) return ownStyle;
  const start = ignoreElementAttribute && element ? composedParentElement(element) : element;
  const inherited = resolveDirectionChain(start, cache);
  if (inherited.direction) return inherited.direction;
  const styledDirection = readComputedTextDirection(inherited.styledElement);
  if (styledDirection) return styledDirection;
  return resolveDirectionFallback(
    element,
    fallback,
    ignoreElementAttribute,
    inherited.documentDirection,
    cache,
  );
}

function directionIgnoringOwnAttribute(
  element: HTMLElement | null | undefined,
  cache: WeakMap<HTMLElement, boolean>,
): TextDirection | undefined {
  if (!element) return undefined;
  const styled = readComputedTextDirection(element);
  if (!styled) return undefined;
  const root = readComputedTextDirection(element.ownerDocument.documentElement);
  const attribute = element.getAttribute('dir')?.toLowerCase();
  // A divergent computed value is trustworthy only when it cannot come from
  // the very attribute this caller asked us to ignore.
  const differsThroughStyle = styled !== root && styled !== attribute;
  return hasElementDirectionStylingHint(element, cache) || differsThroughStyle ? styled : undefined;
}

function resolveDirectionChain(
  start: HTMLElement | null | undefined,
  cache: WeakMap<HTMLElement, boolean>,
): DirectionChainResult {
  const result: DirectionChainResult = {
    direction: undefined,
    documentDirection: undefined,
    styledElement: null,
  };
  let current = start;
  while (current) {
    if (!result.styledElement && hasScopedDirectionStyle(current, cache))
      result.styledElement = current;
    const attribute = current.getAttribute('dir')?.toLowerCase();
    result.direction = readAuthoredDirection(current, attribute, result);
    if (result.direction || result.documentDirection) return result;
    if (!result.styledElement && isTextDirection(current.style.direction))
      result.styledElement = current;
    current = composedParentElement(current);
  }
  return result;
}

function hasScopedDirectionStyle(
  element: HTMLElement,
  cache: WeakMap<HTMLElement, boolean>,
): boolean {
  return (
    element !== element.ownerDocument.documentElement &&
    hasElementDirectionStylingHint(element, cache)
  );
}

function readAuthoredDirection(
  element: HTMLElement,
  attribute: string | undefined,
  result: DirectionChainResult,
): TextDirection | undefined {
  if (isTextDirection(attribute)) {
    const styled = readComputedTextDirection(result.styledElement);
    if (styled) return styled;
    if (element === element.ownerDocument.documentElement) {
      result.documentDirection = attribute;
      return undefined;
    }
    return attribute;
  }
  return attribute === 'auto' ? readComputedTextDirection(element) : undefined;
}

function resolveDirectionFallback(
  element: HTMLElement | null | undefined,
  fallback: TextDirection | undefined,
  ignoreElementAttribute: boolean,
  documentDirection: TextDirection | undefined,
  cache: WeakMap<HTMLElement, boolean>,
): TextDirection | undefined {
  const computed = readComputedTextDirection(element);
  const root = readComputedTextDirection(element?.ownerDocument.documentElement);
  if (!ignoreElementAttribute && computed && computed !== root) return computed;
  if (computedOverridesFallback(element, computed, fallback, cache)) return computed;
  if (!fallback && computed === 'rtl') return computed;
  return fallback ?? documentDirection;
}

function computedOverridesFallback(
  element: HTMLElement | null | undefined,
  computed: TextDirection | undefined,
  fallback: TextDirection | undefined,
  cache: WeakMap<HTMLElement, boolean>,
): boolean {
  return Boolean(
    computed && fallback && computed !== fallback && hasDirectionStylingHint(element, false, cache),
  );
}

function isTextDirection(value: string | undefined): value is TextDirection {
  return value === 'rtl' || value === 'ltr';
}

function hasElementDirectionStylingHint(
  element: HTMLElement,
  cache: WeakMap<HTMLElement, boolean>,
): boolean {
  return (
    Boolean(element.style.direction) ||
    matchesDirectionStyleRuleCached(element, cache, composedParentElement)
  );
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
    if (matchesDirectionStyleRuleCached(currentElement, cache, composedParentElement)) return true;
    currentElement = composedParentElement(currentElement);
  }
  return false;
}

export function composedParentElement(element: HTMLElement): HTMLElement | null {
  if (element.parentElement) return element.parentElement;
  const root = element.getRootNode();
  return typeof ShadowRoot !== 'undefined' &&
    typeof HTMLElement !== 'undefined' &&
    root instanceof ShadowRoot &&
    root.host instanceof HTMLElement
    ? root.host
    : null;
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
