import type { TextDirection } from './locale-context.ts';

export function resolveTextDirection(
  element: HTMLElement | null | undefined,
  fallback?: TextDirection,
): TextDirection | undefined {
  let currentElement: HTMLElement | null = element ?? null;
  let documentDirection: TextDirection | undefined;
  while (currentElement) {
    const direction = currentElement.getAttribute('dir')?.toLowerCase();
    if (direction === 'rtl' || direction === 'ltr') {
      if (currentElement === currentElement.ownerDocument.documentElement) {
        documentDirection = direction;
        break;
      }
      return direction;
    }
    if (
      currentElement === element &&
      direction === 'auto' &&
      typeof getComputedStyle === 'function'
    ) {
      const computedDirection = getComputedStyle(currentElement).direction;
      if (computedDirection === 'rtl' || computedDirection === 'ltr') return computedDirection;
    }
    currentElement = currentElement.parentElement;
  }

  if (fallback) return fallback;
  if (documentDirection) return documentDirection;

  if (typeof getComputedStyle === 'function' && element) {
    const direction = getComputedStyle(element).direction;
    if (direction === 'rtl' || direction === 'ltr') return direction;
  }

  return undefined;
}

export function isRightToLeftElement(element: HTMLElement | null | undefined): boolean {
  return resolveTextDirection(element) === 'rtl';
}
