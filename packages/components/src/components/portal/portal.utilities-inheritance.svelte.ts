import { useReducedMotion } from '../../utilities/use-reduced-motion.svelte.ts';
import {
  copyInheritedPortalAttributes as copyAttributes,
  type PortalFallbackAttributes,
} from './portal.utilities-attributes.svelte.ts';
import { observeInheritedPortalAttributes } from './portal.utilities-inherited-observers.svelte.ts';
import { getInheritedPortalStyle } from './portal.utilities-inherited-style.svelte.ts';

export { getInheritedPortalStyle } from './portal.utilities-inherited-style.svelte.ts';
export { findNearestOpenTopLayer } from './portal.utilities-top-layer.svelte.ts';

export type PortalTargetInput = HTMLElement | string | null | undefined;
type ResolvedPortalTarget =
  { kind: 'resolved'; target: HTMLElement } | { kind: 'unresolved'; key: string };

export function resolvePortalTarget(target: PortalTargetInput): ResolvedPortalTarget | null {
  if (typeof document === 'undefined') return null;
  if (target == null) return { kind: 'resolved', target: document.body };
  if (target instanceof HTMLElement) return { kind: 'resolved', target };
  try {
    const resolved = document.querySelector(target);
    return resolved instanceof HTMLElement
      ? { kind: 'resolved', target: resolved }
      : { kind: 'unresolved', key: target };
  } catch {
    return { kind: 'unresolved', key: target };
  }
}

export function findNearestOpenPopover(source: HTMLElement): HTMLElement | null {
  let candidate = source.closest<HTMLElement>('[popover]');
  while (candidate) {
    try {
      if (candidate.matches(':popover-open')) return candidate;
    } catch {
      // Unsupported pseudo-classes are treated as closed.
    }
    candidate = candidate.parentElement?.closest<HTMLElement>('[popover]') ?? null;
  }
  return null;
}

export function createInheritedPortalStyle(
  source: () => HTMLElement | null | undefined,
  active: () => boolean,
): { readonly style: string } {
  let style = $state('');
  const reducedMotion = useReducedMotion();
  $effect((): (() => void) | undefined => {
    void reducedMotion.current;
    if (!active()) {
      style = '';
      return undefined;
    }
    const inheritanceSource = source();
    const syncStyle = () => {
      style = getInheritedPortalStyle(inheritanceSource);
    };
    syncStyle();
    const stopObserving = observeInheritedPortalAttributes(inheritanceSource, true, syncStyle);
    if (typeof window === 'undefined') return stopObserving ? () => stopObserving() : undefined;
    const mediaQueries = [
      '(prefers-color-scheme: dark)',
      '(prefers-contrast: more)',
      '(forced-colors: active)',
    ].map((query) => window.matchMedia(query));
    const onMediaChange = () => syncStyle();
    for (const mediaQuery of mediaQueries) mediaQuery.addEventListener('change', onMediaChange);
    window.addEventListener('resize', onMediaChange);
    return () => {
      stopObserving?.();
      for (const mediaQuery of mediaQueries)
        mediaQuery.removeEventListener('change', onMediaChange);
      window.removeEventListener('resize', onMediaChange);
    };
  });
  return {
    get style() {
      return style;
    },
  };
}

export function copyInheritedPortalAttributes(
  element: HTMLElement,
  source: HTMLElement | null | undefined,
  inheritAttributes: boolean,
  fallbackAttributes: PortalFallbackAttributes = {
    dir: element.getAttribute('dir'),
    lang: element.getAttribute('lang'),
    dataTheme: element.getAttribute('data-theme'),
    theme: element.getAttribute('data-cinder-theme'),
  },
) {
  return copyAttributes(element, source, inheritAttributes, fallbackAttributes);
}
