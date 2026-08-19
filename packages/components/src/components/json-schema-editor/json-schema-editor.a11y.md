# JsonSchemaEditor · accessibility

## Pattern

JsonSchemaEditor is a multi-view editor for authoring JSON Schema documents with form, raw JSON, and diff modes, undo history, and validation. The form view presents schema properties as a semantic `table` whose rows expand into nested tables — one nesting level per object depth.

## Use when

- Letting users edit a JSON Schema with a guided form alongside the raw source.
- Reviewing schema changes against a baseline via the built-in diff view.

## Avoid when

- Editing arbitrary free-form JSON with no schema semantics — use a plain code editor instead.

## Why a table and not a grid

The property list is a native `table`, not `role="grid"`. Every interactive control inside a cell stays in the natural tab order; no roving tabindex is layered on top. This follows the pattern the enum table already established in this component: cells hold text inputs, checkboxes, and buttons, and a spreadsheet-style two-dimensional arrow-key model would take `ArrowLeft`/`ArrowRight` away from editing inside those controls in exchange for a navigation style this editor doesn't otherwise use.

The cost is a long tab sequence on a wide schema. That's mitigated by collapsing: a collapsed row contributes five tab stops (disclosure, required checkbox, move up, move down, delete); nested rows contribute none until expanded. The other accepted cost is that screen-reader table-navigation commands (for example JAWS/NVDA's table cell movement) don't cross the nesting boundary — reaching a nested table's cells means entering it explicitly, the same way entering any nested table does.

## Structure

The property table has the accessible name `Schema properties`. A nested table takes the name of its owning property, for example `Properties of address`, so a screen-reader table list distinguishes nested tables from the root and from each other without depending on nesting depth.

| Column | Header | Contents |
| ------ | ------ | -------- |
| 1 | `Property key` | `<th scope="row">` holding the disclosure button, whose own text is the property key. |
| 2 | `Type` | The type summary text (for example `string`, `object`, `array of string`). |
| 3 | `Description` | The schema's `description`, when present. |
| 4 | (visually hidden) `Actions` | Required checkbox, move up, move down, and delete. |

Every header cell uses `<th scope="col">`, so a screen reader announcing a cell also announces its column ("Type: object"). A row with nested validation errors carries `data-cinder-invalid` and shows a danger badge in the key cell, labelled with the error count and the property key.

Below depth 0, the `<thead>` stays in the DOM — so `<th scope="col">` associations still hold for every cell — but is visually hidden. Nesting a header band inside every expanded row would repeat the same four column names at every depth for no benefit; the table's `aria-label` already carries the identifying information a nested table needs.

An expanded row's detail is a sibling `<tr>` whose single `<td>` spans all four columns (`colspan="4"`). That cell holds the property-name input, the type and constraint editors, and — for an object property — the nested `Properties of <key>` table. The `aria-live` announcement paragraph, the rename error `Alert`, and the `Add property` button all render outside the `<table>` element; a `<table>` only validly contains `<caption>`/`<thead>`/`<tbody>`/`<tfoot>`/`<tr>`, and a stray child would be silently reparented by the HTML parser.

## Focus management

Focus is never moved on mount, on SSR, or on any change originating outside the user's own action.

| Action | Where focus goes |
| ------ | ----------------- |
| Expand a row | Stays on the disclosure button, which is now `Collapse <key> property` with `aria-expanded="true"`. Focus does not enter the revealed row. |
| Collapse a row | Stays on the disclosure button. |
| Move a row up or down | Stays on the pressed control, which travels with the row to its new position. A move that lands the row first or last disables that direction's control; focus does not jump elsewhere. |
| Delete a row | Moves to the next row's disclosure button; if the deleted row was last, to the previous row's; if the table is now empty, to the `Add property` button. |
| Add a property | The new row opens expanded, with focus placed in its property-name input. |
| Rename a property | Stays in the name input. The rename commits on blur. |

Whenever a focused element disappears (delete, undo/redo shrinking the table), focus is placed explicitly rather than allowed to fall to `document.body` — a silent drop to `body` would send the next `Tab` back to the top of the page.

Keep focus indicators visible. If you wrap or restyle JsonSchemaEditor, verify the focused element remains visually apparent in default and forced-colors modes.

## Keyboard

All property-table controls use their native button, checkbox, and input keyboard behavior. No key is intercepted inside the table except the two undo shortcuts, and those are suppressed while focus is in an editable text control.

- `Tab` and `Shift+Tab` move through enabled controls in reading order: disclosure, required, move up, move down, delete — then, if the row is expanded, its detail controls (including any nested table) — then the next row. Disabled controls, and all controls in read-only or dirty-JSON form state, are skipped by native sequential navigation.
- `Enter` and `Space` activate the disclosure, move, and delete buttons.
- `Space` toggles the required checkbox. `Enter` does not — that's native checkbox behavior and isn't overridden.
- `Tab` and `Shift+Tab` also move through the enabled enum value input and its move or remove controls. The first Up and last Down controls are disabled and skipped.
- Editable property names commit when their input loses focus. Text-entry keys remain native input behavior.
- `Cmd+Z`, `Shift+Cmd+Z`, and `Cmd+Y` undo and redo on macOS. `Ctrl+Z`, `Shift+Ctrl+Z`, and `Ctrl+Y` provide the corresponding shortcuts elsewhere. They act only outside editable text controls, so native text-editing shortcuts remain available while focus is in an input.

## Names, roles, and state

| Control | Role | Accessible name | State |
| ------- | ---- | ---------------- | ----- |
| Property table | `table` | `Schema properties` (root) or `Properties of <key>` (nested) | — |
| Enum table | `table` | `Enum values` | — |
| Disclosure | `button` | `Expand <key> property` / `Collapse <key> property`, suffixed with `, N validation errors` when the row has nested errors | `aria-expanded`; `aria-controls` present only while the detail row is rendered |
| Type | `combobox` | `<key> type` (visually hidden — a "Type" heading labels the section) | value is `any`, a concrete type, `enum`, or `multiple` |
| Required | `checkbox` | `<key>` | `checked` |
| Move up / down | `button` | `Move <key> up` / `Move <key> down` | `disabled` at the ends of the table, in read-only mode, and while a JSON draft is dirty |
| Delete | `button` | `Delete <key>` | `disabled` in read-only mode and while a JSON draft is dirty |
| Validation badge | — | `N validation errors in <key>` | — |
| Enum value input | `textbox` | `Enum value <n>` | `aria-invalid` and `aria-describedby` while the draft is unparseable or duplicate |
| Enum description input | `textbox` | `Enum value <n> description` | plain text, no validation |
| Enum move / remove | `button` | `Move enum value <n> up` / `down`, `Remove enum value <n>` | `disabled` at the ends, while any enum draft is invalid, and when one value remains |

Reorder and delete controls repeat identically on every row, so each one carries the property key in its name — without that, a screen-reader control list reads as a column of indistinguishable "Move up" entries.

The required control's accessible name is the bare property key, not `<key>: Required (toggle off)`. Naming it after the next action would make the name change on every toggle, which announces the change twice and breaks a reference a screen-reader user just built by name. It lives in the same visually-hidden `Actions` column as the reorder and delete buttons; a `checkbox` role already announces as "checkbox," so nothing else in the name needs to say "required" for it to be understood in context, and the row-header key told the user which row they're in before they got there.

The Type select covers `any`, `string`, `number`, `integer`, `boolean`, `enum`, `object`, and `array` directly. `type` may legitimately be a JSON array (`["string","null"]`) or bare `null`, neither of which a single-select value can represent; those states surface as a `multiple` option, and selecting it explicitly reveals the pre-existing multi-select checkbox row (the same one this select otherwise replaces) so nothing the checkboxes could already express is lost. Selecting `enum` seeds a default `['']` and reveals the enum table without touching `type`, so `type: 'string'` plus `enum` stays a string enum rather than losing its type. Selecting away from `enum` clears it.

The enum table's Description column has nowhere to live in a bare JSON Schema `enum` — it is just an array of values. Typing a description promotes the whole enum to `oneOf: [{const, description?}, …]`, which is real, valid JSON Schema in every supported draft; clearing every description demotes back to a bare `enum`. This is visible as a real schema change in the JSON and Diff views, not a hidden side effect. A `oneOf` that already looks like a real composition (any branch carrying a keyword other than `const`/`description`) is never treated as an enum — it renders through the ordinary composition editor instead, so an authored `oneOf` is never silently reinterpreted.

Do not rely on color, icon shape, placeholder text, or a control's column position as the only way to communicate state or available actions.

When JsonSchemaEditor accepts snippets or arbitrary children, the caller owns the semantics inside those children. Prefer native elements first, and add ARIA only when it matches the rendered behavior.

## Assistive-technology announcements

The property list owns one polite live region, rendered as a visually hidden paragraph outside the table. The enum table owns a separate one of its own.

- Reordering a property announces `Moved <key> property to position <n> of <total>.`
- Deleting a property announces `Deleted <key> property.`
- Adding a property is not announced through the live region — focus moves into the new row's name input, which is self-announcing.
- Expanding or collapsing is not announced through the live region; `aria-expanded` on the button already carries the state.
- Reordering, removing, or adding an enum value announces through the enum table's own live region (see the enum-editor test suite for exact wording).
- A row's validation error is announced assertively by that row's own `role="alert"` message when it appears, not routed through the polite region — a validation error is about the control being edited right now and should interrupt.
- Nested validation errors on a collapsed row are not announced; the count is folded into the disclosure button's accessible name and shown as a badge, discoverable on navigation rather than interrupting.

Reordering commits the new schema order and updates the form, JSON, and diff views together, so a subsequent read of any view reflects the same state.

## Verification

### Automated

- `bun run --filter=@lostgradient/cinder test -- property-list.test.ts` verifies the table's resting state (row count, column headers, per-row key/type), property-scoped control names, first/last and unrepresentable-move disabling, resulting key order after a reorder, the live-region reorder and delete messages, focus restoration after delete, nested-table reveal on expand, and `aria-controls` present only while the detail row is rendered.
- `bun run --filter=@lostgradient/cinder test -- enum-editor.test.ts` verifies the enum table's resting state, JSON-value validation, resulting reorder state, its move/remove/add announcements and focus targets, and that reordering, removing, and adding a value keep the parallel description array in sync with the value it belongs to.
- `bun run --filter=@lostgradient/cinder test -- enum-composition.test.ts` verifies the enum-as-`oneOf` predicate and the values/descriptions ↔ `enum`/`oneOf` mapping directly as pure functions — which representation is detected, that a real composition is never misdetected as an enum, and that promoting and demoting produce the exact expected patch.
- `bun run --filter=@lostgradient/cinder test -- json-schema-editor.test.ts` verifies the diff-tab changed-state indicator, the toolbar's role and labels, nested validation-count aggregation, and undo/redo via keyboard shortcut on the editor region.
- `bun run --filter=@lostgradient/cinder test -- json-schema-editor-state.svelte.test.ts` verifies form and JSON commits, validation hooks, undo/redo history, diff baselines, dirty-draft handling, and `draftOverride` behavior — this module has no DOM dependency and is unaffected by the table structure.
- `bun run --filter=@cinder/testing test:playwright -- editors-complex-residual.playwright.ts --grep "JSON schema editor"` verifies JSON-to-form and form-to-JSON synchronization in a browser, the toolbar's roving tabindex, the diff tab's accessible markup, the type selector switching to `enum` and revealing the enum table, selecting `Multiple types` seeding a starting array and revealing the checkbox row, typing an enum description promoting to `oneOf` and clearing it demoting back to a bare `enum`, and that a real `oneOf` composition renders its ordinary branch editors rather than being reinterpreted as an enum. The type-select and enum-description interactions are covered here rather than in `property-list.test.ts` — mounting them through a real browser sidesteps a happy-dom keyed-each reconciliation limitation the unit harness hits at this nesting depth.

### Manual verification only

These are not covered by any automated check and should be re-walked when the interaction model changes.

- Tab from the top of the editor to the bottom of a schema with two nesting levels and confirm the order is sequential, that collapsed rows contribute no hidden stops, and that no visibly-disabled control is reachable.
- Expand and collapse a nested object row with `Enter` and then with `Space`, and confirm focus stays on the disclosure button both times.
- Delete the last row of a table with a screen reader running, and confirm focus lands on the previous row's disclosure button and the deletion is announced.
- Reorder a row repeatedly and confirm each move announces, including two identical consecutive moves.
- Navigate into a nested table with a screen reader and confirm it announces entering a new table named for the owning property, with row/column counts scoped to that nested table rather than the parent's.
- Confirm a row-level validation alert interrupts, and that several simultaneous row errors don't produce an unusable cascade of assertive announcements.
- Check forced-colors mode for the table's row borders, the expanded-row background, focus rings, the danger badge, and disabled control state.
