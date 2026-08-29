import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { NonVoidHTMLElementTagName } from '../../utilities/html-element-types.ts';

export type StackDirection = 'row' | 'column' | 'row-reverse' | 'column-reverse';
export type StackAlign = 'start' | 'center' | 'end' | 'stretch' | 'baseline';
export type StackJustify = 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly';

/** Props for the Stack component. */
export type StackProps = Omit<HTMLAttributes<HTMLElement>, 'class'> & {
  /** Flex direction. @default 'column' */
  direction?: StackDirection | undefined;
  /** Uniform flex gap. */
  gap?: string | undefined;
  /** Cross-axis alignment. */
  align?: StackAlign | undefined;
  /** Main-axis distribution. */
  justify?: StackJustify | undefined;
  /** Whether child items may wrap onto additional lines. @default false */
  wrap?: boolean | undefined;
  /** Rendered HTML tag. */
  as?: NonVoidHTMLElementTagName;
  /** Custom class merged with `.cinder-stack`. */
  class?: string;
  /** Stack contents. */
  children: Snippet;
};
