# DataGrid · accessibility

## Pattern

DataGrid presents structured data. Preserve the component's semantic roles, row or item labels, and ordering so assistive technology can announce the same relationships that are visible on screen.

Purpose: ARIA data grid foundation for spreadsheet-like datasets with explicit row identity, column sizing, keyboard navigation, range selection, and pinning metadata.

## Use when

- Rendering interactive tabular data that will need grid behavior such as selection, virtualization, resizing, or editing.
- You need role=grid semantics instead of native table semantics.

## Avoid when

- You only need a semantic read-only table — use DataTable or the Table family instead.

## Keyboard and focus

The grid owns the root tab stop and moves the active cell with keyboard commands. Do not put body cells directly in the tab order unless the component documents that behavior.

Keep focus indicators visible. If you wrap or restyle DataGrid, verify the focused element remains visually apparent in default and forced-colors modes.

## Resizing and reordering columns

`resizableColumns` and `reorderableColumns` are both off by default — an existing grid's accessibility contract is unchanged until a caller opts in.

- **Resize handle.** A resizable header cell renders a `role="separator"` element with `aria-orientation="vertical"`, an `aria-label` naming the column ("Resize Customer column"), and `aria-valuenow`/`aria-valuemin`/`aria-valuemax` reflecting the column's current width and bounds. The handle is a plain, untabbable `div` — it never receives its own Tab stop — because width is announced and changed through the keyboard path below instead of a second, redundant focus target.
- **Header focus.** Pressing `ArrowUp` from the top body row (only when `resizableColumns` or `reorderableColumns` is set) moves `aria-activedescendant` to that column's header cell, exactly the same way `aria-activedescendant` already tracks the active body cell. `ArrowDown` or `Escape` returns it to the body cell. This never happens on a grid that has not opted in, so `ArrowUp` at the top row keeps being a no-op on every existing grid.
- **Keyboard resize/reorder.** While a header is focused, `Shift+ArrowLeft`/`Shift+ArrowRight` resizes by 10px (clamped to `minWidth`/`maxWidth`) and `Ctrl`/`Cmd`+`Shift`+`ArrowLeft`/`ArrowRight` moves the column one position within its pin group. Both are announced through DataGrid's existing live region (`role="status"`, `aria-live="polite"`), for example "Customer column resized to 190 pixels" or "Customer column moved to position 2". `Shift+ArrowLeft`/`Shift+ArrowRight` on a body cell (not header-focused) keeps its pre-existing meaning of extending the cell-selection range — the two never overlap, since the resize/reorder shortcuts only fire while a header is the active descendant.
- **Pin groups.** Reordering is constrained to within the same pin group: a column can only change position among columns that share its `pin` value. This applies identically to the pointer drag and the keyboard shortcut, so a screen-reader user and a mouse user get the same set of valid destinations.
- **Sort is unaffected.** Dragging the resize handle, or dragging a header far enough to start a reorder, never triggers that column's sort — a plain click (or Enter/Space while header-focused) still sorts a sortable column.

## Editing

Only columns marked `editable: true` accept edit mode. DataGrid renders its own Input in place of the read-only value while a cell is editing, so the edit surface always carries the same text-field semantics as every other Cinder Input.

| Key                                             | While focused, not editing                                  | While editing                                                                   |
| ----------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `Enter`                                         | Enters edit mode on an editable cell.                       | Commits the draft and moves the active cell to the same column in the next row. |
| Double-click                                    | Enters edit mode on an editable cell.                       | —                                                                               |
| A single printable character (no Ctrl/Meta/Alt) | Enters edit mode with that character as the initial draft.  | Ordinary text input — reaches the Input's cursor.                               |
| `Escape`                                        | Existing behavior (collapses selection to the active cell). | Cancels: restores the original value without calling `onCellEdit`.              |
| `Tab` / `Shift+Tab`                             | Existing grid cell-to-cell navigation.                      | Commits and moves to the next cell (`Shift+Tab` moves to the previous cell).    |
| Arrow keys, `Home`, `End`, `PageUp`, `PageDown` | Existing grid navigation.                                   | Not intercepted by the grid — they reach the Input's text cursor.               |
| Blurring the Input (e.g. clicking elsewhere)    | —                                                           | Commits.                                                                        |

Focus management: entering edit mode moves real DOM focus into the Input. Committing (Enter, Tab) or canceling (Escape) moves real DOM focus back to the grid root, which keeps `aria-activedescendant` pointing at the resulting active cell — the same focus model the grid already uses for click- and arrow-driven navigation. A blur-triggered commit (clicking elsewhere) does not force focus back into the grid, since focus has already moved to wherever the user clicked.

Editing identity is tracked by stable row key plus column key, not by visual row or column index, so a sort or a virtualization re-render while a cell is being edited does not lose or relocate the edit. If the edited row or column is removed from the grid (filtered out, deleted, or hidden) the edit is canceled automatically.

A column that supplies a custom `cell` snippet keeps using that snippet while editing — it receives `editing: true` in its `DataGridCellContext` and is responsible for its own edit UI (built from Cinder's own Input, not a bespoke `<input>`) if it wants one.

## Row headers

Set `rowHeader: true` on the column that identifies each row. Body cells in that column render with `role="rowheader"` instead of `role="gridcell"`, while still preserving `aria-colindex`, selection state, and active-cell behavior.

Use the same row identity users see on screen whenever possible. A first pinned identifier column is a good default because screen readers can announce the row context before the remaining grid cells.

## Search

`search` is off by default — an existing grid's accessibility contract, DOM, and cost are unchanged until a caller opts in.

- **Toolbar.** The search toolbar renders outside `role="grid"` as a `role="toolbar"` region (Cinder's Toolbar) with its own accessible name ("`<grid label>` toolbar", or "Grid toolbar" without one). The search field's own accessible name is derived from the grid's label ("Search `<grid label>`") and it carries `aria-controls` pointing at the grid.
- **Matching.** Matching is announced, not just painted: a matching cell gets `cinder-data-grid__cell--search-match`, the current match additionally gets `cinder-data-grid__cell--search-match-current`, and both are also exposed as `data-cinder-search-match`/`data-cinder-search-match-current` for tooling. Neither is the only way the state is conveyed — the current match also becomes the active cell (`aria-activedescendant`), so a screen-reader user tracking the grid's active cell the normal way lands on it too.
- **Navigation.** The toolbar's previous/next buttons and `Enter`/`Shift+Enter` in the search field step through matches with wraparound, same as any other find-in-page control. Each step scrolls the matching cell into view and makes it the active cell.
- **Announcements.** Match position ("Match 3 of 12") and "No matches" go through DataGrid's existing live region (`role="status"`, `aria-live="polite"`) — the same one used for resize/reorder announcements.
- **Coexistence.** Search reads whatever `rows`/`columns` the grid currently has, so a committed edit or a sort change updates matches (and, if the active search still matches, the highlight) the same way it already updates row/column geometry.

## Zoom and toolbar counts

`zoom` and `zoomControls` are both off by default (`zoom` at its `100` default, `zoomControls` unset) — an existing grid's accessibility contract, DOM, and cost are unchanged until a caller opts in.

- **Toolbar.** `zoomControls` renders its row-count/column-count/zoom-controls group inside the same `role="toolbar"` region `search` uses (Cinder's Toolbar) — set either or both to get one toolbar; with neither set, DataGrid renders no toolbar at all.
- **Zoom buttons.** "Zoom out" and "Zoom in" are real `<button>`s (Cinder's Button) with their own accessible names — not icon-only controls relying on a tooltip — and each disables itself at its respective `[50, 200]` bound rather than silently doing nothing.
- **Announcements.** A zoom-level change is announced ("Zoom 120%") through DataGrid's existing live region (`role="status"`, `aria-live="polite"`), the same one used for search, resize, and reorder announcements.
- **Text scaling.** `zoom` scales cell and header text size together with row height, header height, and column width, so a caller does not need a separate mechanism to make DataGrid's own text larger — this is in addition to, not a replacement for, the browser's own page-zoom/text-size controls, which continue to work normally.

## Virtualized columns

Column virtualization keeps off-screen columns out of the DOM. The grid preserves `aria-colindex` for the full column set and adds edge shadows plus a stable scrollbar gutter so sighted users have a visible horizontal-overflow cue and the vertical scrollbar does not cover the last visible column.

## Unsupported behavior and limitations

DataGrid does not clamp or cap the total size row/column virtualization renders at extreme row/column counts (decision: decline, see the README's [Unsupported behavior and limitations](./README.md#unsupported-behavior-and-limitations) section for the browser element-size ceilings and the row-count math at the default row height). A grid whose data can approach those ceilings must page or window the data before handing it to DataGrid; there is no in-component escape hatch.

## Names, roles, and state

Use the public props and documented examples to provide accessible names, descriptions, current state, disabled state, selection state, or value text. Do not rely on color, icon shape, placeholder text, or layout position as the only way to communicate meaning.

When DataGrid accepts snippets or arbitrary children, the caller owns the semantics inside those children. Prefer native elements first, and add ARIA only when it matches the rendered behavior.

## Verification

- Render DataGrid in the playground or a focused test fixture.
- Navigate the component with keyboard only.
- Inspect the accessible name, role, and state in browser accessibility tools.
- Check forced-colors mode when the component adds borders, focus rings, selected state, or status color.

Related components: `data-table`, `table`.

## Accessibility review — 2026-09-23 (COR-1145)

**Scope.** A targeted review of every keyboard-and-focus-affecting surface added since the base grid: inline cell editing, pointer/keyboard column resize, pointer/keyboard column reorder, toolbar search, and zoom. For each: where real DOM focus goes on entry/commit/cancel/step, whether `aria-activedescendant` stays live wherever it changes, whether `aria-sort`/`aria-colindex`/`aria-rowindex` stay correct after the interaction, and whether every state change that isn't otherwise visually obvious is announced through the live region. Verified by reading `data-grid.svelte` and every `_internal/*` model end to end, then writing and running new regression tests against the actual rendered DOM (`happy-dom` + `@testing-library/svelte`) for each finding below, rather than relying on inspection alone.

**Findings and fixes.**

1. **`aria-colindex` didn't match rendered column order for pinned columns (real defect, fixed).** `aria-colindex` was computed from each column's position in `columns`/`columnOrder` — before pin grouping — while the grid actually renders left-pinned, then unpinned, then right-pinned columns. Any grid where a `pin`ned column isn't already declared adjacent to its pin group (e.g. a `pin: 'right'` column declared first) rendered with `aria-colindex` values that read in a different order than the columns actually appear on screen; a screen-reader user's column-position announcement would not match what a sighted user sees at the same position. Three existing tests had encoded this mismatch as the expected behavior (one titled "…with true ARIA indexes", asserting an `aria-colindex` sequence that directly contradicted the `style.gridColumn` sequence asserted two lines above it in the same test). Fixed by deriving `aria-colindex` from each column's position in the actual rendered pin-grouped order (`columnModel.renderColumns`' `renderIndex`, looked up by column key so it stays correct even when `virtualizeColumns` only renders a subset) instead of the pre-pin-grouping `colIndex` field, which has been removed. Regression tests: `data-grid-aria.test.ts` ("assigns aria-colindex by rendered pin-grouped order, not declaration order"), plus corrected expectations in `data-grid.test.ts` and `data-grid-virtualizer.test.ts`'s existing pinned-column tests.
2. **A pointer-only resize or reorder could leave `aria-activedescendant` pointing at an unfocused grid (real defect, fixed).** Finishing a pointer-driven column resize or reorder set `headerFocusColumnKey` (which drives `aria-activedescendant`) without moving real DOM focus onto the grid root. For a user whose very first interaction with a grid is a mouse drag (no prior cell click), the grid never actually holds focus, so `aria-activedescendant` — which only means anything to assistive technology while its host element has focus — was inert, and the next keydown would not even reach the grid's keyboard handler. Fixed by calling `gridElement?.focus({ preventScroll: true })` alongside `headerFocusColumnKey` in both `handleResizeHandlePointerUp` and `handleHeaderCellPointerUp`. Regression tests: `data-grid-column-interaction.test.ts` ("a pointer-only resize (no prior focus) leaves the grid holding real DOM focus", "a pointer-only reorder (no prior focus) leaves the grid holding real DOM focus").
3. **Entering edit mode moving real focus into the Input was documented but untested (coverage gap, closed).** The documented behavior — Enter/double-click moves real DOM focus into the editing Input, cursor at the end of the value — was implemented correctly but had no regression test, so a future change could silently break it without failing any test. Closed with `data-grid-editing.test.ts` ("Enter moves DOM focus into the editing Input with the cursor at the end of the value", "double-click moves DOM focus into the editing Input").
4. **Everything else checked out.** Commit/cancel focus-return-to-grid (Enter, Tab, Escape) was already covered and correct. `aria-sort` is applied only to the primary sort column, matching the single-column intent of the ARIA `aria-sort` property, and is unaffected by reorder since it's looked up by column key, not position. `aria-rowindex`/`aria-rowcount` track sorted order and the full (non-virtualized) row count correctly. The resize handle's `role="separator"` + `aria-valuenow`/`min`/`max` and the live-region announcement text for resize/reorder/zoom/search/copy were all correct as documented. Search's use of the live region instead of `aria-activedescendant` while focus stays in the search field is an intentional, documented design (see [Search](#search) above), not a defect.

**Residual risk.** None identified that block shipping. The `aria-colindex` fix in particular should be re-checked if a future change adds a third pin group or otherwise changes how `columnModel.renderColumns` orders columns, since `aria-colindex` now depends on that ordering being the actual rendered order by construction rather than by a separately-maintained index.
