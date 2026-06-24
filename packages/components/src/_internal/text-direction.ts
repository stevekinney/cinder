import type { TextDirection } from './locale-context.ts';

export function resolveTextDirection(
  element: HTMLElement | null | undefined,
  fallback?: TextDirection,
): TextDirection | undefined {
  let currentElement: HTMLElement | null = element ?? null;
  while (currentElement) {
    const direction = currentElement.getAttribute('dir')?.toLowerCase();
    if (direction === 'rtl' || direction === 'ltr') return direction;
    currentElement = currentElement.parentElement;
  }

  if (fallback) return fallback;

  if (typeof getComputedStyle === 'function' && element) {
    const direction = getComputedStyle(element).direction;
    if (direction === 'rtl' || direction === 'ltr') return direction;
  }

  return undefined;
}

export function isRightToLeftElement(element: HTMLElement | null | undefined): boolean {
  return resolveTextDirection(element) === 'rtl';
}
