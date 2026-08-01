<script lang="ts">
  import { createPortalAttachment } from './portal.utilities.svelte.ts';

  let {
    source,
    target,
    initialDirection,
  }: {
    source: HTMLElement;
    target: HTMLElement;
    initialDirection?: 'ltr' | 'rtl' | 'auto';
  } = $props();

  const portalAttachment = createPortalAttachment({
    source: () => source,
    target: () => target,
    inheritAttributes: true,
  });
</script>

{#if initialDirection === undefined}
  <div data-testid="direct-portal-attachment" {@attach portalAttachment}></div>
{:else}
  <div
    data-testid="direct-portal-attachment"
    dir={initialDirection}
    {@attach portalAttachment}
  ></div>
{/if}
