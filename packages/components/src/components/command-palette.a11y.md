# CommandPalette — Accessibility Notes

## Pattern Reference

The command palette composes two WAI-ARIA patterns:

- **Dialog** (`role="dialog"`, `aria-modal="true"`) — provides a focus trap via `<dialog showModal()>` and a visible backdrop.
- **Combobox + Listbox** — the `<input role="combobox">` owns virtual focus. `aria-activedescendant` points at the active `<li role="option">` so screen readers announce the currently highlighted item without moving DOM focus out of the input.

Reference: [WAI-ARIA APG Combobox Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/) and [Dialog Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).

## Roles and Accessible Names

| Element | Role | Accessible Name Source |
|---------|------|------------------------|
| `<dialog>` | `dialog` (implicit) | `aria-label` from the `label` prop |
| `<input>` | `combobox` (explicit) | Unlabelled — the dialog's `aria-label` provides context; consumers may add a visible `<label>` |
| `<ul>` | `listbox` (explicit) | `aria-label` duplicated from the `label` prop |
| `<li>` | `option` (explicit) | Text content of the `children` snippet |

## Virtual Focus Model

**Focus never moves into the list.** The combobox input is the screen reader's anchor from the moment the dialog opens until it closes. `aria-activedescendant` on the input is updated to the id of the highlighted option. Screen readers announce the newly-active option name as the user arrows through the list.

This is the same model documented in the APG combobox pattern and already used by `combobox.svelte`.

Invariants asserted in tests:

1. `document.activeElement` is the search input from open to close.
2. Exactly one `<li>` has `aria-selected="true"` when any item is active; zero when no items match.
3. `aria-activedescendant` on the input matches the `id` of the `aria-selected` `<li>`, or is absent when no items match.
4. Disabled items never become the active descendant — arrow keys skip them.

## Keyboard Contract

| Key | Behavior |
|-----|----------|
| `ArrowDown` | Move active item to next non-disabled; wrap to first if at end. `preventDefault`. |
| `ArrowUp` | Move active item to previous non-disabled; wrap to last. `preventDefault`. |
| `Home` | Move active item to first non-disabled. `preventDefault` (prevents caret jump). |
| `End` | Move active item to last non-disabled. `preventDefault`. |
| `Enter` | Invoke the active item's `onselect`. `preventDefault` (prevents form submission). |
| `Escape` | Close the palette via the shared escape stack. Single-sourced through `closePalette()`. |
| `Tab` / `Shift+Tab` | Native `<dialog>` focus trap (browser-level). Focus cycles through interactive elements in the panel and footer. |
| Typing | Updates `query` (bindable). Items snippet re-renders with the new query. |

## Mouse / Pointer Parity

- `pointerenter` on a non-disabled item moves the active item id (parity with arrow keys).
- `pointerdown` calls `event.preventDefault()` to keep focus on the input.
- `click` on a non-disabled item invokes `onselect`. Disabled items: no-op.

## Backdrop Click

Clicking the `<dialog>` element itself (the backdrop area) closes the palette. Clicks on the panel, input, listbox, items, or footer do not close it — their `event.target` never equals the dialog element.

## `aria-expanded` on the Combobox

Per the APG pattern, `aria-expanded` reflects listbox visibility. In a command palette the listbox is always structurally visible while the dialog is open, so `aria-expanded="true"` is hard-coded. The value never toggles while the dialog is open.

## Empty State

The empty state renders inside a `role="status"` region so screen readers announce "No results" without stealing focus. It is gated behind a one-microtask delay (`registrationsReady`) to prevent a false "No results" flash during initial open or when a query change causes a full key-swap of items.

## Reduced Motion

Panel enter/exit transitions are gated behind `@media (prefers-reduced-motion: no-preference)`. An opacity-only fallback applies under `prefers-reduced-motion: reduce`.

`backdrop-filter: blur()` is a separate capability/performance decision gated via `@supports (backdrop-filter: blur(1px))` — this is a capability check, not a motion check. A solid-fill backdrop is the fallback for browsers that lack it.

## Grouped Sections (v1)

v1 ships the flat-list pattern only. Consumers can render visually-styled "section header" `<li role="presentation">` elements between groups. Group affiliation is purely visual — all items remain direct children of the same `<ul role="listbox">` and are announced as options of that listbox.

Nested `role="group"` semantics are explicitly out of scope for v1. They require real screen-reader verification before being declared canonical.

## Non-Goals (v1)

- Built-in fuzzy search — consumers filter their own data via the `items` snippet.
- Virtualization — virtual focus requires `aria-activedescendant` to point at a rendered DOM node.
- Pages / nested navigation.
- Global Cmd+K listener — the consumer wires the keybinding and toggles `open`.
