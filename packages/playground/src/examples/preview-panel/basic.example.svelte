<script lang="ts" module>
  export const title = 'Preview panel';
  export const description = 'A bounded preview with status and footer content.';
</script>

<script lang="ts">
  import { PreviewPanel } from '@lostgradient/cinder/preview-panel';
</script>

<PreviewPanel title="Artifact preview" status="ready">
  <p>Preview content is ready.</p>
  {#snippet footer()}
    <small>Updated just now</small>
  {/snippet}
</PreviewPanel>
