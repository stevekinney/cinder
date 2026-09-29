<script lang="ts">
  import ResizablePanels from './resizable-panels.svelte';
  import type { ResizablePanelDefinition } from './resizable-panels.types.ts';
  const panes: ResizablePanelDefinition[] = [
    {
      id: 'sidebar',
      label: 'Sidebar',
      defaultSize: { value: 28, unit: 'percent' },
      minSize: { value: 180, unit: 'px' },
    },
    { id: 'editor', label: 'Editor', defaultSize: { value: 72, unit: 'percent' } },
  ];
</script>

<ResizablePanels {panes}>
  {#snippet children(pane)}
    <div class="pane-content">{pane.label}</div>
  {/snippet}
</ResizablePanels>
