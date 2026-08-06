<script lang="ts" module>
  /**
   * @cinder
   * @category layout
   * @status stable
   * @purpose Bounded scrolling container that constrains overflowing content within a max height or width while remaining keyboard-focusable.
   * @tag layout
   * @tag overflow
   * @useWhen Containing a long list or large block of content inside a fixed-size region.
   * @useWhen Preserving keyboard scrollability for overflow content in a card or surface.
   * @avoidWhen Wrapping the entire page — let the document scroll natively.
   * @avoidWhen Hiding overflow without scrollbars — use plain CSS overflow utilities instead.
   * @related surface
   */
  import type { Attachment } from 'svelte/attachments';
  import type { ScrollAreaElement } from './scroll-area.types.ts';

  const explicitRegionElements = new Set<ScrollAreaElement>(['div', 'pre']);
  const noopScrollFadeAttachment: Attachment<HTMLElement> = () => {};

  export type {
    ScrollAreaDirection,
    ScrollAreaElement,
    ScrollAreaProps,
  } from './scroll-area.types.ts';
</script>

<script lang="ts">
  import type { ScrollAreaProps } from './scroll-area.types.ts';
  import { classNames } from '../../utilities/class-names.ts';
  import { overflowFadeEdges } from '../../utilities/attachments.ts';

  let {
    direction = 'vertical',
    maxHeight,
    maxWidth,
    label,
    tabindex = 0,
    as = 'div',
    class: className,
    scrollFadeVisible = false,
    children,
    ...rest
  }: ScrollAreaProps = $props();

  // No single trailing edge exists on two independent scroll axes at once —
  // `direction="both"` never gets a fade, regardless of scrollFadeVisible.
  const scrollFadeAxis = $derived(
    scrollFadeVisible && direction === 'vertical'
      ? 'block'
      : scrollFadeVisible && direction === 'horizontal'
        ? 'inline'
        : undefined,
  );
  const scrollFadeClass = $derived(
    scrollFadeAxis === 'block'
      ? 'cinder-_scroll-fade'
      : scrollFadeAxis === 'inline'
        ? 'cinder-_scroll-fade-inline-end'
        : undefined,
  );
  // Memoized on `scrollFadeAxis` so the attachment's identity stays stable
  // across unrelated re-renders — Svelte tears down and re-runs an
  // attachment whenever its reference changes.
  const scrollFadeAttachment = $derived(
    scrollFadeAxis ? overflowFadeEdges(scrollFadeAxis) : noopScrollFadeAttachment,
  );

  const normalizedAriaLabel = $derived(
    typeof label === 'string' && label.trim().length > 0 ? label.trim() : undefined,
  );
  // `aria-labelledby` reaches the element through `...rest`. Treat it the same as
  // the `label` prop for landmark purposes: a neutral element (`div`/`pre`) with an
  // accessible name — whether from `label` or `aria-labelledby` — becomes a
  // region landmark. Without this, `<ScrollArea as="div" aria-labelledby="…">`
  // would be a named, focusable, but landmark-less container while the `label`
  // form would not — an asymmetry invisible to the consumer.
  const ariaLabelledby = $derived((rest as { 'aria-labelledby'?: string })['aria-labelledby']);
  const hasAccessibleName = $derived(
    Boolean(normalizedAriaLabel) ||
      (typeof ariaLabelledby === 'string' && ariaLabelledby.trim().length > 0),
  );
  const role = $derived(hasAccessibleName && explicitRegionElements.has(as) ? 'region' : undefined);
</script>

<svelte:element
  this={as}
  {...rest}
  class={classNames('cinder-scroll-area', scrollFadeClass, className)}
  data-cinder-direction={direction}
  {role}
  aria-label={normalizedAriaLabel}
  {tabindex}
  style:max-block-size={maxHeight}
  style:max-inline-size={maxWidth}
  {@attach scrollFadeAttachment}
>
  {@render children()}
</svelte:element>
