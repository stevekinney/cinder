<script lang="ts" module>
  import type { Snippet } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';

  /** Axis to allow scrolling along. */
  export type ScrollAreaDirection = 'vertical' | 'horizontal' | 'both';

  /**
   * Non-void element tags valid for the `as` prop. Void elements are excluded
   * because this component always renders a `children` snippet.
   */
  export type ScrollAreaElement = Exclude<
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
    | 'source'
    | 'track'
    | 'wbr'
  >;

  /**
   * Props for ScrollArea. A styled scrollable container with cross-browser
   * scrollbar theming via design tokens. This is chrome only — virtualization
   * (svelte-virtual, TanStack Virtual, etc.) remains a consumer-level concern
   * and pairs *with* this component, not inside it.
   */
  export type ScrollAreaProps = Omit<
    HTMLAttributes<HTMLElement>,
    'class' | 'children' | 'tabindex' | 'role' | 'aria-label'
  > & {
    /** Axis to allow scrolling on. Defaults to `'vertical'`. */
    direction?: ScrollAreaDirection;
    /** Maximum block size of the scroll viewport (any valid CSS length). */
    maxHeight?: string;
    /** Maximum inline size of the scroll viewport (any valid CSS length). */
    maxWidth?: string;
    /**
     * Accessible name for the scroll region. When provided, the container also
     * gets `role="region"` so assistive technology treats it as a landmark.
     * Provide this when the scroll area represents a meaningful section
     * (a chat transcript, a code panel) — omit it for purely decorative
     * scrolling chrome. This is the single source of truth for the accessible
     * name; pass it through this prop rather than the raw `aria-label` HTML
     * attribute so the landmark role and label stay coupled.
     */
    ariaLabel?: string;
    /**
     * Override the default focusable behavior. The component sets `tabindex="0"`
     * by default so keyboard users can scroll the viewport with arrow keys.
     * Pass `tabindex={-1}` to opt out when the scroll area wraps content that
     * is guaranteed not to overflow, or when the container is focused
     * programmatically rather than via tab order.
     */
    tabindex?: number;
    /** Element tag to render. Defaults to `'div'`. */
    as?: ScrollAreaElement;
    /** Additional classes merged onto the scroll viewport. */
    class?: string;
    /** Scrollable content. */
    children: Snippet;
  };
</script>

<script lang="ts">
  import { classNames } from '../utilities/class-names.ts';

  let {
    direction = 'vertical',
    maxHeight,
    maxWidth,
    ariaLabel,
    tabindex = 0,
    as = 'div',
    class: className,
    children,
    ...rest
  }: ScrollAreaProps = $props();

  const role = $derived(ariaLabel ? 'region' : undefined);
</script>

<svelte:element
  this={as}
  {...rest}
  class={classNames('cinder-scroll-area', className)}
  data-cinder-direction={direction}
  {role}
  aria-label={ariaLabel}
  {tabindex}
  style:max-block-size={maxHeight}
  style:max-inline-size={maxWidth}
>
  {@render children()}
</svelte:element>
