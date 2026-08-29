<script lang="ts">
  import { useGuidance, type GuidanceApi } from '../../utilities/use-guidance.ts';

  let { onReady }: { onReady: (api: GuidanceApi) => void } = $props();
  const api = useGuidance();
  $effect(() => onReady(api));
</script>
