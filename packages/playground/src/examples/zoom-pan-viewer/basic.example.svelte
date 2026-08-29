<script lang="ts" module>
  export const title = 'Basic zoom and pan viewer';
  export const description = 'Inspect a large surface with pointer zoom and pan controls.';
</script>

<script lang="ts">
  import { ZoomPanViewer } from '@lostgradient/cinder/zoom-pan-viewer';
</script>

<ZoomPanViewer ariaLabel="Architecture diagram">
  {#snippet children()}
    <div
      style="min-width: 36rem; min-height: 12rem; padding: 3rem; background: var(--cinder-surface-raised);"
    >
      Architecture diagram
    </div>
  {/snippet}
</ZoomPanViewer>
