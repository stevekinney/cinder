import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';

/**
 * Props for the Kbd component.
 *
 * Renders a `<kbd>` element styled to look like a physical keyboard key.
 * Use to indicate keyboard shortcuts in tooltips, command palettes, and
 * help text.
 */
export type KbdSize = 'sm' | 'md';

type KbdBaseProps = HTMLAttributes<HTMLElement> & {
  /** Additional class names merged with `.cinder-kbd`. */
  class?: string;
  /** Keyboard key size. */
  size?: KbdSize;
};

type KbdWithLabel = KbdBaseProps & {
  /** Key label content. */
  label: string;
  children?: Snippet;
};

type KbdWithChildren = KbdBaseProps & {
  /** Key label content. */
  label?: string;
  /** Key label content. */
  children: Snippet;
};

export type KbdProps = KbdWithLabel | KbdWithChildren;

/** Cinder-specific props for the Kbd component, used by the schema generator. */
export interface KbdSchemaProps {
  /**
   * Keyboard key size.
   * @default "md"
   */
  size?: KbdSize;
  /** Key label content. */
  label?: string;
  /** Additional class names merged with `.cinder-kbd`. */
  class?: string;
}
