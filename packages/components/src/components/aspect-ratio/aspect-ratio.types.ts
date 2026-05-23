import type { Snippet } from 'svelte';
import type { HTMLAnchorAttributes, HTMLAttributes } from 'svelte/elements';

export type AspectRatioOverflow = 'hidden' | 'visible';

/**
 * Non-void element tags valid for the `as` prop. Void elements are excluded
 * because this primitive always renders a `children` snippet.
 */
export type AspectRatioElement = Exclude<
  keyof HTMLElementTagNameMap,
  | 'area'
  | 'base'
  | 'br'
  | 'col'
  | 'embed'
  | 'hr'
  | 'img'
  | 'input'
  | 'link'
  | 'meta'
  | 'param'
  | 'source'
  | 'track'
  | 'wbr'
>;

export type AspectRatioProps = Omit<
  HTMLAttributes<HTMLElement> & HTMLAnchorAttributes,
  'children' | 'class'
> & {
  /** Aspect ratio to apply. Accepts any valid native CSS aspect-ratio value. */
  ratio?: string | number;
  /** Overflow behavior for content that bleeds outside the ratio box. */
  overflow?: AspectRatioOverflow;
  /** Element tag to render. Defaults to `'div'`. */
  as?: AspectRatioElement;
  /** Additional classes merged onto the root element. */
  class?: string;
  /** Required content rendered inside the ratio box. */
  children: Snippet;
};

export interface AspectRatioSchemaProps {
  /** Aspect ratio to apply. Accepts any valid native CSS aspect-ratio value. @default "16/9" */
  ratio?: string | number;
  /** Overflow behavior for overflowing content. @default "hidden" */
  overflow?: AspectRatioOverflow;
  /** Element tag to render. @default "div" */
  as?: AspectRatioElement;
  /** Additional classes merged onto the root element. */
  class?: string;
}
