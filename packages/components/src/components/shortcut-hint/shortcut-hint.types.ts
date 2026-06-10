import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';

/** Props for the ShortcutHint component. */
export type ShortcutHintProps = Omit<HTMLAttributes<HTMLSpanElement>, 'class' | 'children'> & {
  /** The key sequence to display (e.g. ["Ctrl", "S"] or ["Space"]). */
  keys: string[];
  /** Optional accessible label for the key combo. Defaults to joining keys with " plus ". */
  keysLabel?: string;
  /** The action or label to render alongside the key combo. */
  children?: Snippet;
  /** Whether to place the keys before or after the children. @default "after" */
  keysPosition?: 'before' | 'after';
  /** Additional class names merged with `.cinder-shortcut-hint`. */
  class?: string;
};

/**
 * Cinder-specific props for ShortcutHint, used by the schema generator.
 */
export interface ShortcutHintSchemaProps {
  /** The key sequence to display. */
  keys: string[];
  /** Accessible label for the key combo. */
  keysLabel?: string;
  /**
   * Position of keys relative to children.
   * @default "after"
   */
  keysPosition?: 'before' | 'after';
  /** Additional class names merged with `.cinder-shortcut-hint`. */
  class?: string;
}
