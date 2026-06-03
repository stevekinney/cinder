import type { Snippet } from 'svelte';
import type { HTMLAnchorAttributes } from 'svelte/elements';

export type LinkUnderline = 'always' | 'hover' | 'none';
export type LinkColor = 'primary' | 'inherit';

/**
 * Props for the Link component.
 *
 * Link is an inline text link for use within body text and prose content.
 * For page navigation links in sidebars or nav bars, use NavigationItem instead.
 *
 * When `disabled` is true, the component renders a `<span aria-disabled="true">` instead
 * of an `<a>` — the href is never emitted, pointer-events are disabled, and the element
 * carries `aria-disabled` for assistive technology.
 *
 * When `external` is true, `target="_blank"` and `rel="noopener noreferrer"` are merged
 * with any consumer-supplied `target` and `rel` values (consumer values are kept unless
 * the component needs to add to them).
 */
export type LinkProps = Omit<HTMLAnchorAttributes, 'class' | 'href' | 'target' | 'rel'> & {
  /**
   * The URL the link points to. Optional because a `disabled` link renders a
   * `<span>` with no href — provide it for any enabled (non-disabled) link.
   */
  href?: string;
  /**
   * Controls text-decoration behavior.
   * - `'always'` — underline is always visible.
   * - `'hover'` — underline appears on hover and focus (default).
   * - `'none'` — underline is never shown.
   * @default "hover"
   */
  underline?: LinkUnderline;
  /**
   * Controls the link color.
   * - `'primary'` — uses the accent/primary color token.
   * - `'inherit'` — inherits the surrounding text color.
   * @default "primary"
   */
  color?: LinkColor;
  /**
   * When true, automatically adds `target="_blank"` and merges `rel="noopener noreferrer"`
   * with any consumer-supplied `rel`. Consumer-supplied `target` is preserved if provided.
   * @default false
   */
  external?: boolean;
  /**
   * When true, renders a `<span aria-disabled="true">` instead of `<a>`. The href is not
   * emitted and pointer-events are disabled. Use to show a link that is contextually
   * unavailable without removing it from the visual layout.
   * @default false
   */
  disabled?: boolean;
  /** Forwarded to the rendered `<a>`. Merged with `external`-derived values when `external` is true. */
  target?: HTMLAnchorAttributes['target'];
  /** Forwarded to the rendered `<a>`. Merged with `external`-derived `noopener noreferrer` when `external` is true. */
  rel?: HTMLAnchorAttributes['rel'];
  /** Additional class names merged with `.cinder-link`. */
  class?: string;
  /** The link text or composed content. Required. */
  children: Snippet;
};
