/**
 * Non-void HTML element tags valid for polymorphic `as` props.
 *
 * Void elements cannot render Svelte snippets or children, so components that
 * own content should not expose them through `<svelte:element>`.
 */
export type NonVoidHTMLElementTagName = Exclude<
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
