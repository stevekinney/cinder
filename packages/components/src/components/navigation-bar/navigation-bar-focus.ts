import {
  composedContains,
  composedFocusScopes,
  getSequentialFocusTargets,
  getTabIndexValue,
  type SequentialFocusTarget,
} from '../../utilities/focus.ts';

export function getNavigationBarBrandFocusTargets(
  navigationBar: HTMLElement | null,
): SequentialFocusTarget[] {
  return getSequentialFocusTargets(
    navigationBar?.querySelector('.cinder-navigation-bar__brand') ?? null,
  );
}

/**
 * The first brand focus target that native sequential order would reach
 * after `toggle`. The brand's own focus-target list is sorted globally
 * (every positive-tabindex target first, then zero/default targets), so
 * its `[0]` is only "the first stop after the toggle" when the toggle
 * itself is the very start of the sequence. When the toggle is a
 * zero/default-tabindex control, any positive-tabindex brand target has
 * already been visited earlier in the page's native tab sequence (before
 * the toggle), so it must be skipped in favor of the first zero/default
 * brand target instead.
 */
export function findFirstBrandFocusTargetAfterToggle(
  navigationBar: HTMLElement | null,
  toggle: HTMLElement | null,
): SequentialFocusTarget | null {
  if (!navigationBar || !toggle) return null;
  const brand = navigationBar.querySelector('.cinder-navigation-bar__brand');
  if (!brand) return null;

  return (
    getSequentialFocusTargets(navigationBar, { relativeTo: toggle, direction: 'after' }).find(
      (candidate) => composedContains(brand, candidate),
    ) ?? null
  );
}

export function findFocusTargetBeforeNavigationItems(
  navigationBar: HTMLElement | null,
  toggle: HTMLElement | null,
  brandComesBeforeItems: boolean,
  navigationItem: HTMLElement | null = null,
): SequentialFocusTarget | null {
  if (brandComesBeforeItems) {
    const brandTargets = getNavigationBarBrandFocusTargets(navigationBar);
    // Brand focus targets are sorted globally (positive tabindex first), so
    // `.at(-1)` alone only means "the last stop before the items" when the
    // focused item itself is zero/default-tier. A positive-tabindex item has
    // already passed every lower-or-equal positive brand target in native
    // order, so reverse Tab from it must land on the nearest one of those,
    // not fall straight to a zero/default-tier brand target.
    const referenceTabIndex = Math.max(0, navigationItem ? getTabIndexValue(navigationItem) : 0);
    const brandTarget =
      (navigationItem && referenceTabIndex > 0
        ? [...brandTargets].reverse().find((candidate) => {
            const candidateTabIndex = getTabIndexValue(candidate);
            return candidateTabIndex > 0 && candidateTabIndex <= referenceTabIndex;
          })
        : undefined) ?? brandTargets.at(-1);
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
  navigationItem: HTMLElement | null = null,
): SequentialFocusTarget | null {
  const actionTargets = getSequentialFocusTargets(
    navigationBar?.querySelector('.cinder-navigation-bar__actions') ?? null,
  );
  const referenceTabIndex = Math.max(0, navigationItem ? getTabIndexValue(navigationItem) : 0);
  const actionTarget =
    (navigationItem && referenceTabIndex > 0
      ? actionTargets.find((candidate) => getTabIndexValue(candidate) >= referenceTabIndex)
      : undefined) ?? actionTargets.find((candidate) => getTabIndexValue(candidate) === 0);
  if (actionTarget) return actionTarget;
  if (!navigationBar || typeof document === 'undefined') return null;

  // Search the composed focus scope outward: the navigation bar's own root
  // (its ShadowRoot, if it is rendered inside one) first, then each
  // enclosing shadow host's root in turn, until a following candidate is
  // found or the top-level document is exhausted. A plain `document.
  // querySelectorAll` cannot see into shadow roots, so a NavigationBar
  // rendered inside one with no `actions` target would otherwise skip every
  // sibling that lives in that same shadow root.
  //
  // The DOM-position anchor at each scope is the navigation bar (or its
  // enclosing shadow host), which is rarely itself a positive-tabindex tab
  // stop. Tier filtering must key off `navigationItem`'s own tab index
  // instead, or a positive-tabindex last item would incorrectly drop every
  // positive-tabindex candidate that native Tab order still owes it.
  for (const { root, anchor } of composedFocusScopes(navigationBar)) {
    const followingCandidates = getSequentialFocusTargets(root, {
      relativeTo: anchor,
      direction: 'after',
      tierReference: navigationItem ?? anchor,
    }).filter(
      (candidate) =>
        !composedContains(navigationBar, candidate) &&
        (!itemsRegion || !composedContains(itemsRegion, candidate)),
    );
    if (followingCandidates.length > 0) return followingCandidates[0] ?? null;
  }
  return null;
}
