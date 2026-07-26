const focusCandidateSelector =
  'button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]';

function getSequentialFocusTargets(root: ParentNode | null): HTMLElement[] {
  if (!root) return [];
  return Array.from(root.querySelectorAll<HTMLElement>(focusCandidateSelector)).filter(
    (candidate) =>
      !hasNegativeTabIndex(candidate) &&
      !(candidate instanceof HTMLInputElement && candidate.type === 'hidden') &&
      !candidate.closest('[hidden], [inert], [aria-hidden="true"]'),
  );
}

function hasNegativeTabIndex(element: HTMLElement): boolean {
  const tabIndex = element.getAttribute('tabindex');
  return tabIndex !== null && Number(tabIndex) < 0;
}

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

  const followingCandidates = getSequentialFocusTargets(document).filter(
    (candidate) =>
      !navigationBar.contains(candidate) &&
      !itemsRegion?.contains(candidate) &&
      Boolean(navigationBar.compareDocumentPosition(candidate) & Node.DOCUMENT_POSITION_FOLLOWING),
  );
  if (followingCandidates.length > 0) return followingCandidates[0] ?? null;
  const pageCandidates = getSequentialFocusTargets(document).filter(
    (candidate) => !navigationBar.contains(candidate) && !itemsRegion?.contains(candidate),
  );
  return pageCandidates.at(-1) ?? null;
}
