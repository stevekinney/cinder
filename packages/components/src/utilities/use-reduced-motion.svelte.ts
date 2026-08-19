import { MediaQuery, SvelteMap } from 'svelte/reactivity';

function readRootPreference(
  root: HTMLElement | undefined,
): import('./use-reduced-motion.types.ts').ReducedMotionPreference {
  if (!root) return 'system';
  const preference = root.dataset['reducedMotion'];
  return preference === 'on' || preference === 'off' || preference === 'system'
    ? preference
    : 'system';
}

function synchronizeRootPreference(
  root: HTMLElement | undefined,
): import('./use-reduced-motion.types.ts').ReducedMotionPreference {
  const preference = readRootPreference(root);
  if (!root) return preference;
  if (preference === 'system') delete root.dataset['cinderReducedMotion'];
  else root.dataset['cinderReducedMotion'] = String(preference === 'on');
  return preference;
}

const applicationRoot = typeof document === 'undefined' ? undefined : document.documentElement;
const applicationPreferences = new SvelteMap<
  'current',
  import('./use-reduced-motion.types.ts').ReducedMotionPreference
>([['current', synchronizeRootPreference(applicationRoot)]]);

if (applicationRoot && typeof MutationObserver !== 'undefined') {
  new MutationObserver(() => {
    applicationPreferences.set('current', synchronizeRootPreference(applicationRoot));
  }).observe(applicationRoot, {
    attributes: true,
    attributeFilter: ['data-reduced-motion'],
  });
}

function getApplicationPreference(): import('./use-reduced-motion.types.ts').ReducedMotionPreference {
  const preference = applicationPreferences.get('current') ?? 'system';
  return applicationRoot ? readRootPreference(applicationRoot) : preference;
}

/** Resolves an explicit motion preference against the current system preference. */
export function resolveReducedMotion(
  preference: import('./use-reduced-motion.types.ts').ReducedMotionPreference,
  systemPrefersReducedMotion: boolean,
): boolean {
  return preference === 'on' || (preference === 'system' && systemPrefersReducedMotion);
}

/**
 * Writes the application-level three-state preference onto an element.
 *
 * The public `data-reduced-motion` attribute preserves the author's selected
 * state. The Cinder-namespaced boolean attribute is intentionally present only
 * for explicit choices: CSS can keep following the media query for `system`,
 * force reduction for `on`, and let an explicit `off` defeat an OS preference.
 */
export function applyReducedMotionPreference(
  element: HTMLElement,
  preference: import('./use-reduced-motion.types.ts').ReducedMotionPreference,
): void {
  if (element !== element.ownerDocument.documentElement) {
    throw new Error('applyReducedMotionPreference must target document.documentElement');
  }

  applicationPreferences.set('current', preference);
  element.dataset['reducedMotion'] = preference;
  if (preference === 'system') {
    delete element.dataset['cinderReducedMotion'];
    return;
  }
  element.dataset['cinderReducedMotion'] = String(preference === 'on');
}

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
export function useReducedMotion(
  preference?: import('./use-reduced-motion.types.ts').ReducedMotionPreference,
): import('./use-reduced-motion.types.ts').UseReducedMotion {
  // On the server, `svelte/reactivity` resolves to a stub whose `MediaQuery`
  // never touches `window`. But when the *client* build of `MediaQuery` is
  // loaded in a context without a DOM (e.g. our SSR-contract test harness runs
  // under the `browser` export condition yet clears `window` to exercise the
  // true server path), its constructor would call `window.matchMedia` and throw.
  // Guard on `matchMedia` so the documented SSR-safe `false` fallback holds
  // regardless of which `MediaQuery` build module resolution selected.
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return { current: resolveReducedMotion(preference ?? getApplicationPreference(), false) };
  }

  // Pass the parenthesized form explicitly. MediaQuery's constructor regex
  // /\(.+\)/ passes parenthesized strings verbatim to window.matchMedia, so
  // "(prefers-reduced-motion: reduce)" matches the @media guards already used
  // in CSS throughout the package — a single grep target across JS and CSS.
  const query = new MediaQuery('(prefers-reduced-motion: reduce)', false);

  return {
    get current() {
      return resolveReducedMotion(preference ?? getApplicationPreference(), query.current);
    },
  };
}
