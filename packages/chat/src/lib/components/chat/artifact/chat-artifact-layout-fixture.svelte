<script lang="ts">
  import ChatArtifactLayout from './chat-artifact-layout.svelte';

  let { open }: { open: boolean } = $props();
</script>

<ChatArtifactLayout instanceId="fixture" class="custom" {open} panelTitle="Panel title">
  <p>Chat content</p>
  {#snippet panel()}
    <p>Panel content</p>
  {/snippet}
</ChatArtifactLayout>
