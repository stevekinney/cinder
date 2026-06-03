<script lang="ts" module>
  /**
   * @cinder
   * @category typography
   * @status beta
   * @purpose Renders text with a named typographic variant mapped to the design token scale.
   * @tag typography
   * @tag text
   * @useWhen Applying a named typographic style (heading, body, caption) with semantic HTML.
   * @avoidWhen Rendering inline text inside a paragraph — use a plain <span> with CSS.
   * @related label, kbd
   */
  export type {
    TypographyElement,
    TypographyProps,
    TypographyVariant,
  } from './typography.types.ts';
</script>

<script lang="ts">
  import { classNames } from '../../utilities/class-names.ts';

  import type {
    TypographyElement,
    TypographyProps,
    TypographyVariant,
  } from './typography.types.ts';

  let {
    variant = 'body1',
    component,
    gutterBottom = false,
    noWrap = false,
    class: className,
    children,
    ...rest
  }: TypographyProps = $props();

  const defaultElements: Record<TypographyVariant, TypographyElement> = {
    h1: 'h1',
    h2: 'h2',
    h3: 'h3',
    h4: 'h4',
    h5: 'h5',
    h6: 'h6',
    // Subtitles are a VISUAL role, not a heading — default to <p> so they don't
    // inject orphaned headings into the document outline (which breaks screen-reader
    // heading navigation). Pass component="h6" if a subtitle is genuinely a sub-heading.
    subtitle1: 'p',
    subtitle2: 'p',
    body1: 'p',
    body2: 'p',
    caption: 'span',
    overline: 'span',
    label: 'span',
  };

  // `defaultElements[variant] ?? 'p'` guards against an untyped (JS) consumer passing
  // an unknown variant: without the fallback, `defaultElements[badVariant]` is
  // `undefined` and `<svelte:element this={undefined}>` renders nothing.
  const resolvedTag = $derived(component ?? defaultElements[variant] ?? 'p');
</script>

<svelte:element
  this={resolvedTag}
  {...rest}
  class={classNames('cinder-typography', className)}
  data-cinder-variant={variant}
  data-cinder-gutter={gutterBottom ? '' : undefined}
  data-cinder-nowrap={noWrap ? '' : undefined}
>
  {@render children()}
</svelte:element>
