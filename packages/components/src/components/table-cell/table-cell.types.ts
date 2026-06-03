import type { Snippet } from 'svelte';
import type { HTMLTdAttributes } from 'svelte/elements';

export type TableCellProps = Omit<HTMLTdAttributes, 'class' | 'align'> & {
  /** Visual alignment for numeric columns. */
  align?: 'left' | 'center' | 'right';
  /** Additional class names merged with `.cinder-table__cell`. */
  class?: string;
  /**
   * Cell content. Optional so that empty `<td>` cells (used in spanning
   * table layouts) are a valid, non-throwing state. When omitted the cell
   * renders empty, which is valid HTML for a `<td>`.
   *
   * **Note for TypeScript consumers:** the Snippet type is never called externally
   * by consuming code — Svelte's compiler handles invocation internally. Making
   * this optional is therefore safe as an API change: no external caller calls
   * `props.children()` on a Svelte component's props.
   */
  children?: Snippet;
};
