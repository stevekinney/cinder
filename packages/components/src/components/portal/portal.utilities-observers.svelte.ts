import { resetDirectionStyleSheetIndex } from '../../_internal/text-direction-sheet-index.ts';
import {
  clearMediaQueryObservers,
  refreshMediaQueryObservers,
} from './portal.utilities-media-observers.svelte.ts';
import {
  collectResizeObservedElements,
  rebindResizeObservation,
} from './portal.utilities-resize-observers.svelte.ts';

function getShadowHost(element: HTMLElement): HTMLElement | null {
  const root = element.getRootNode();
  return root instanceof ShadowRoot && root.host instanceof HTMLElement ? root.host : null;
}
type ComputedDirectionObservation = {
  source: HTMLElement;
  direction: string;
  sync: () => void;
  rebindInheritedAttributes: () => void;
  roots: ShadowRoot[];
  resizeObserver: ResizeObserver | null;
  resizeObservedElements: HTMLElement[];
};

const computedDirectionObservations = new Set<ComputedDirectionObservation>();
const directionInvalidationRoots = new Map<
  ShadowRoot,
  { observer: MutationObserver | null; count: number }
>();
const directionInvalidationEvents = [
  'focusin',
  'focusout',
  'pointerover',
  'pointerout',
  'input',
  'change',
  'toggle',
  'pointerdown',
  'pointerup',
  'pointercancel',
  'keydown',
  'keyup',
] as const;
let directionInvalidationObserver: MutationObserver | null = null;
let directionInvalidationFrame: number | null = null;
let directionInvalidationDocument: Document | null = null;
let directionInvalidationStarted = false;
function invalidateComputedDirections() {
  if (directionInvalidationFrame !== null || typeof window === 'undefined') return;
  if (typeof window.requestAnimationFrame !== 'function') {
    syncComputedDirections();
    return;
  }
  directionInvalidationFrame = window.requestAnimationFrame(() => {
    directionInvalidationFrame = null;
    syncComputedDirections();
  });
}
export function invalidatePortalDirection() {
  resetDirectionStyleSheetIndex();
  if (computedDirectionObservations.size === 0) return;
  refreshMediaQueryObservers(computedDirectionObservations, invalidateComputedDirections);
  invalidateComputedDirections();
}
function syncComputedDirections() {
  const topologyChanges = new Set<ComputedDirectionObservation>();
  for (const current of computedDirectionObservations) {
    if (!rebindComputedDirectionObservation(current)) continue;
    topologyChanges.add(current);
    current.rebindInheritedAttributes();
  }
  if (topologyChanges.size > 0)
    refreshMediaQueryObservers(computedDirectionObservations, invalidateComputedDirections);
  if (typeof getComputedStyle !== 'function') return;
  for (const current of computedDirectionObservations) {
    const direction = getComputedStyle(current.source).direction;
    if (direction === current.direction && !topologyChanges.has(current)) continue;
    current.direction = direction;
    current.sync();
  }
}
function startDirectionInvalidationObservers() {
  if (directionInvalidationStarted || typeof document === 'undefined') return;
  directionInvalidationStarted = true;
  directionInvalidationDocument = document;
  directionInvalidationObserver =
    typeof MutationObserver === 'undefined'
      ? null
      : new MutationObserver((mutations) => {
          if (mutations.some(isStylesheetMutation)) {
            refreshMediaQueryObservers(computedDirectionObservations, invalidateComputedDirections);
          }
          invalidateComputedDirections();
        });
  directionInvalidationObserver?.observe(document.documentElement, {
    attributes: true,
    characterData: true,
    childList: true,
    subtree: true,
  });
  document.addEventListener('load', handleStylesheetLoad, true);
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('resize', invalidateComputedDirections);
    window.addEventListener('orientationchange', invalidateComputedDirections);
    window.addEventListener('hashchange', invalidateComputedDirections);
    for (const event of directionInvalidationEvents) {
      document.addEventListener(event, invalidateComputedDirections, true);
    }
  }
  refreshMediaQueryObservers(computedDirectionObservations, invalidateComputedDirections);
}
function isStylesheetMutation(mutation: MutationRecord): boolean {
  if (mutation.type === 'attributes') {
    return (
      (mutation.target instanceof HTMLStyleElement || isStylesheetLink(mutation.target)) &&
      (mutation.attributeName === 'media' || mutation.attributeName === 'disabled')
    );
  }
  if (mutation.type === 'characterData') {
    return mutation.target.parentElement instanceof HTMLStyleElement;
  }
  if (mutation.type !== 'childList') return false;
  if (mutation.target instanceof HTMLStyleElement) return true;
  return [...mutation.addedNodes, ...mutation.removedNodes].some(containsStylesheetNode);
}
function containsStylesheetNode(node: Node): boolean {
  if (node instanceof HTMLStyleElement || isStylesheetLink(node)) return true;
  if (!(node instanceof Element || node instanceof DocumentFragment)) return false;
  return (
    node.querySelector('style') !== null ||
    [...node.querySelectorAll('link')].some(isStylesheetLink)
  );
}
function isStylesheetLink(node: Node): node is HTMLLinkElement {
  return (
    node instanceof HTMLLinkElement &&
    node.rel.split(/\s+/).some((relationship) => relationship.toLowerCase() === 'stylesheet')
  );
}
function observeDirectionShadowRoots(source: HTMLElement) {
  const roots: ShadowRoot[] = [];
  let current: HTMLElement | null = source;
  while (current) {
    const root = current.getRootNode();
    if (root instanceof ShadowRoot) {
      roots.push(root);
      const existing = directionInvalidationRoots.get(root);
      if (existing) existing.count += 1;
      else {
        const observer =
          typeof MutationObserver === 'undefined'
            ? null
            : new MutationObserver((mutations) => {
                if (mutations.some(isStylesheetMutation))
                  refreshMediaQueryObservers(
                    computedDirectionObservations,
                    invalidateComputedDirections,
                  );
                invalidateComputedDirections();
              });
        observer?.observe(root, {
          attributes: true,
          characterData: true,
          childList: true,
          subtree: true,
        });
        root.addEventListener('load', handleStylesheetLoad, true);
        for (const event of directionInvalidationEvents) {
          root.addEventListener(event, invalidateComputedDirections, true);
        }
        directionInvalidationRoots.set(root, { observer, count: 1 });
      }
    }
    current = getShadowHost(current);
  }
  return roots;
}
function releaseDirectionShadowRoot(root: ShadowRoot) {
  const existing = directionInvalidationRoots.get(root);
  if (!existing) return;
  existing.count -= 1;
  if (existing.count > 0) return;
  existing.observer?.disconnect();
  root.removeEventListener('load', handleStylesheetLoad, true);
  for (const event of directionInvalidationEvents) {
    root.removeEventListener(event, invalidateComputedDirections, true);
  }
  directionInvalidationRoots.delete(root);
}
function stopDirectionInvalidationObservers() {
  if (computedDirectionObservations.size > 0) return;
  directionInvalidationStarted = false;
  directionInvalidationObserver?.disconnect();
  directionInvalidationObserver = null;
  removeDirectionInvalidationListeners();
  clearMediaQueryObservers(invalidateComputedDirections);
  disconnectDirectionShadowRoots();
  directionInvalidationRoots.clear();
  if (directionInvalidationFrame !== null) {
    if (typeof window !== 'undefined') window.cancelAnimationFrame(directionInvalidationFrame);
    directionInvalidationFrame = null;
  }
  directionInvalidationDocument = null;
}

function removeDirectionInvalidationListeners(): void {
  directionInvalidationDocument?.removeEventListener('load', handleStylesheetLoad, true);
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', invalidateComputedDirections);
    window.removeEventListener('orientationchange', invalidateComputedDirections);
    window.removeEventListener('hashchange', invalidateComputedDirections);
  }
  for (const event of directionInvalidationEvents) {
    directionInvalidationDocument?.removeEventListener(event, invalidateComputedDirections, true);
  }
}

function disconnectDirectionShadowRoots(): void {
  for (const [root, { observer }] of directionInvalidationRoots) {
    observer?.disconnect();
    root.removeEventListener('load', handleStylesheetLoad, true);
    for (const event of directionInvalidationEvents)
      root.removeEventListener(event, invalidateComputedDirections, true);
  }
}

function handleStylesheetLoad(event: Event) {
  const target = event.target;
  if (target instanceof HTMLStyleElement || (target instanceof Node && isStylesheetLink(target))) {
    refreshMediaQueryObservers(computedDirectionObservations, invalidateComputedDirections);
    invalidateComputedDirections();
  }
}

export function observeComputedDirection(
  source: HTMLElement,
  sync: () => void,
  rebindInheritedAttributes: () => void,
): () => void {
  if (
    typeof getComputedStyle !== 'function' ||
    typeof window === 'undefined' ||
    typeof document === 'undefined'
  ) {
    return () => {};
  }
  const observation: ComputedDirectionObservation = {
    source,
    direction: getComputedStyle(source).direction,
    sync,
    rebindInheritedAttributes,
    roots: [],
    resizeObserver: null,
    resizeObservedElements: [],
  };
  computedDirectionObservations.add(observation);
  startDirectionInvalidationObservers();
  observation.roots = observeDirectionShadowRoots(source);
  refreshMediaQueryObservers(computedDirectionObservations, invalidateComputedDirections);
  rebindResizeObservation(
    observation,
    collectResizeObservedElements(source, getShadowHost),
    invalidateComputedDirections,
  );

  return () => {
    computedDirectionObservations.delete(observation);
    observation.resizeObserver?.disconnect();
    for (const root of observation.roots) releaseDirectionShadowRoot(root);
    if (computedDirectionObservations.size === 0) {
      stopDirectionInvalidationObservers();
    } else {
      refreshMediaQueryObservers(computedDirectionObservations, invalidateComputedDirections);
    }
  };
}

function collectDirectionShadowRoots(source: HTMLElement): ShadowRoot[] {
  const roots: ShadowRoot[] = [];
  let current: HTMLElement | null = source;
  while (current) {
    const root = current.getRootNode();
    if (root instanceof ShadowRoot && !roots.includes(root)) roots.push(root);
    current = getShadowHost(current);
  }
  return roots;
}

function rebindComputedDirectionObservation(observation: ComputedDirectionObservation): boolean {
  const nextRoots = collectDirectionShadowRoots(observation.source);
  const rootsChanged =
    nextRoots.length !== observation.roots.length ||
    nextRoots.some((root, index) => root !== observation.roots[index]);
  if (rootsChanged) {
    for (const root of observation.roots) releaseDirectionShadowRoot(root);
    observation.roots = observeDirectionShadowRoots(observation.source);
  }
  const resizeChanged = rebindResizeObservation(
    observation,
    collectResizeObservedElements(observation.source, getShadowHost),
    invalidateComputedDirections,
  );
  return rootsChanged || resizeChanged;
}
