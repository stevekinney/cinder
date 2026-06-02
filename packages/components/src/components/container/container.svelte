<script lang="ts" module>
  /**
   * @cinder
   * @category layout
   * @status stable
   * @purpose Centered content-width wrapper for the narrow-column reading pattern, capping inline size at a configurable width token.
   * @tag layout
   * @useWhen Centering article or long-form content in a readable, max-width-capped column.
   * @useWhen Constraining a section of a page to a named content width without app-shell chrome.
   * @avoidWhen Building an app shell with header, breadcrumbs, or action regions — write a hand-rolled page scaffold directly.
   * @related aspect-ratio
   */
  export type { ContainerElement, ContainerMaxWidth, ContainerProps } from './container.types.ts';
</script>

<script lang="ts">
  import { classNames } from '../../utilities/class-names.ts';

  import type { ContainerProps } from './container.types.ts';

  let {
    maxWidth,
    centered = true,
    padded = true,
    as = 'div',
    class: className,
    children,
    ...rest
  }: ContainerProps = $props();
</script>

<svelte:element
  this={as}
  {...rest}
  class={classNames('cinder-container', className)}
  data-cinder-max-width={maxWidth}
  data-cinder-centered={centered ? '' : undefined}
  data-cinder-padded={padded ? '' : undefined}
>
  {@render children()}
</svelte:element>
