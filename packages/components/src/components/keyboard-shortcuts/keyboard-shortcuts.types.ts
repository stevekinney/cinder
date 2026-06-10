import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';

/** A single keyboard shortcut entry. */
export type KeyboardShortcutEntry = {
  /** Human-readable action description (e.g. "Save document"). */
  action: string;
  /** The key sequence, rendered via Kbd (e.g. ["Ctrl", "S"] or ["Space"]). */
  keys: string[];
  /** Optional accessible label for the key combo, e.g. "Control plus S". Defaults to joining keys with plus. */
  keysLabel?: string;
};

/** A group of related shortcuts under a heading. */
export type KeyboardShortcutGroup = {
  /** Group heading label. */
  label: string;
  /** Shortcuts in this group. */
  shortcuts: KeyboardShortcutEntry[];
};

/** Props for the KeyboardShortcuts component. */
export type KeyboardShortcutsProps = Omit<HTMLAttributes<HTMLDivElement>, 'class' | 'children'> & {
  /** Groups of shortcuts to display. */
  groups: KeyboardShortcutGroup[];
  /** Optional heading for the entire shortcuts panel. */
  heading?: string;
  /** Snippet rendered above all groups. */
  children?: Snippet;
  /** Additional class names merged with `.cinder-keyboard-shortcuts`. */
  class?: string;
};

/**
 * Cinder-specific props for KeyboardShortcuts, used by the schema generator.
 */
export interface KeyboardShortcutsSchemaProps {
  /** Groups of shortcuts to display. */
  groups: KeyboardShortcutGroup[];
  /** Optional heading for the entire shortcuts panel. */
  heading?: string;
  /** Additional class names merged with `.cinder-keyboard-shortcuts`. */
  class?: string;
}
