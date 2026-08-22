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
  import { untrack } from 'svelte';
  import type { ScrollAreaProps } from './scroll-area.types.ts';
  import { overflowFadeEdges } from '../../utilities/attachments.ts';
  import { classNames } from '../../utilities/class-names.ts';
  import { devWarn } from '../../utilities/dev-warn.ts';
  import { useDragScroll } from '../../utilities/use-drag-scroll.svelte.ts';
  import { useFinePointer } from '../../utilities/use-fine-pointer.svelte.ts';
  import { useReducedMotion } from '../../utilities/use-reduced-motion.svelte.ts';

  let {
    direction = 'vertical',
    maxHeight,
    maxWidth,
    label,
    tabindex = 0,
    as = 'div',
    dragToScroll = false,
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

  const finePointer = useFinePointer();
  const reducedMotion = useReducedMotion();

  $effect(() => {
    if (dragToScroll && direction === 'both') {
      devWarn(
        '[cinder/ScrollArea] `dragToScroll` is not supported with `direction="both"` yet; it is being ignored.',
      );
    }
  });

  // `axis` is captured once, like `useResizeObserver`'s `box` option — if a
  // consumer changes `direction` after mount, a fresh instance (a keyed
  // `{#key direction}` around the component) picks up the new axis, matching
  // that existing attachment's documented behavior for the same reason.
  // Momentum and rubber-band are exactly the inertial motion
  // `prefers-reduced-motion` is about — see Carousel's identical gating.
  const dragScroll = useDragScroll({
    axis: untrack(() => (direction === 'horizontal' ? 'x' : 'y')),
    enabled: () =>
      dragToScroll && direction !== 'both' && finePointer.current && !reducedMotion.current,
  });

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
  data-cinder-drag-to-scroll={dragToScroll && direction !== 'both' ? '' : undefined}
  {role}
  aria-label={normalizedAriaLabel}
  {tabindex}
  style:max-block-size={maxHeight}
  style:max-inline-size={maxWidth}
  {@attach scrollFadeAttachment}
  {@attach dragScroll}
>
  {@render children()}
</svelte:element>
