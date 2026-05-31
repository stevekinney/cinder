<script lang="ts" module>
  import type { Snippet } from 'svelte';

  import type { SurfaceTone } from '../../_internal/surface-context.ts';

  export type SurfaceToneMutatorProps = {
    initial: SurfaceTone;
    onReady: (handle: { setTone: (next: SurfaceTone) => void }) => void;
    testid?: string;
    children?: Snippet;
  };
</script>

<script lang="ts">
  import { onMount, untrack } from 'svelte';

  import Surface from '../../components/surface/surface.svelte';
  import SurfaceContextProbe from './surface-context-probe.svelte';

  let { initial, onReady, testid = 'mutator-probe', children }: SurfaceToneMutatorProps = $props();

  let tone = $state<SurfaceTone>(untrack(() => initial));

  onMount(() => {
    onReady({
      setTone: (next: SurfaceTone) => {
        tone = next;
      },
    });
  });
</script>

<Surface {tone}>
  <SurfaceContextProbe {testid} />
  {@render children?.()}
</Surface>
