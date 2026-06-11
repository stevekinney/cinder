import type { Snippet } from 'svelte';
import type { HTMLTdAttributes } from 'svelte/elements';

export type TableCellProps = Omit<HTMLTdAttributes, 'class' | 'align' | 'scope'> & {
  /** Visual alignment for numeric columns. */
  align?: 'left' | 'center' | 'right';
  /**
   * When `'th'`, renders a `<th scope="row">` instead of `<td>`, marking this
   * cell as the row-header identifier for assistive technology. The component
   * sets `scope="row"` itself (so `scope` is not part of the prop surface).
   * Defaults to `'td'` so existing consumers are unaffected.
   *
   * The attribute surface is `HTMLTdAttributes` for both modes — `<td>` and
   * `<th>` share `HTMLTableCellElement`, so `colspan`, `rowspan`, `headers`, and
   * `abbr` are all forwarded regardless of `as`. Only `scope` is removed from the
   * prop surface, because the component owns it (`scope="row"` when `as='th'`).
   */
  as?: 'td' | 'th';
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
