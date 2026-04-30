<script lang="ts" module>
  import type { Snippet } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';

  export type SurfaceTone = 'default' | 'raised' | 'inset';

  export type SurfaceProps = Omit<HTMLAttributes<HTMLDivElement>, 'class'> & {
    tone?: SurfaceTone;
    /** Additional CSS classes */
    class?: string;
    children?: Snippet;
  };
</script>

<script lang="ts">
  import { classNames } from '../utilities/class-names.ts';

  let { tone = 'default', class: className, children, ...rest }: SurfaceProps = $props();
</script>

<div class={classNames('cinder-surface', className)} data-cinder-tone={tone} {...rest}>
  {#if children}
    {@render children()}
  {/if}
</div>
