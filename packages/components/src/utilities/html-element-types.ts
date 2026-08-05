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

/**
 * Non-void HTML element tags that also exclude document-metadata and
 * non-content tags (`html`, `head`, `body`, `title`, `style`, `script`,
 * `noscript`, `colgroup`, `optgroup`, `option`) — tags that render invisible
 * or structurally broken markup when used as a generic polymorphic wrapper.
 *
 * This is deliberately narrower than a strictly spec-accurate "flow content"
 * type: it does not exclude context-specific tags like `li`, `td`, or `dt`
 * that are only valid inside a particular parent but still render a visible,
 * if semantically invalid, box.
 */
export type NonMetadataHTMLElementTagName = Exclude<
  NonVoidHTMLElementTagName,
  | 'html'
  | 'head'
  | 'body'
  | 'title'
  | 'style'
  | 'script'
  | 'noscript'
  | 'colgroup'
  | 'optgroup'
  | 'option'
>;
