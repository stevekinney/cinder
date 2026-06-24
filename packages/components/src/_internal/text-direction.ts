export function isRightToLeftElement(element: HTMLElement | null | undefined): boolean {
  let currentElement: HTMLElement | null = element ?? null;
  while (currentElement) {
    const direction = currentElement.getAttribute('dir')?.toLowerCase();
    if (direction === 'rtl') return true;
    if (direction === 'ltr') return false;
    currentElement = currentElement.parentElement;
  }

  return typeof getComputedStyle === 'function' && element
    ? getComputedStyle(element).direction === 'rtl'
    : false;
}
