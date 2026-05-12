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
 * SSR-safe: on the server, `svelte/reactivity` resolves to a stub that returns the
 * fallback (`false` — motion ok by default; CSS handles reduced-motion presentation
 * independently). On the client, `.current` is a live reactive value.
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { useReducedMotion } from 'cinder';
 *   const motion = useReducedMotion();
 * </script>
 *
 * {#if !motion.current}
 *   <AnimatedWidget />
 * {/if}
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
