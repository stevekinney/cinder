import { composedFocusScopes } from '../../utilities/focus.ts';
import { closestAcrossShadow, getShadowHost } from '../portal/portal.utilities.svelte.ts';

const documentFocusSelector =
  'button:not([disabled]), a[href], area[href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [contenteditable="true"], [tabindex]';

export interface QueuedFocusRestoration {
  invalidate: () => void;
  schedule: (restoreFocus: () => void) => void;
}

export function createQueuedFocusRestoration(
  scheduleMicrotask: (callback: VoidFunction) => void = queueMicrotask,
): QueuedFocusRestoration {
  let generation = 0;

  return {
    invalidate: () => {
      generation += 1;
    },
    schedule: (restoreFocus) => {
      const scheduledGeneration = generation;
      scheduleMicrotask(() => {
        if (scheduledGeneration !== generation) return;
        restoreFocus();
      });
    },
  };
}

export function hasNegativeTabIndex(element: HTMLElement): boolean {
  const tabIndex = element.getAttribute('tabindex');
  return tabIndex !== null && Number(tabIndex) < 0;
}

export function isRenderedCandidate(candidate: HTMLElement): boolean {
  if (typeof window === 'undefined') return true;
  for (
    let current: HTMLElement | null = candidate;
    current;
    current = current.parentElement ?? getShadowHost(current)
  ) {
    const styles = getComputedStyle(current);
    if (styles.display === 'none' || styles.visibility === 'hidden') return false;
  }
  return true;
}

export function getFocusTargetBeforeSpeedDial({
  rootElement,
  actionsElement,
}: {
  rootElement: HTMLDivElement | null;
  actionsElement: HTMLDivElement | null;
}): HTMLElement | null {
  if (!rootElement || typeof document === 'undefined') return null;

  // Search composed focus scopes outward so SpeedDial works inside shadow roots.
  for (const { root, anchor } of composedFocusScopes(rootElement)) {
    const preceding =
      Array.from(root.querySelectorAll<HTMLElement>(documentFocusSelector))
        .filter(
          (candidate) =>
            !hasNegativeTabIndex(candidate) &&
            !candidate.matches(':disabled') &&
            !rootElement.contains(candidate) &&
            !actionsElement?.contains(candidate) &&
            !closestAcrossShadow(candidate, '[hidden], [inert], [aria-hidden="true"]') &&
            isRenderedCandidate(candidate) &&
            Boolean(candidate.compareDocumentPosition(anchor) & Node.DOCUMENT_POSITION_FOLLOWING),
        )
        .at(-1) ?? null;
    if (preceding) return preceding;
  }
  return null;
}
