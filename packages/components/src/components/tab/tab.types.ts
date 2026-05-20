import type { Snippet } from 'svelte';
export type TabProps = {
  /** Identifier — matches the value of the corresponding TabPanel. */
  value: string;
  /** Optional explicit id override; auto-generated otherwise for ARIA wiring. */
  id?: string;
  /** Disables this single tab. The panel content is hidden but its DOM stays. */
  disabled?: boolean;
  /** Additional class names merged with `.cinder-tab`. */
  class?: string;
  /** Tab label content. */
  children: Snippet;
};
