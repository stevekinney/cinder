<script lang="ts">
  import type { GuidanceApi } from '../../_internal/guidance-context.ts';
  import { useGuidance } from '../../utilities/use-guidance.ts';
  import GuidanceRegion from './guidance-region.svelte';

  let { onReady }: { onReady: (api: GuidanceApi) => void } = $props();
  let anchor: HTMLButtonElement;
</script>

<GuidanceRegion
  claims={[{ id: 'tour', anchor: 'tour-trigger', content: 'Try the tour.' }]}
  anchorResolver={() => anchor}
>
  {#snippet children()}
    {@const guidance = useGuidance()}
    <button
      bind:this={anchor}
      type="button"
      onclick={() => {
        onReady(guidance);
        guidance.claim('tour');
      }}>Start tour</button
    >
  {/snippet}
</GuidanceRegion>
