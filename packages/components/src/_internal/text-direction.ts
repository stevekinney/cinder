import type { TextDirection } from './locale-context.ts';

export function resolveTextDirection(
  element: HTMLElement | null | undefined,
  fallback?: TextDirection,
): TextDirection | undefined {
  let currentElement: HTMLElement | null = element ?? null;
  let documentDirection: TextDirection | undefined;
  let styledDirectionElement: HTMLElement | null = null;
  while (currentElement) {
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
  if (computedDirection && computedDirection !== rootComputedDirection) return computedDirection;
  if (
    computedDirection &&
    fallback &&
    computedDirection !== fallback &&
    hasDirectionStylingHint(element)
  ) {
    return computedDirection;
  }
  if (!fallback && computedDirection === 'rtl') return computedDirection;

  if (fallback) return fallback;
  if (documentDirection) return documentDirection;

  return undefined;
}

function readComputedTextDirection(
  element: HTMLElement | null | undefined,
): TextDirection | undefined {
  if (!element || typeof getComputedStyle !== 'function') return undefined;
  const direction = getComputedStyle(element).direction;
  return direction === 'rtl' || direction === 'ltr' ? direction : undefined;
}

function hasDirectionStylingHint(element: HTMLElement | null | undefined): boolean {
  let currentElement = element?.parentElement;
  while (currentElement && currentElement !== currentElement.ownerDocument.documentElement) {
    if (currentElement.style.direction) return true;
    if (
      typeof currentElement.className === 'string' &&
      currentElement.className.split(/\s+/).some((className) => {
        return className && !className.startsWith('cinder-');
      })
    ) {
      return true;
    }
    currentElement = currentElement.parentElement;
  }
  return false;
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
