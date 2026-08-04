import {
  composedFocusScopes,
  getSequentialFocusTargets,
  getTabIndexValue,
  type SequentialFocusTarget,
} from '../../utilities/focus.ts';
import { getShadowHost } from '../portal/portal.utilities.svelte.ts';

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
  return getTabIndexValue(element) < 0;
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
}): SequentialFocusTarget | null {
  if (!rootElement || typeof document === 'undefined') return null;

  // Search the composed focus scope outward: the SpeedDial's own root (its
  // ShadowRoot, if it is rendered inside one) first, then each enclosing
  // shadow host's root in turn. A plain `document.querySelectorAll` cannot
  // see into shadow roots, so a SpeedDial rendered inside one would
  // otherwise skip a preceding sibling that lives in that same shadow root.
  for (const { root, anchor } of composedFocusScopes(rootElement)) {
    const preceding =
      getSequentialFocusTargets(root, {
        relativeTo: anchor,
        direction: 'before',
      })
        .filter(
          (candidate) => !rootElement.contains(candidate) && !actionsElement?.contains(candidate),
        )
        .at(-1) ?? null;
    if (preceding) return preceding;
  }
  return null;
}
