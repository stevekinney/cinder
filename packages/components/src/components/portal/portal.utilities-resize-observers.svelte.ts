export type ResizeObservation = {
  resizeObserver: ResizeObserver | null;
  resizeObservedElements: HTMLElement[];
};

export function collectResizeObservedElements(
  source: HTMLElement,
  getShadowHost: (element: HTMLElement) => HTMLElement | null,
): HTMLElement[] {
  const elements: HTMLElement[] = [];
  let current: HTMLElement | null = source;
  while (current) {
    elements.push(current);
    current = current.parentElement ?? getShadowHost(current);
  }
  return elements;
}

export function rebindResizeObservation(
  observation: ResizeObservation,
  nextElements: HTMLElement[],
  onResize: () => void,
): boolean {
  if (
    observation.resizeObservedElements.length === nextElements.length &&
    observation.resizeObservedElements.every((element, index) => element === nextElements[index])
  )
    return false;
  observation.resizeObserver?.disconnect();
  observation.resizeObserver = null;
  observation.resizeObservedElements = nextElements;
  if (typeof ResizeObserver === 'undefined') return true;
  const resizeObserver = new ResizeObserver(onResize);
  for (const element of nextElements) resizeObserver.observe(element);
  observation.resizeObserver = resizeObserver;
  return true;
}
