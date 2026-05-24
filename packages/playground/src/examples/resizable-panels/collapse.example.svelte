<script lang="ts" module>
  export const title = 'Double-click collapse';
  export const description = 'Double-click the handle to collapse or restore the leading pane.';
</script>

<script lang="ts">
  import { ResizablePanels, type ResizablePanelDefinition } from 'cinder/resizable-panels';

  const panes = [
    {
      id: 'filters',
      label: 'Filters',
      defaultSize: { value: 24, unit: 'percent' },
      minSize: { value: 180, unit: 'px' },
      collapsible: true,
    },
    { id: 'results', label: 'Results', defaultSize: { value: 76, unit: 'percent' } },
  ] satisfies ResizablePanelDefinition[];
</script>

<ResizablePanels
  collapseOnDoubleClick
  {panes}
  style="min-block-size: 18rem; border: 1px solid var(--cinder-border);"
>
  {#snippet children(pane)}
    <div style="padding: var(--cinder-space-4);">{pane.label}</div>
  {/snippet}
</ResizablePanels>
