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
 * `false` because the user's preference is unavailable. Use this hook for
 * client-side imperative behavior; keep SSR-visible presentation in CSS media
 * queries and duration tokens.
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { useReducedMotion } from 'cinder';
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
