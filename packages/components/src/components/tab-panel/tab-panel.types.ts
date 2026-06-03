import type { Snippet } from 'svelte';
export type TabPanelProps = {
  /** Identifier — matches the value of the corresponding Tab. */
  value: string;
  /**
   * Override the `aria-labelledby` target. By default the panel points at the
   * context-derived Tab id (`${baseId}-tab-${value}`). Supply this only when you
   * have overridden the paired Tab's `id` prop — pass that same custom id here so
   * the ARIA tab→panel relationship stays wired to a real element.
   */
  ariaLabelledby?: string;
  /** Additional class names merged with `.cinder-tab-panel`. */
  class?: string;
  /** Panel content. */
  children: Snippet;
};
