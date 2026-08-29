<script lang="ts">
  import type { ModalApi } from '../../_internal/modal-context.ts';
  import ModalRegion from './modal-region.svelte';
  import ModalRegionProbe from './modal-region-probe.test.svelte';

  let { onReady }: { onReady: (api: ModalApi) => void } = $props();
</script>

<ModalRegion>
  <ModalRegionProbe {onReady} />
</ModalRegion>
