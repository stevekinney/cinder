import { getShadowHost } from './portal.utilities-events.svelte.ts';
import { observeComputedDirection } from './portal.utilities-observers.svelte.ts';

export function observeInheritedPortalAttributes(
  source: HTMLElement | null | undefined,
  inheritAttributes: boolean,
  syncAttributes: () => void,
): (() => void) | null {
  if (!inheritAttributes || !source) return null;
  const observer =
    typeof MutationObserver === 'undefined' ? null : new MutationObserver(syncAttributes);
  const observedElements: HTMLElement[] = [];
  const observe = (element: HTMLElement) => {
    if (!observer || observedElements.includes(element)) return;
    observedElements.push(element);
    observer.observe(element, {
      attributes: true,
      attributeFilter: ['class', 'style', 'dir', 'lang', 'data-theme', 'data-cinder-theme'],
    });
  };
  const rebindObservedElements = () => {
    const nextElements: HTMLElement[] = [];
    let ancestor: HTMLElement | null = source;
    while (ancestor) {
      nextElements.push(ancestor);
      ancestor = ancestor.parentElement ?? getShadowHost(ancestor);
    }
    if (!nextElements.includes(document.documentElement))
      nextElements.push(document.documentElement);
    if (
      observedElements.length === nextElements.length &&
      observedElements.every((element, index) => element === nextElements[index])
    )
      return;
    observer?.disconnect();
    observedElements.length = 0;
    for (const element of nextElements) observe(element);
  };
  rebindObservedElements();
  const resizeObserver =
    typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(syncAttributes);
  resizeObserver?.observe(source);
  const stopObservingComputedDirection = observeComputedDirection(
    source,
    syncAttributes,
    rebindObservedElements,
  );
  return () => {
    observer?.disconnect();
    resizeObserver?.disconnect();
    stopObservingComputedDirection();
  };
}
