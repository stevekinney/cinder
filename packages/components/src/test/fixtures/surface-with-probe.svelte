<script lang="ts" module>
  import type { SurfaceTone } from '../../_internal/surface-context.ts';

  export type SurfaceWithProbeProps = {
    tone: SurfaceTone;
  };
</script>

<script lang="ts">
  import Surface from '../../components/surface/surface.svelte';
  import SurfaceContextProbe from './surface-context-probe.svelte';

  let { tone }: SurfaceWithProbeProps = $props();
</script>

<Surface {tone}>
  <SurfaceContextProbe />
</Surface>
