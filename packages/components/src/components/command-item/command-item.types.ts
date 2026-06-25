import type { Snippet } from 'svelte';

type CommandItemBaseProps = {
  /** Submitted value; surfaced through the registration record. */
  value: string;
  /** When true, the item is skipped by arrow keys and cannot be activated. */
  disabled?: boolean;
  /** Optional secondary text shown below the main label. */
  description?: string;
  /** Accessible name for the option when the rendered row contains secondary text or rich content. */
  accessibleLabel?: string | undefined;
  /** Keyboard shortcut exposed through `aria-keyshortcuts`, e.g. `Meta+N`. */
  keyboardShortcut?: string | undefined;
  /** Leading content (icon, avatar). Rendered with aria-hidden. */
  leading?: Snippet;
  /** Trailing content (kbd hint, badge). Rendered with aria-hidden. */
  trailing?: Snippet;
  /** Main label content. */
  children: Snippet;
  /** Class merged with `.cinder-command-item`. */
  class?: string;
};

type CommandItemOwnsSelectionProps = {
  /** Invoked when the item is activated inside CommandPalette. */
  onselect: () => void;
  /** The item owns activation. This is the default CommandPalette mode. */
  selectionMode?: 'item';
};

type CommandItemParentOwnsSelectionProps = {
  /**
   * Lets a parent list own activation, such as CommandMenu's menu-level
   * onselect callback.
   */
  selectionMode: 'parent';
  /** Optional fallback for custom parent integrations. */
  onselect?: () => void;
};

export type CommandItemProps = CommandItemBaseProps &
  (CommandItemOwnsSelectionProps | CommandItemParentOwnsSelectionProps);
