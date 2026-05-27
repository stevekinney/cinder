import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';

export type ContainerMaxWidth = 'prose' | 'narrow' | 'wide' | 'full';

/**
 * Non-void element tags valid for the `as` prop. Void elements are excluded
 * because this primitive always renders a `children` snippet.
 */
export type ContainerElement = Exclude<
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

export type ContainerProps = Omit<HTMLAttributes<HTMLElement>, 'children' | 'class'> & {
  /** Named max-width token. Omitted falls back to the default content-width token. */
  maxWidth?: ContainerMaxWidth;
  /** Center the box with auto inline margins. @default true */
  centered?: boolean;
  /** Apply the default inline gutter so content never touches the edges. @default true */
  padded?: boolean;
  /** Element tag to render. @default 'div' */
  as?: ContainerElement;
  /** Additional classes merged onto the root element. */
  class?: string;
  /** Required content rendered inside the container. */
  children: Snippet;
};

export interface ContainerSchemaProps {
  /** Named max-width token. Omitted falls back to the default content-width token. */
  maxWidth?: ContainerMaxWidth;
  /** Center the box with auto inline margins. @default true */
  centered?: boolean;
  /** Apply the default inline gutter so content never touches the edges. @default true */
  padded?: boolean;
  /** Element tag to render. @default "div" */
  as?: ContainerElement;
  /** Additional classes merged onto the root element. */
  class?: string;
}
