import { MediaQuery } from 'svelte/reactivity';

/**
 * Reactive `(hover: hover) and (pointer: fine)` watcher backed by Svelte's
 * `MediaQuery` — never a bare `matchMedia` call (`check-no-inline-match-media.ts`).
 * `true` when the primary input is a mouse with hover support, so a fine-pointer
 * enhancement (e.g. `useDragScroll`) may attach. Touch and pen devices, and any
 * device without hover, read `false` — they already pan native scrollers directly.
 *
 * SSR-safe: on the server, `svelte/reactivity` resolves to a stub that returns
 * `false`. As a defensive backstop for a client build loaded without a DOM, this
 * also returns `false` when `window.matchMedia` is unavailable.
 */
export function useFinePointer(): import('./use-fine-pointer.types.ts').UseFinePointer {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return { current: false };
  }

  const query = new MediaQuery('(hover: hover) and (pointer: fine)', false);

  return {
    get current() {
      return query.current;
    },
  };
}
