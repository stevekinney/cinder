<script lang="ts">
  import type { GuidanceApi } from '../../_internal/guidance-context.ts';
  import GuidanceRegion from './guidance-region.svelte';
  import GuidanceRegionProbe from './guidance-region-probe.test.svelte';
  import ModalRegion from '../modal-region/modal-region.svelte';

  let {
    onReady,
    storage,
  }: {
    onReady: (api: GuidanceApi) => void;
    storage?: import('../../_internal/guidance-context.ts').GuidanceStorage;
  } = $props();
</script>

<ModalRegion>
  <GuidanceRegion
    claims={[{ id: 'upgrade', kind: 'modal', content: 'Upgrade now' }]}
    {...storage ? { storage } : {}}
  >
    <GuidanceRegionProbe {onReady} />
  </GuidanceRegion>
</ModalRegion>
