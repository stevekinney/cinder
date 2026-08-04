import { composedFocusScopes, getSequentialFocusTargets } from '../../utilities/focus.ts';

export function getNavigationBarBrandFocusTargets(
  navigationBar: HTMLElement | null,
): HTMLElement[] {
  return getSequentialFocusTargets(
    navigationBar?.querySelector('.cinder-navigation-bar__brand') ?? null,
  );
}

export function findFocusTargetBeforeNavigationItems(
  navigationBar: HTMLElement | null,
  toggle: HTMLElement | null,
  brandComesBeforeItems: boolean,
): HTMLElement | null {
  if (brandComesBeforeItems) {
    const brandTarget = getNavigationBarBrandFocusTargets(navigationBar).at(-1);
    if (brandTarget) return brandTarget;
  }

  return (
    toggle ??
    getSequentialFocusTargets(
      navigationBar?.querySelector('.cinder-navigation-bar__menu-toggle') ?? null,
    )[0] ??
    null
  );
}

export function findFocusTargetAfterNavigationItems(
  navigationBar: HTMLElement | null,
  itemsRegion: HTMLElement | null,
): HTMLElement | null {
  const actionTarget = getSequentialFocusTargets(
    navigationBar?.querySelector('.cinder-navigation-bar__actions') ?? null,
  )[0];
  if (actionTarget) return actionTarget;
  if (!navigationBar || typeof document === 'undefined') return null;

  // Search the composed focus scope outward: the navigation bar's own root
  // (its ShadowRoot, if it is rendered inside one) first, then each
  // enclosing shadow host's root in turn, until a following candidate is
  // found or the top-level document is exhausted. A plain `document.
  // querySelectorAll` cannot see into shadow roots, so a NavigationBar
  // rendered inside one with no `actions` target would otherwise skip every
  // sibling that lives in that same shadow root.
  for (const { root, anchor } of composedFocusScopes(navigationBar)) {
    const followingCandidates = getSequentialFocusTargets(root, {
      relativeTo: anchor,
      direction: 'after',
    }).filter(
      (candidate) => !navigationBar.contains(candidate) && !itemsRegion?.contains(candidate),
    );
    if (followingCandidates.length > 0) return followingCandidates[0] ?? null;
  }
  return null;
}
