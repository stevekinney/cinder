<script lang="ts" module>
  import type { HTMLAnchorAttributes, HTMLAttributes } from 'svelte/elements';
  import type { Snippet } from 'svelte';

  /**
   * Non-void element tags valid for the `as` prop. Void elements are excluded
   * because this primitive renders a `children` snippet.
   */
  export type VisuallyHiddenElement = Exclude<
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
   * Props for the VisuallyHidden component.
   *
   * The base type includes anchor attributes (`href`, `target`, `rel`,
   * `download`) so the canonical skip-link pattern
   * `<VisuallyHidden as="a" href="#main-content" focusable>` typechecks
   * directly without extra assertions.
   */
  export type VisuallyHiddenProps = Omit<
    HTMLAttributes<HTMLElement> & HTMLAnchorAttributes,
    'class' | 'children'
  > & {
    /** Element tag to render. Defaults to `'span'` (inline-flow safe). */
    as?: VisuallyHiddenElement;
    /**
     * When true, reveals the element fully on `:focus`, `:focus-within`, and
     * `:focus-visible`. Use for skip-link patterns with `as="a"` and `href`.
     * Defaults to `false`.
     */
    focusable?: boolean;
    /** Additional classes merged after the utility classes. */
    class?: string;
    /** Required content — must render something assistive technology can announce. */
    children: Snippet;
  };
</script>

<script lang="ts">
  import { classNames } from '../utilities/class-names.ts';

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
