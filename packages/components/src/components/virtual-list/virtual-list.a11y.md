# VirtualList · accessibility

## Pattern

VirtualList renders only a window of its collection, which is the source of every accessibility concern here: what is in the DOM is not what exists. The component's job is to make sure assistive technology is told about the collection, not about the window.

By default the root is `role="list"` and each row is `role="listitem"`. A consumer may override `role`, in which case they own the semantics entirely and the component stops adding set-position attributes.

## Set position and size

Every row carries `aria-posinset` and `aria-setsize`, and both describe the **full** collection rather than the rendered window. Without them a screen reader announces what is mounted, so a 10,000-row list reads as "3 of 12".

`aria-posinset` is 1-based, as the specification requires. The `context.index` handed to the row snippet stays 0-based, because that is an array index.

These are emitted only while the component owns the row role. A consumer who overrides `role` takes responsibility for them: a position within a set, on a row whose role bears no set, is meaningless at best.

## Keyboard

The scroll container is focusable (`tabindex="0"` by default) so keyboard users can reach it and scroll with the native keys. That native behaviour is left alone in the ordinary case — intercepting it would replace smooth browser scrolling with a jump, and browsers already do it well.

The component takes over Arrow, Page, Home, and End **only when `stickyItems` is set**, where native scrolling would leave the pinned header's relationship to the rows ambiguous. In that mode:

- Arrow keys move by one row; Page keys by the rows the header leaves visible, not by the whole viewport; Home and End go to the collection's ends. Paging by the full viewport would step over the row sitting under the header — covered before the press and covered after it, so never exposed between one page and the next.
- Navigation is relative to the first **uncovered** row — the first one the pinned header is not sitting on top of. The rendered window carries overscan, so its edge would move the reader relative to a row they cannot see; and the first _visible_ row is the header itself whenever one is pinned, so advancing from that lands on the row hidden underneath it.
- Destinations clear the header rather than aligning flush to the container's edge, which is the space the header occupies.
- Arrow and Page keys pass **over** sticky rows, which Home and End do not. A pinned header is on screen for as long as its section is, so scrolling to it moves nothing; skipping it also keeps the two directions symmetric at a section boundary, where the header is both the first visible row and the thing covering the edge.
- Under `horizontal` with a right-to-left writing direction, Left and Right are exchanged, per the WAI-ARIA Authoring Practices. `KeyboardEvent.key` is not remapped by `dir`, so the widget must do this itself.
- Keys that originate **inside a row** are left alone. A row containing a text input, slider, or select uses the arrow keys itself, and the list only claims events targeted at its own scroll container.

`tabindex={-1}` keeps the container programmatically focusable without placing it in the tab order.

## Motion

`smoothScroll` animates `scrollToIndex`. It yields to `prefers-reduced-motion: reduce`, checked at the moment of each scroll so a preference changed mid-session takes effect. Scroll corrections under `dynamicSize` are never animated regardless — a smooth correction would perform the very jump it exists to hide.

## Sticky rows

A sticky row whose own index has scrolled out of the rendered window stays mounted so the heading does not vanish. It is the same element throughout — kept in the keyed `{#each}` and switched to absolute positioning rather than moved into a block of its own, which would destroy and rebuild it at every crossing and take any local state or focused control inside it with it.

It is not `aria-hidden`. Past its window this is the only instance of that row, so hiding it would remove a visible heading from the accessibility tree and leave anything focusable inside it reachable but invisible to a screen reader.

It also keeps its place in index order among the rendered rows, because reading order is its position in the list. Ordering costs nothing visually: the row is positioned absolutely and stays above its siblings by `z-index`, not by coming last in the DOM.

## Scroll restoration

`scrollRestoration` moves the scroll position on mount. It does not move focus, so a keyboard user's focus point is unaffected by a restore.

## Verification

- Render the grouped `sticky-headers` example and navigate with Arrow, Page, Home, and End. Confirm the pinned heading tracks the section and that focus stays on the container.
- Inspect any row in accessibility tools and confirm `aria-posinset` reports its position in the full collection, not in the rendered window.
- Override `role` and confirm the set-position attributes disappear rather than contradicting the new role.
- Put a text input in a row, focus it, and confirm the arrow keys move the caret rather than scrolling the list.
- Enable `prefers-reduced-motion` and confirm `scrollToIndex` jumps rather than animating.
- Check forced-colors mode, where the sticky row's background is what separates it from the rows sliding beneath it.

Related components: `data-list`, `data-table`, `data-grid`.
