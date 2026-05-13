<script lang="ts" module>
  import type { Snippet } from 'svelte';

  import type { SurfaceTone } from '../../_internal/surface-context.ts';

  export type SurfaceToneMutatorProps = {
    initial: SurfaceTone;
    onReady: (handle: { setTone: (next: SurfaceTone) => void }) => void;
    children?: Snippet;
  };
</script>

<script lang="ts">
  import { onMount } from 'svelte';

  import Surface from '../../components/surface.svelte';

  let { initial, onReady, children }: SurfaceToneMutatorProps = $props();

  let tone = $state<SurfaceTone>(initial);

  onMount(() => {
    onReady({
      setTone: (next: SurfaceTone) => {
        tone = next;
      },
    });
  });
</script>

<Surface {tone}>
  {@render children?.()}
</Surface>
