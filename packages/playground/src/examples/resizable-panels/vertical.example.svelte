<script lang="ts" module>
  export const title = 'Vertical layout';
  export const description = 'Stack panes and resize them along the block axis.';
</script>

<script lang="ts">
  import { ResizablePanels, type ResizablePanelDefinition } from 'cinder/resizable-panels';

  const panes = [
    {
      id: 'preview',
      label: 'Preview',
      defaultSize: { value: 35, unit: 'percent' },
      minSize: { value: 120, unit: 'px' },
    },
    { id: 'console', label: 'Console', defaultSize: { value: 65, unit: 'percent' } },
  ] satisfies ResizablePanelDefinition[];
</script>

<ResizablePanels
  orientation="vertical"
  {panes}
  style="block-size: 20rem; border: 1px solid var(--cinder-border);"
>
  {#snippet children(pane)}
    <div style="padding: var(--cinder-space-4);">{pane.label}</div>
  {/snippet}
</ResizablePanels>
