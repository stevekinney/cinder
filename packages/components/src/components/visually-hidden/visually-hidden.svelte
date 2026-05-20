<script lang="ts" module>
  /**
   * @cinder
   * @category typography
   * @status stable
   * @purpose Utility primitive that hides content visually while keeping it available to assistive technology, with an optional focusable mode for skip links.
   * @tag typography
   * @tag accessibility
   * @useWhen Exposing label or helper text only to screen readers without affecting the visual layout.
   * @useWhen Implementing a skip-to-content link that appears on keyboard focus.
   * @avoidWhen Hiding content from everyone — use the hidden attribute or display none instead.
   * @avoidWhen Labelling a form control where a visible label is acceptable — use label directly.
   * @related label
   */
  export type { VisuallyHiddenElement, VisuallyHiddenProps } from './visually-hidden.types.ts';
</script>

<script lang="ts">
  import { classNames } from '../../utilities/class-names.ts';

  import type { VisuallyHiddenProps } from './visually-hidden.types.ts';

  let {
    as = 'span',
    focusable = false,
    class: className,
    children,
    ...rest
  }: VisuallyHiddenProps = $props();

  const mergedClass = $derived(
    classNames('cinder-sr-only', focusable && 'cinder-sr-only-focusable', className),
  );
</script>

<svelte:element this={as} class={mergedClass} {...rest}>{@render children()}</svelte:element>
