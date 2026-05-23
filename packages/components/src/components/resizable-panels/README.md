# ResizablePanels

Measured splitter layout for editor-style panes. The component keeps sizing state in pixels internally, exposes structured size payloads for persistence, and leaves storage up to the caller.

## Example

```svelte
<script lang="ts">
  import { ResizablePanels } from 'cinder/resizable-panels';

  const panes = [
    {
      id: 'files',
      label: 'Files',
      defaultSize: { value: 25, unit: 'percent' },
      minSize: { value: 200, unit: 'px' },
    },
    { id: 'editor', label: 'Editor', defaultSize: { value: 50, unit: 'percent' } },
    {
      id: 'preview',
      label: 'Preview',
      defaultSize: { value: 25, unit: 'percent' },
      minSize: { value: 15, unit: 'percent' },
    },
  ];
</script>

<ResizablePanels {panes}>
  {#snippet children(pane)}
    <div>{pane.label}</div>
  {/snippet}
</ResizablePanels>
```
