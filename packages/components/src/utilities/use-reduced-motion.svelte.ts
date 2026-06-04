import { MediaQuery } from 'svelte/reactivity';

export type UseReducedMotion = {
  /** Reactive boolean — `true` when the user prefers reduced motion. */
  readonly current: boolean;
};

/**
 * Reactive `prefers-reduced-motion: reduce` watcher backed by Svelte's `MediaQuery`.
 * Returns an object with a `.current` boolean that updates whenever the OS-level
 * preference changes.
 *
 * SSR-safe: on the server, `svelte/reactivity` resolves to a stub that returns
 * `false` because the user's preference is unavailable. As a defensive backstop
 * for environments where the client build is loaded without a DOM, the hook also
 * returns `false` when `window.matchMedia` is unavailable. Use this hook for
 * client-side imperative behavior; keep SSR-visible presentation in CSS media
 * queries and duration tokens.
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { useReducedMotion } from '@lostgradient/cinder';
 *
 *   const motion = useReducedMotion();
 *   let viewport: HTMLDivElement;
 *
 *   function scrollToEnd() {
 *     viewport.scrollTo({
 *       top: viewport.scrollHeight,
 *       behavior: motion.current ? 'auto' : 'smooth',
 *     });
 *   }
 * </script>
 *
 * <div bind:this={viewport}>...</div>
 * <button type="button" on:click={scrollToEnd}>Scroll to end</button>
 * ```
 */
export function useReducedMotion(): UseReducedMotion {
  // On the server, `svelte/reactivity` resolves to a stub whose `MediaQuery`
  // never touches `window`. But when the *client* build of `MediaQuery` is
  // loaded in a context without a DOM (e.g. our SSR-contract test harness runs
  // under the `browser` export condition yet clears `window` to exercise the
  // true server path), its constructor would call `window.matchMedia` and throw.
  // Guard on `matchMedia` so the documented SSR-safe `false` fallback holds
  // regardless of which `MediaQuery` build module resolution selected.
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return { current: false };
  }

  // Pass the parenthesized form explicitly. MediaQuery's constructor regex
  // /\(.+\)/ passes parenthesized strings verbatim to window.matchMedia, so
  // "(prefers-reduced-motion: reduce)" matches the @media guards already used
  // in CSS throughout the package — a single grep target across JS and CSS.
  const query = new MediaQuery('(prefers-reduced-motion: reduce)', false);

  return {
    get current() {
      return query.current;
    },
  };
}
