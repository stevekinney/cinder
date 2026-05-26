import type { Snippet } from 'svelte';
export type CommandItemProps = {
  /** Submitted value; surfaced through the registration record. */
  value: string;
  /**
   * Invoked when the item is activated inside CommandPalette.
   * CommandMenu owns selection through its menu-level onselect callback.
   */
  onselect?: () => void;
  /** When true, the item is skipped by arrow keys and cannot be activated. */
  disabled?: boolean;
  /** Optional secondary text shown below the main label. */
  description?: string;
  /** Leading content (icon, avatar). Rendered with aria-hidden. */
  leading?: Snippet;
  /** Trailing content (kbd hint, badge). Rendered with aria-hidden. */
  trailing?: Snippet;
  /** Main label content. */
  children: Snippet;
  /** Class merged with `.cinder-command-item`. */
  class?: string;
};
