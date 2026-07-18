<script lang="ts">
  import ArtifactPanel from './artifact-panel.svelte';

  let { onclose }: { onclose: () => void } = $props();
</script>

<ArtifactPanel instanceId="fixture" title="Artifact title" {onclose}>
  <p>Artifact content</p>
</ArtifactPanel>
