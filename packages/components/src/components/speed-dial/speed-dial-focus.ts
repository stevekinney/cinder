import {
  composedContains,
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
  focusedAction = null,
}: {
  rootElement: HTMLDivElement | null;
  actionsElement: HTMLDivElement | null;
  /**
   * The action the consumer is reverse-Tabbing from. Anchors tab-tier
   * filtering: the SpeedDial root is a zero/default-tier DOM anchor, so
   * without this, a positive-tabindex first action would incorrectly fall
   * through to a zero/default-tier preceding candidate instead of the
   * nearest lower-or-equal positive-tabindex one that native Shift+Tab
   * would actually visit next.
   */
  focusedAction?: HTMLElement | null;
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
        tierReference: focusedAction ?? anchor,
      })
        // `Element.contains()` only walks the light DOM, so a focusable
        // control inside the *open shadow root* of a light-DOM descendant of
        // `rootElement`/`actionsElement` would otherwise read as "not
        // contained" and get offered as a preceding page control even
        // though it is still part of the SpeedDial's own composed subtree.
        .filter(
          (candidate) =>
            !composedContains(rootElement, candidate) &&
            (!actionsElement || !composedContains(actionsElement, candidate)),
        )
        .at(-1) ?? null;
    if (preceding) return preceding;
  }
  return null;
}
