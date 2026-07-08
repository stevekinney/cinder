import type { Snippet } from 'svelte';
export type TabProps = {
  /** Identifier — matches the value of the corresponding TabPanel. */
  value: string;
  /** Optional explicit id override; auto-generated otherwise for ARIA wiring. */
  id?: string;
  /**
   * Optional explicit `aria-controls` target for caller-owned panels. By default,
   * Cinder points at the matching TabPanel id (`${baseId}-panel-${value}`).
   */
  controls?: string;
  /** Disables this single tab. The panel content is hidden but its DOM stays. */
  disabled?: boolean;
  /** Additional class names merged with `.cinder-tab`. */
  class?: string;
  /** Tab label content. */
  children: Snippet;
  /**
   * Decorative content rendered inside an `aria-hidden` span (badges, kbd hints,
   * counters). Do NOT use for interactive controls like close buttons —
   * `aria-hidden` removes the content from the accessibility tree, making any
   * interactive child unreachable by keyboard and invisible to screen readers.
   *
   * For a closeable tab, render a separate `<button>` immediately after the
   * `<Tab>` in the DOM (as a sibling within the tab strip) and associate it
   * with the tab via `aria-label="Close [tab name]"`. The close button must
   * live outside the `<Tab>` element entirely.
   */
  trailing?: Snippet;
};
