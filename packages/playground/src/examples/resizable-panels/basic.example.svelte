<script lang="ts" module>
  export const title = 'Basic horizontal layout';
  export const description = 'Two panes with a draggable separator and persisted layout payloads.';
</script>

<script lang="ts">
  import {
    ResizablePanels,
    type ResizablePanelDefinition,
  } from '@lostgradient/cinder/resizable-panels';

  const panes = [
    {
      id: 'sidebar',
      label: 'Sidebar',
      defaultSize: { value: 28, unit: 'percent' },
      minSize: { value: 180, unit: 'px' },
    },
    { id: 'editor', label: 'Editor', defaultSize: { value: 72, unit: 'percent' } },
  ] satisfies ResizablePanelDefinition[];
</script>

<ResizablePanels {panes} style="min-block-size: 18rem; border: 1px solid var(--cinder-border);">
  {#snippet children(pane)}
    <div style="padding: var(--cinder-space-4);">{pane.label}</div>
  {/snippet}
</ResizablePanels>
