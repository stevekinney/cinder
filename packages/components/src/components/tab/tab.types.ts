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
  /**
   * Decorative content rendered inside an `aria-hidden` span (badges, kbd hints,
   * counters). Do NOT use for interactive controls like close buttons — those
   * would be inaccessible inside `aria-hidden`. For close buttons, render them
   * outside the tab.
   */
  trailing?: Snippet;
};
