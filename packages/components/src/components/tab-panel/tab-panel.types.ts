import type { Snippet } from 'svelte';
export type TabPanelProps = {
  /** Identifier — matches the value of the corresponding Tab. */
  value: string;
  /** Additional class names merged with `.cinder-tab-panel`. */
  class?: string;
  /** Panel content. */
  children: Snippet;
};
