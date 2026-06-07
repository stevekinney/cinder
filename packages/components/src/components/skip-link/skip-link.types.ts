import type { Snippet } from 'svelte';

/**
 * Props for the SkipLink component.
 *
 * SkipLink composes over VisuallyHidden using `as="a"` with `focusable` mode.
 * The `target` prop is the id of the element to scroll and move focus to on
 * activation; the link's `href` is set to `#${target}` automatically.
 *
 * The surface is intentionally minimal — `target`, optional `children`, and
 * `class`. A skip link is a single-purpose control, so it does NOT forward an
 * arbitrary HTML-attribute bag: doing so would (a) let a consumer's `onclick`
 * clobber the internal focus-management handler, and (b) blow VisuallyHidden's
 * `HTMLAttributes & HTMLAnchorAttributes` props into a "union too complex to
 * represent" error when spread. This matches the issue's proposed API exactly:
 * `<SkipLink target="main-content">Skip to main content</SkipLink>`.
 */
export type SkipLinkProps = {
  /**
   * The `id` of the element to receive focus and scroll into view when the
   * skip link is activated. Required. The rendered `href` is `#${target}`.
   */
  target: string;
  /** Optional override for the visible label. Defaults to "Skip to main content". */
  children?: Snippet;
  /** Additional classes merged onto the visually-hidden anchor. */
  class?: string;
};

/**
 * Cinder-specific props for the SkipLink component, used by the schema generator.
 */
export interface SkipLinkSchemaProps {
  /**
   * The `id` of the element to receive focus when the link is activated.
   */
  target: string;
  /** Additional classes merged onto the visually-hidden anchor. */
  class?: string;
}
