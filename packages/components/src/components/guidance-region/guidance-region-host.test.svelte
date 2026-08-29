<script lang="ts">
  import type { GuidanceApi } from '../../_internal/guidance-context.ts';
  import GuidanceRegion from './guidance-region.svelte';
  import GuidanceRegionProbe from './guidance-region-probe.test.svelte';
  import ModalRegion from '../modal-region/modal-region.svelte';

  let { onReady }: { onReady: (api: GuidanceApi) => void } = $props();
</script>

<ModalRegion>
  <GuidanceRegion claims={[{ id: 'upgrade', kind: 'modal', content: 'Upgrade now' }]}>
    <GuidanceRegionProbe {onReady} />
  </GuidanceRegion>
</ModalRegion>
