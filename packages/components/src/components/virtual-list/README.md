# VirtualList

Fixed-height windowing primitive for long append-only lists. VirtualList owns a
native vertical scroll container and renders only the visible rows plus overscan;
you own the row markup through the `row` snippet.

Version 1 requires a fixed `itemHeight` in pixels. Variable or measured row
heights are intentionally out of scope for this primitive.

## Usage

```svelte
<script lang="ts">
  import { VirtualList } from '@lostgradient/cinder/virtual-list';

  const events = Array.from({ length: 10_000 }, (_, index) => ({
    id: `event-${index}`,
    label: `Event ${index}`,
  }));
</script>

<VirtualList
  items={events}
  itemHeight={32}
  height="20rem"
  getKey={(event) => event.id}
  aria-label="Events"
>
  {#snippet row(event, context)}
    <div data-index={context.index}>{event.label}</div>
  {/snippet}
</VirtualList>
```

Use `stickToBottom` for live log tails: appending while the user is already at
the bottom keeps the newest row in view, while appending with the viewport
scrolled up leaves the scroll position unchanged.

## Props

<!-- generated:props:start -->

| Prop            | Type       | Required | Default | Description                                                                                                                                                                                                                                                                    |
| --------------- | ---------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `class`         | `string`   | no       | —       | Additional class names merged with `.cinder-virtual-list`.                                                                                                                                                                                                                     |
| `height`        | `string`   | no       | —       | CSS block-size for the native scroll container. Defaults to `"20rem"`.                                                                                                                                                                                                         |
| `itemHeight`    | `number`   | yes      | —       | Fixed row height in pixels. Variable and measured row heights are out of scope for v1; pass the known or estimated fixed height for every row.                                                                                                                                 |
| `overscan`      | `number`   | no       | —       | Extra rows rendered before and after the visible window. Defaults to 5.                                                                                                                                                                                                        |
| `stickToBottom` | `boolean`  | no       | —       | When true, appending items while the viewport is already at the bottom keeps the newest item pinned in view. Appending while scrolled up leaves the scroll position unchanged.                                                                                                 |
| `tabindex`      | `number`   | no       | —       | Override the default focus behavior. The component sets `tabindex="0"` by default so keyboard users can reach the native scroll container for arrow-key scrolling. Pass `tabindex={-1}` when the viewport should be programmatically focusable without entering the tab order. |
| `getKey`        | `(opaque)` | no       | —       | Stable key extractor. Omit only when items are append-only and never reordered; the component will fall back to full-array indexes. Not expressible in JSON Schema; see the component types for the signature.                                                                 |
| `items`         | `(opaque)` | yes      | —       | Items in full logical order. Only the visible window is mounted. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                    |
| `row`           | `(opaque)` | yes      | —       | Rendered row snippet. Receives the item and its virtual row context. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

- `--cinder-virtual-list-height`
<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
