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
  onSelect: () => void;
  /**
   * `selectionMode` is a compile-time discriminant that only controls whether
   * `onSelect` is required; it has no runtime effect on activation dispatch.
   * `'item'` is the default CommandPalette mode, in which this component's
   * own `onSelect` is required.
   */
  selectionMode?: 'item';
};

type CommandItemParentOwnsSelectionProps = {
  /**
   * `selectionMode` is a compile-time discriminant that only controls whether
   * `onSelect` is required; it has no runtime effect on activation dispatch.
   * `'parent'` makes `onSelect` optional at the type level for integrations
   * such as CommandMenu, where a parent list owns activation — it does not
   * change which activation handler actually runs.
   */
  selectionMode: 'parent';
  /** Optional fallback for custom parent integrations. */
  onSelect?: () => void;
};

export type CommandItemProps = CommandItemBaseProps &
  (CommandItemOwnsSelectionProps | CommandItemParentOwnsSelectionProps);
