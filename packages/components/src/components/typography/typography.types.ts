import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';

/**
 * Named typographic variants, each mapped to a semantically appropriate
 * default element and a set of design-token values.
 */
export type TypographyVariant =
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'h5'
  | 'h6'
  | 'subtitle1'
  | 'subtitle2'
  | 'body1'
  | 'body2'
  | 'caption'
  | 'overline'
  /**
   * A medium-weight, label-sized text style. This is a VISUAL variant only —
   * for an actual form-control label, use the `Label` component (`@lostgradient/cinder/label`),
   * which manages `for`/`id` association, the required indicator, and disabled state.
   */
  | 'label';

/**
 * Non-void element tags valid for the `component` prop. Void elements are
 * excluded because Typography always renders a `children` snippet.
 */
export type TypographyElement = Exclude<
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
 * Props for the Typography component.
 *
 * Renders text with a named typographic variant mapped to cinder's design
 * token scale, on a semantically appropriate (but overridable) HTML element.
 */
export type TypographyProps = Omit<HTMLAttributes<HTMLElement>, 'class' | 'children'> & {
  /**
   * Named typographic style to apply. Controls font size, weight, line height,
   * and letter spacing via design tokens.
   * @default "body1"
   */
  variant?: TypographyVariant;
  /**
   * Override the rendered HTML element while keeping the variant's visual style.
   * Useful for SEO/semantic control, e.g. `variant="h1" component="span"` renders
   * a visually h1-styled `<span>`.
   *
   * **Accessibility:** rendering a heading variant (`h1`–`h6`) on a non-heading
   * element removes the heading role from the document outline. If the text still
   * functions as a heading, add `role="heading"` and `aria-level` yourself.
   *
   * **Typing:** forwarded attributes are typed as the generic `HTMLAttributes`, so
   * element-specific attributes are not narrowed by `component` — e.g. `component="a"`
   * will not accept `href` through Typography's props. For an interactive element with
   * its own attributes (a real link or button), render that element directly instead.
   */
  component?: TypographyElement;
  /**
   * When true, adds `margin-block-end` below the element using the space scale.
   * @default false
   */
  gutterBottom?: boolean;
  /**
   * When true, constrains text to a single line with `text-overflow: ellipsis`.
   * @default false
   */
  noWrap?: boolean;
  /** Additional class names merged with `.cinder-typography`. */
  class?: string;
  /** The text content or composed inline content. */
  children: Snippet;
};

/** Cinder-specific props for the Typography component, used by the schema generator. */
export interface TypographySchemaProps {
  /**
   * Named typographic style to apply.
   * @default "body1"
   */
  variant?: TypographyVariant;
  /**
   * Override the rendered HTML element while keeping the variant's visual style.
   */
  component?: TypographyElement;
  /**
   * When true, adds bottom margin using the space scale.
   * @default false
   */
  gutterBottom?: boolean;
  /**
   * When true, constrains to a single line with ellipsis overflow.
   * @default false
   */
  noWrap?: boolean;
  /** Additional class names merged with `.cinder-typography`. */
  class?: string;
}
