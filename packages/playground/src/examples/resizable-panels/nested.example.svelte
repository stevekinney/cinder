<script lang="ts" module>
  export const title = 'Nested panes';
  export const description = 'Compose outer and inner splitters without cross-talk.';
</script>

<script lang="ts">
  import {
    ResizablePanels,
    type ResizablePanelDefinition,
  } from '@lostgradient/cinder/resizable-panels';

  const outerPanes = [
    {
      id: 'navigation',
      label: 'Navigation',
      defaultSize: { value: 22, unit: 'percent' },
      minSize: { value: 160, unit: 'px' },
    },
    { id: 'workspace', label: 'Workspace', defaultSize: { value: 78, unit: 'percent' } },
  ] satisfies ResizablePanelDefinition[];

  const innerPanes = [
    { id: 'editor', label: 'Editor', defaultSize: { value: 70, unit: 'percent' } },
    {
      id: 'inspector',
      label: 'Inspector',
      defaultSize: { value: 30, unit: 'percent' },
      minSize: { value: 220, unit: 'px' },
    },
  ] satisfies ResizablePanelDefinition[];
</script>

<ResizablePanels
  panes={outerPanes}
  style="min-block-size: 22rem; border: 1px solid var(--cinder-border);"
>
  {#snippet children(pane)}
    {#if pane.id === 'workspace'}
      <ResizablePanels panes={innerPanes} style="block-size: 100%;">
        {#snippet children(innerPane)}
          <div style="padding: var(--cinder-space-4);">{innerPane.label}</div>
        {/snippet}
      </ResizablePanels>
    {:else}
      <div style="padding: var(--cinder-space-4);">{pane.label}</div>
    {/if}
  {/snippet}
</ResizablePanels>
