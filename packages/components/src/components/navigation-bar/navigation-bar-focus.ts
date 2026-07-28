import { composedFocusScopes } from '../../utilities/focus.ts';
import { closestAcrossShadow, getShadowHost } from '../portal/portal.utilities.svelte.ts';

const focusCandidateSelector =
  'button:not([disabled]), a[href], area[href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [contenteditable="true"], [tabindex]';

function getSequentialFocusTargets(root: ParentNode | null): HTMLElement[] {
  if (!root) return [];
  return Array.from(root.querySelectorAll<HTMLElement>(focusCandidateSelector)).filter(
    (candidate) =>
      !hasNegativeTabIndex(candidate) &&
      !candidate.matches(':disabled') &&
      !(candidate instanceof HTMLInputElement && candidate.type === 'hidden') &&
      !closestAcrossShadow(candidate, '[hidden], [inert], [aria-hidden="true"]') &&
      isRendered(candidate),
  );
}

function isRendered(element: HTMLElement): boolean {
  if (typeof getComputedStyle !== 'function') return true;
  let candidate: HTMLElement | null = element;
  while (candidate) {
    const style = getComputedStyle(candidate);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    candidate = candidate.parentElement ?? getShadowHost(candidate);
  }
  return true;
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

  // Search the composed focus scope outward: the navigation bar's own root
  // (its ShadowRoot, if it is rendered inside one) first, then each
  // enclosing shadow host's root in turn, until a following candidate is
  // found or the top-level document is exhausted. A plain `document.
  // querySelectorAll` cannot see into shadow roots, so a NavigationBar
  // rendered inside one with no `actions` target would otherwise skip every
  // sibling that lives in that same shadow root.
  for (const { root, anchor } of composedFocusScopes(navigationBar)) {
    const followingCandidates = getSequentialFocusTargets(root).filter(
      (candidate) =>
        !navigationBar.contains(candidate) &&
        !itemsRegion?.contains(candidate) &&
        Boolean(anchor.compareDocumentPosition(candidate) & Node.DOCUMENT_POSITION_FOLLOWING),
    );
    if (followingCandidates.length > 0) return followingCandidates[0] ?? null;
  }
  return null;
}
