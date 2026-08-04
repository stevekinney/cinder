import type { TextDirection } from './locale-context.ts';
import { matchesDirectionStyleRuleCached } from './text-direction-css.ts';
export { isContainerRule, observeTextDirectionMediaQueries } from './text-direction-css.ts';

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
      (Boolean(currentElement.style.direction) ||
        matchesDirectionStyleRuleCached(
          currentElement,
          directionStyleRuleCache,
          composedParentElement,
        ))
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
