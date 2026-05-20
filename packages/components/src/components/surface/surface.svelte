<script lang="ts" module>
  export type { SurfaceProps, SurfaceTone } from './surface.types.ts';
</script>

<script lang="ts">
  import {
    setSurfaceContext,
    type SurfaceContextValue,
  } from '../../_internal/surface-context.ts';
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
