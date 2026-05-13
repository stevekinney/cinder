<script lang="ts" module>
  import type { Snippet } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';

  import type { SurfaceTone } from '../_internal/surface-context.ts';
  export type { SurfaceTone };

  export type SurfaceProps = Omit<HTMLAttributes<HTMLDivElement>, 'class'> & {
    tone?: SurfaceTone;
    /** Additional CSS classes */
    class?: string;
    children?: Snippet;
  };
</script>

<script lang="ts">
  import { setContext } from 'svelte';

  import { SURFACE_CONTEXT_KEY, type SurfaceContextValue } from '../_internal/surface-context.ts';
  import { classNames } from '../utilities/class-names.ts';

  let { tone = 'default', class: className, children, ...rest }: SurfaceProps = $props();

  const context: SurfaceContextValue = {
    get tone() {
      return tone;
    },
  };
  setContext(SURFACE_CONTEXT_KEY, context);
</script>

<div class={classNames('cinder-surface', className)} data-cinder-tone={tone} {...rest}>
  {#if children}
    {@render children()}
  {/if}
</div>
