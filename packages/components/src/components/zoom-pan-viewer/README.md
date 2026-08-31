# ZoomPanViewer

An accessible viewport for panning and zooming images, SVGs, and Mermaid diagrams.

## Usage

```svelte
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
```
