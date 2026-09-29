import { untrack } from 'svelte';

/**
 * Track `read()` in its own effect root and hand each value to `onChange`.
 *
 * The root is independent of the calling attachment's effect, so reading
 * reactive state here never re-runs (and so never recreates) the
 * attachment. `onChange` runs untracked. Returns the function that stops
 * tracking.
 */
export function watchReactiveValue<T>(read: () => T, onChange: (value: T) => void): () => void {
  return $effect.root(() => {
    $effect(() => {
      const value = read();
      untrack(() => onChange(value));
    });
  });
}
