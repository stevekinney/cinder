import { closestAcrossShadow, getShadowHost } from './portal.utilities-events.svelte.ts';
export type { PortalAttachmentOptions, PortalTargetInput } from './portal-attachment-types.ts';

function isEffectivelyDisabled(source: HTMLElement): boolean {
  if (source.matches(':disabled')) return true;

  const disabledFieldset = source.closest<HTMLFieldSetElement>('fieldset[disabled]');
  if (!disabledFieldset) return false;
  const firstLegend = disabledFieldset.querySelector(':scope > legend');
  return !firstLegend?.contains(source);
}

export function isPortalSourceUnavailable(source: HTMLElement): boolean {
  if (isEffectivelyDisabled(source)) return true;
  // Plain `closest()` cannot see past a shadow boundary, so a source whose
  // enclosing shadow HOST gains `[hidden]`/`[inert]`/`aria-hidden="true"`
  // would otherwise still report itself as available: the computed-style
  // walk below crosses shadow hosts, but none of these three attributes
  // change `display`/`visibility` on their own, so this check needs the
  // same cross-shadow reach.
  if (closestAcrossShadow(source, '[hidden], [inert], [aria-hidden="true"]')) return true;
  if (typeof window === 'undefined' || typeof getComputedStyle !== 'function') return false;
  let ancestor: HTMLElement | null = source;
  while (ancestor) {
    const computed = getComputedStyle(ancestor);
    if (computed.display === 'none' || computed.visibility === 'hidden') return true;
    ancestor = ancestor.parentElement ?? getShadowHost(ancestor);
  }
  return false;
}

export function observePortalSourceAvailability(
  source: HTMLElement | null | undefined,
  onChange: (unavailable: boolean) => void,
): () => void {
  if (!source) return () => {};

  const syncAvailability = () => {
    onChange(isPortalSourceUnavailable(source));
  };
  if (typeof MutationObserver === 'undefined') {
    syncAvailability();
    return () => {};
  }

  const observer = new MutationObserver(syncAvailability);
  let ancestor: HTMLElement | null = source;
  while (ancestor) {
    observer.observe(ancestor, {
      attributes: true,
      attributeFilter: ['hidden', 'inert', 'aria-hidden', 'disabled', 'class', 'style'],
    });
    ancestor = ancestor.parentElement ?? getShadowHost(ancestor);
  }
  syncAvailability();

  const resizeObserver =
    typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(syncAvailability);
  resizeObserver?.observe(source);

  return () => {
    observer.disconnect();
    resizeObserver?.disconnect();
  };
}

export { createPortalAttachment } from './portal.utilities-attachment.svelte.ts';
export {
  closestAcrossShadow,
  getShadowHost,
  isRedispatchedPortaledEvent,
  redispatchPortaledEvent,
} from './portal.utilities-events.svelte.ts';
export { invalidatePortalDirection } from './portal.utilities-observers.svelte.ts';

export {
  copyInheritedPortalAttributes,
  createInheritedPortalStyle,
  findNearestOpenPopover,
  findNearestOpenTopLayer,
  getInheritedPortalStyle,
  resolvePortalTarget,
} from './portal.utilities-inheritance.svelte.ts';
