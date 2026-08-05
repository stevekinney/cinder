# ResizablePanels

Measured splitter layout for editor-style panes. The component keeps sizing state in pixels internally, exposes structured size payloads for persistence, and leaves storage up to the caller.

## Usage

```svelte
<script lang="ts">
  import ResizablePanels from '@lostgradient/cinder/resizable-panels';
  import type { ResizablePanelDefinition } from '@lostgradient/cinder/resizable-panels';

  const panes: ResizablePanelDefinition[] = [
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

## Props

<!-- generated:props:start -->

| Prop                    | Type                                                   | Required | Default | Description                                                                                                                |
| ----------------------- | ------------------------------------------------------ | -------- | ------- | -------------------------------------------------------------------------------------------------------------------------- |
| `class`                 | `string`                                               | no       | —       | Additional class merged onto the `.cinder-resizable-panels` root element.                                                  |
| `collapseOnDoubleClick` | `boolean`                                              | no       | —       | When true, double-clicking a separator collapses or expands the adjacent collapsible pane. Default `false`.                |
| `collapseTarget`        | `"leading"` \| `"trailing"` \| `"nearest-collapsible"` | no       | —       | Which pane to collapse when double-clicking a separator: `'leading'`, `'trailing'`, or `'nearest-collapsible'` (default).  |
| `orientation`           | `"horizontal"` \| `"vertical"`                         | no       | —       | Direction the panes are arranged. `'horizontal'` (default) places them side by side; `'vertical'` stacks them.             |
| `children`              | `(opaque)`                                             | yes      | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |
| `keyboardStep`          | `(opaque)`                                             | no       | —       | A prop whose shape is not captured by the JSON schema; see the component types for the exact signature.                    |
| `onLayoutChange`        | `(opaque)`                                             | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |
| `onLayoutCommit`        | `(opaque)`                                             | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |
| `panes`                 | `(opaque)`                                             | yes      | —       | A prop whose shape is not captured by the JSON schema; see the component types for the exact signature.                    |
| `snapThreshold`         | `(opaque)`                                             | no       | —       | A prop whose shape is not captured by the JSON schema; see the component types for the exact signature.                    |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

<!-- generated:subcomponents:end -->
