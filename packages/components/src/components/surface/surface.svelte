<script lang="ts" module>
  /**
   * @cinder
   * @category layout
   * @status stable
   * @purpose Neutral background primitive that establishes a tonal layer for nested content and broadcasts its tone to descendants via context.
   * @tag layout
   * @tag container
   * @useWhen Wrapping a region in a consistent background tone such as default, raised, or sunken.
   * @useWhen Letting nested components adapt their styling based on the surrounding surface tone.
   * @avoidWhen Building a self-contained content card with padding and elevation — use card instead.
   * @avoidWhen Standing up a full page scaffold with header and actions — use page-layout instead.
   * @related card, page-layout
   */
  export type { SurfaceProps, SurfaceTone } from './surface.types.ts';
</script>

<script lang="ts">
  import { setSurfaceContext, type SurfaceContextValue } from '../../_internal/surface-context.ts';
  import { classNames } from '../../utilities/class-names.ts';
  import type { SurfaceProps } from './surface.types.ts';

  let { tone = 'default', class: className, children, ...rest }: SurfaceProps = $props();

  const context: SurfaceContextValue = {
    get tone() {
      return tone;
    },
  };
  setSurfaceContext(context);
</script>

<div class={classNames('cinder-surface', className)} data-cinder-tone={tone} {...rest}>
  {#if children}
    {@render children()}
  {/if}
</div>
