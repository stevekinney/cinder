# VirtualList

Windowing primitive for long lists. VirtualList owns a native vertical scroll
container and renders only the visible rows plus overscan; you own the row markup
through the `row` snippet.

Use `VirtualList` to window an already-loaded large collection. Use [`LoadMore`](../load-more/README.md) to fetch another page as the reader reaches the end of a growing result set; the two can be composed when a paginated collection also needs windowed rendering.

## Choosing a row-sizing mode

By default every row is exactly `itemHeight` pixels tall. That is the fast path:
offsets are pure arithmetic and no row is ever measured. (The component always
observes its own scroll container to track viewport size, in both modes — what
`dynamicSize` adds is per-row measurement.)

When rows genuinely vary — they wrap, embed media, or hold user content — set
`dynamicSize`. `itemHeight` then becomes the initial estimate for rows that have
not been measured yet. Each row is measured once as it mounts, its real size is
cached by key, and when a measurement differs from the estimate the scroll offset
is corrected before paint so the viewport does not visibly jump.

Prefer the fixed path when it is honest. `dynamicSize` costs a `ResizeObserver`
subscription per mounted row and a rebuilt offsets table each time a measurement
lands, and it buys nothing for a list whose rows really are uniform.

Pass `getKey` whenever `dynamicSize` is on. Measured sizes are cached by key, so
index-derived keys will attribute a cached size to the wrong row the first time
items reorder.

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

## Scrolling to an item

`bind:ref` hands back a typed handle with `scrollToIndex`:

```svelte
<script lang="ts">
  import { VirtualList, type VirtualListRef } from '@lostgradient/cinder/virtual-list';

  let list = $state<VirtualListRef | undefined>();
</script>

<button type="button" onclick={() => list?.scrollToIndex(500, { align: 'start' })}>
  Jump to event 500
</button>

<VirtualList bind:ref={list} items={events} itemHeight={32} {row} aria-label="Events" />
```

`align` accepts `'start'`, `'center'`, `'end'`, or `'auto'` (the default, which
leaves the position alone when the row is already fully visible). Under
`dynamicSize` the target accounts for every measured row before it, and re-settles
if rows above it are measured for the first time mid-scroll.

## Props

<!-- generated:props:start -->

| Prop            | Type       | Required | Default | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| --------------- | ---------- | -------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `class`         | `string`   | no       | —       | Additional class names merged with `.cinder-virtual-list`.                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `dynamicSize`   | `boolean`  | no       | —       | Measure each rendered row with `ResizeObserver` and cache the result, instead of assuming every row is exactly `itemHeight` tall. Use this when rows wrap, contain images, or otherwise vary in height. Defaults to `false`. While false, no row is measured, no size is cached, and no scroll correction runs — the fixed-height path stays the fast path. The component still observes its own scroll container to track viewport size, as it always has; that is independent of this prop. |
| `height`        | `string`   | no       | —       | CSS block-size for the native scroll container. Defaults to `"20rem"`.                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `itemHeight`    | `number`   | yes      | —       | Row height in pixels. By default every row is assumed to be exactly this tall. When `dynamicSize` is true this becomes the initial estimate for rows that have not been measured yet.                                                                                                                                                                                                                                                                                                         |
| `overscan`      | `number`   | no       | —       | Extra rows rendered before and after the visible window. Defaults to 5.                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `stickToBottom` | `boolean`  | no       | —       | When true, appending items while the viewport is already at the bottom keeps the newest item pinned in view. Appending while scrolled up leaves the scroll position unchanged.                                                                                                                                                                                                                                                                                                                |
| `tabindex`      | `number`   | no       | —       | Override the default focus behavior. The component sets `tabindex="0"` by default so keyboard users can reach the native scroll container for arrow-key scrolling. Pass `tabindex={-1}` when the viewport should be programmatically focusable without entering the tab order.                                                                                                                                                                                                                |
| `getKey`        | `(opaque)` | no       | —       | Stable key extractor. Omit only when items are append-only and never reordered; the component will fall back to full-array indexes. Required in practice under `dynamicSize`: measured sizes are cached by key, so index-derived keys will mis-attribute cached sizes if items ever reorder. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                       |
| `items`         | `(opaque)` | yes      | —       | Items in full logical order. Only the visible window is mounted. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                                                                                                                                                                   |
| `ref`           | `(opaque)` | no       | —       | Typed programmatic handle. Use `bind:ref` to receive it. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                                                                                                                                                                           |
| `row`           | `(opaque)` | yes      | —       | Rendered row snippet. Receives the item and its virtual row context. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                                                                                                                                                               |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

- `--cinder-virtual-list-height`
<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
