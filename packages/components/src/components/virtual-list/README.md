# VirtualList

Windowing primitive for long lists. VirtualList owns a native scroll container and
renders only the visible rows plus overscan; you own the row markup through the
`row` snippet. It scrolls vertically by default and horizontally under
[`horizontal`](#scrolling-along-the-inline-axis).

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

## Scrolling along the inline axis

Set `horizontal` to window a row of items instead of a column. The component then
owns a horizontally-scrolling container, positions rows along the inline axis, and
reads its scroll offset from `scrollLeft` rather than `scrollTop`.

Two props are **reinterpreted rather than renamed**. `itemHeight` becomes each
item's width, and `height` becomes the container's inline-size. So does the
`--cinder-virtual-list-height` custom property, which keeps its name and switches
to driving `inline-size`. This is deliberate: renaming them would mean either a
second parallel set of props that is meaningless in the other mode, or a breaking
rename for every existing vertical caller. The names stay; read them as "extent
along the main axis" and "extent of the viewport."

```svelte
<VirtualList items={columns} itemHeight={160} horizontal height="480px" aria-label="Columns">
  {#snippet row(column)}
    <div style="inline-size: 160px;">{column.label}</div>
  {/snippet}
</VirtualList>
```

### Right-to-left

Right-to-left is handled, not assumed. The writing direction is resolved from the
container's computed style at mount, so a `dir="rtl"` anywhere up the tree is
enough — you do not pass anything extra.

Underneath, this is messier than it looks. In a right-to-left container browsers
have historically disagreed about what `scrollLeft` even means: whether it starts
at zero or at the maximum, and whether it grows positive or negative as you scroll
away from the start edge. Rather than assume one, the component measures which
convention the browser implements — once per document, with a detached probe — and
normalizes every read and write into a single start-edge-relative offset. Row
positions use logical CSS properties throughout, so nothing depends on physical
left and right.

The practical consequence for you: `scrollToIndex`, `stickToBottom`, and the row
`context.start` offset all mean the same thing in both directions. "The start" is
the left edge in a left-to-right list and the right edge in a right-to-left one.

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

## Chat transcripts and infinite scroll

Set `reverse` for a chat-style list. It opens at the newest item and returns there
whenever one arrives, however far back the reader has scrolled.

`reverse` names the **anchoring, not the ordering**. Items stay in their natural
order — oldest at index 0, newest last — and the array is never flipped. This is
worth being explicit about, because the name suggests otherwise.

It is deliberately distinct from `stickToBottom`, which pins only when the reader is
_already_ at the bottom. Choose by what should happen to someone reading history
when a new message lands: `stickToBottom` leaves them alone, `reverse` brings them
to the newest item. When both are set, `reverse` wins.

Prepending is handled as its own case. Loading a page of older history grows the
list _above_ the reader, and the component anchors to the row they were on so it
stays put — it does not pin to the end, and it does not leave them silently looking
at a different row.

### Loading more in both directions

`onEndReached` fires when the reader comes within `overscan` items of the end;
`onStartReached` does the same at the start. Together they give bi-directional
infinite scroll.

```svelte
<VirtualList
  items={rows}
  itemHeight={40}
  height="320px"
  onEndReached={loadNewer}
  onStartReached={loadOlder}
  getKey={(row) => row.id}
  aria-label="Feed"
>
  {#snippet row(item)}
    <div>{item.label}</div>
  {/snippet}
</VirtualList>
```

Each callback fires **once per approach**, not once per scroll event, and re-arms
when the item count changes. That pairing is what makes the obvious usage safe:
appending in response lets the next approach fire, while a source that returns
nothing leaves the count unchanged and the callback latched, so it does not spin.

Both callbacks are also evaluated when the item count changes, not only on scroll —
an append can bring the end into range without the reader moving at all.

## Remembering the scroll position

`scrollRestoration` writes the reader's position to `sessionStorage` and restores it
when the list mounts again, so navigating away and back returns them to where they
were.

It needs a `scrollRestorationId`, and there is deliberately no default. An implicit
key — derived from position in the tree, or mount order — would quietly hand one
list's remembered offset to a different list after an unrelated refactor, and two
lists on one page would overwrite each other. Pick something tied to what the list
shows.

```svelte
<VirtualList
  items={rows}
  itemHeight={40}
  height="480px"
  scrollRestoration
  scrollRestorationId="inbox"
  aria-label="Inbox"
>
  {#snippet row(item)}
    <div>{item.subject}</div>
  {/snippet}
</VirtualList>
```

Two details worth knowing. Under `dynamicSize` the position is restored by _index_
rather than by pixel offset: at mount every row is still an estimate, so the saved
offset points at a different row than it did when saved — scrolling to the index
lands on the row the reader actually left, and the settle pass follows it as the
rows above are measured. And a saved position whose row no longer exists is dropped
rather than clamped, because clamping would drop the reader somewhere arbitrary and
then save _that_ as though it were their place.

Storage failures are swallowed throughout. A browser in private mode can throw on
reading `sessionStorage`, not just writing to it, and losing a remembered offset must
never break the list.

## Sticky rows

`stickyItems` names the indexes that pin to the leading edge while the reader
scrolls past them — section headers in a grouped list, most often.

The part that virtualization would otherwise break is keeping them mounted. A row
whose index has left the rendered window is normally unmounted, so the heading would
disappear at exactly the moment it is meant to be pinned. The component keeps the
active sticky row in the DOM past its window, and re-sorts the rendered set by index
so a keyed `{#each}` does not move it behind the rows that follow it.

Setting `stickyItems` also makes `scrollToIndex` header-aware. A pinned header covers
the leading edge, so a row aligned flush to it lands underneath — in a list where the
header and its rows share a height, completely underneath. Destinations are offset by
the header that will cover them, which applies to the component's keyboard navigation
and to `scrollToIndex` calls of your own.

Invalid entries — duplicates, non-integers, indexes outside the list — are dropped
rather than throwing. A bad sticky index is a cosmetic problem, not a correctness one.

```svelte
<VirtualList items={rows} itemHeight={36} height="360px" stickyItems={headerIndexes}>
  {#snippet row(item)}
    <div>{item.label}</div>
  {/snippet}
</VirtualList>
```

## Announcing position to assistive technology

Every row carries `aria-posinset` and `aria-setsize`. Both describe the **full**
collection, not the rendered window — without them a screen reader announces what is
mounted, so a 10,000-row list reads as "3 of 12". `aria-posinset` is 1-based, as the
specification requires, while the row's `context.index` stays 0-based.

## Scrolling behaviour

`smoothScroll` makes `scrollToIndex` animate by default. An explicit `behavior` in
the call still wins, so a single jump-to remains available on a list that otherwise
animates. Scroll corrections under `dynamicSize` are never animated whatever this is
set to: a smooth correction would visibly perform the jump it exists to hide.

`adaptiveOverscan` grows `overscan` while the reader is scrolling fast and shrinks it
back when they slow down. `overscan` becomes a floor rather than a fixed value, so
turning this on can only ever render more rows than the configured value, never
fewer. The growth is bounded — an unbounded overscan during a fling would mount
thousands of rows and defeat virtualizing at all.

## Props

<!-- generated:props:start -->

| Prop                  | Type       | Required | Default | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| --------------------- | ---------- | -------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `adaptiveOverscan`    | `boolean`  | no       | —       | Grow `overscan` while the reader is scrolling fast, and shrink it back when they slow down. `overscan` becomes a floor rather than a fixed value: a fast fling renders further ahead to cut pop-in, and a stationary list falls back to exactly what was configured so the DOM stays small. The growth is bounded, because an unbounded overscan during a fling would mount thousands of rows and defeat the point of virtualizing at all. Defaults to false.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `class`               | `string`   | no       | —       | Additional class names merged with `.cinder-virtual-list`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `dynamicSize`         | `boolean`  | no       | —       | Measure each rendered row with `ResizeObserver` and cache the result, instead of assuming every row is exactly `itemHeight` along the scrolled axis. Use this when rows wrap, contain images, or otherwise vary in size. Composes with `horizontal`, where each row is measured by its width. Defaults to `false`. While false, no row is measured, no size is cached, and no scroll correction runs — the fixed-height path stays the fast path. The component still observes its own scroll container to track viewport size, as it always has; that is independent of this prop.                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `height`              | `string`   | no       | —       | CSS extent of the native scroll container across the axis it scrolls: its block-size by default, or its inline-size under `horizontal`. Defaults to `"20rem"`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `horizontal`          | `boolean`  | no       | —       | Scrolls and lays rows out along the inline axis instead of the block axis. `itemHeight` and `height` are REINTERPRETED rather than renamed: `itemHeight` becomes each item's width in pixels along the main axis, and `height` becomes the container's inline-size. The `--cinder-virtual-list-height` custom property keeps its name too and switches to driving `inline-size`, so an existing theme override keeps working when this is turned on. Right-to-left is handled: the writing direction is resolved from the container's computed style at mount, and the scroll offset is read from the start (right) edge in that case. Defaults to false.                                                                                                                                                                                                                                                                                                                                            |
| `itemHeight`          | `number`   | yes      | —       | Each item's extent in pixels along the axis being scrolled: its height by default, or its width under `horizontal`. By default every row is assumed to be exactly this size. When `dynamicSize` is true this becomes the initial estimate for rows that have not been measured yet.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `overscan`            | `number`   | no       | —       | Extra rows rendered before and after the visible window. Defaults to 5.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `reverse`             | `boolean`  | no       | —       | Chat-transcript behaviour: the list starts at its end and returns there on every append. Items stay in their natural order — oldest at index 0, newest last. `reverse` names the anchoring, not the ordering, and the array is never flipped. Deliberately distinct from `stickToBottom`, which pins only when the reader is already at the bottom. `reverse` pins on every append regardless of where the reader is. When both are set, `reverse` wins. Prepending — loading a page of older history — never moves the reader: the row they were looking at stays put while the list grows above it. That last guarantee REQUIRES `getKey`. Telling a prepend from an append means comparing key sequences, and without `getKey` the keys are array indexes: a prepend turns `[0, 1, 2]` into `[0, 1, 2, 3, 4]`, which is indistinguishable from an append and pins the reader to the end instead of holding their place. Pass `getKey` whenever the list can grow at the front. Defaults to false. |
| `scrollRestoration`   | `boolean`  | no       | —       | Remember the scroll position across navigation, keyed by `scrollRestorationId`. The position is written to `sessionStorage` when the list tears down, and read back when it mounts. Deliberately not on every scroll: that would mean a storage write per frame during a fling, and teardown is the last moment the position is knowable anyway. The consequence is that a tab closed by a crash, rather than by navigating away, will not have saved. Storage failures are swallowed: a browser in private mode or at its quota throws on write — and on read — and losing a remembered offset must not break the list. Has no effect without a `scrollRestorationId` — see that prop for why. Explicitly `\| undefined`, like the other conditionally-supplied props: this package compiles with `exactOptionalPropertyTypes`, under which optional and undefined-valued differ, and `scrollRestoration={enabled ? true : undefined}` would otherwise fail to typecheck. Defaults to false.        |
| `scrollRestorationId` | `string`   | no       | —       | Stable id under which `scrollRestoration` saves this list's position. Required for restoration to do anything. There is deliberately no default: an implicit key derived from position or order would silently hand one list's remembered offset to a different list after a refactor, and two lists on one page would overwrite each other. Choose something tied to what the list shows, such as a route or collection name.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `smoothScroll`        | `boolean`  | no       | —       | Animate `scrollToIndex` by default instead of jumping. Equivalent to passing `behavior: 'smooth'` on every call; an explicit `behavior` in the call's options still wins. Scroll corrections under `dynamicSize` are never animated whatever this is set to — a smooth correction would visibly perform the jump it exists to hide. Defaults to false.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `stickToBottom`       | `boolean`  | no       | —       | When true, appending items while the viewport is already at the bottom keeps the newest item pinned in view. Appending while scrolled up leaves the scroll position unchanged.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `stickyItems`         | `number`[] | no       | —       | Item indexes that stay visible at the leading edge while the reader scrolls past them — section headers in a grouped list, most often. A sticky row is kept mounted even after its own index leaves the rendered window, which is the part virtualization would otherwise break: unmounting it would make the heading vanish exactly when it is meant to be pinned. Indexes outside the list, duplicates, and non-integers are dropped rather than throwing — a bad sticky index is a cosmetic problem, not a correctness one.                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `tabindex`            | `number`   | no       | —       | Override the default focus behavior. The component sets `tabindex="0"` by default so keyboard users can reach the native scroll container for arrow-key scrolling. Pass `tabindex={-1}` when the viewport should be programmatically focusable without entering the tab order.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `getKey`              | `(opaque)` | no       | —       | Stable key extractor. Omit only when items are append-only and never reordered; the component will fall back to full-array indexes. Required in practice under `dynamicSize`: measured sizes are cached by key, so index-derived keys will mis-attribute cached sizes if items ever reorder. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `items`               | `(opaque)` | yes      | —       | Items in full logical order. Only the visible window is mounted. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `onEndReached`        | `(opaque)` | no       | —       | Called when the reader scrolls within `overscan` items of the end of the list. Explicitly `\| undefined` rather than merely optional: this package compiles with `exactOptionalPropertyTypes`, under which the two differ, and a consumer writing `onEndReached={enabled ? load : undefined}` would otherwise fail to typecheck. Fires once per approach, not once per scroll event, and re-arms when the item count changes — so appending in response to it allows the next approach to fire while a source that returns nothing does not spin. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                                                                                                                                                                                         |
| `onStartReached`      | `(opaque)` | no       | —       | Called when the reader scrolls within `overscan` items of the start of the list. Pair with `onEndReached` for bi-directional infinite scroll. Latched the same way as `onEndReached`. Prepending in response preserves the reader's position rather than jumping to the new start — but only with `getKey`, since index-derived keys make a prepend look exactly like an append. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `ref`                 | `(opaque)` | no       | —       | Typed programmatic handle. Use `bind:ref` to receive it. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `row`                 | `(opaque)` | yes      | —       | Rendered row snippet. Receives the item and its virtual row context. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

- `--cinder-virtual-list-height`
<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
