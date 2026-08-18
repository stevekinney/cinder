# JsonSchemaEditor · accessibility

## Pattern

JsonSchemaEditor is a multi-view editor for authoring JSON Schema documents with form, raw JSON, and diff modes, undo history, and validation. The form view presents schema properties as a nested list of disclosure rows, not as a data table.

## Use when

- Letting users edit a JSON Schema with a guided form alongside the raw source.
- Reviewing schema changes against a baseline via the built-in diff view.

## Avoid when

- Editing arbitrary free-form JSON with no schema semantics — use a plain code editor instead.

## Property-list interaction model

Each property is a `div` row containing a native disclosure button and sibling action buttons. The disclosure is intentionally not `details`/`summary`: the sibling controls would otherwise create interactive controls inside `summary`. Expanding a row reveals the property-name input and its nested `PropertyEditor`; nested object properties render another `PropertyList` within that panel.

The disclosure button has an explicit name such as `Expand address property` or `Collapse address property`, plus `aria-expanded` and `aria-controls` pointing to the revealed panel. Required, reorder, and delete actions remain separate native buttons. Reorder labels include the affected property name, for example `Move address up`, so identical icon-only controls remain distinguishable in a screen-reader rotor.

## Enum values

The `Enum values` checkbox enables an editable semantic table. Each row contains a labelled JSON-value input plus move and remove buttons. The table has the accessible name `Enum values`; row controls identify their one-based value position, such as `Move enum value 2 up`, rather than relying on the visible icon or its table position. Invalid JSON stays in its input and is announced as an alert until it can be committed.

## Keyboard and focus

All property-list controls use their native button and input keyboard behavior.

- `Tab` and `Shift+Tab` move through enabled disclosure, required-toggle, reorder, and delete controls, then the revealed editor controls when a row is expanded. The unavailable direction on the first or last row, and all disabled controls in read-only or dirty-JSON form state, are skipped by native sequential navigation.
- `Enter` and `Space` activate the disclosure, required, reorder, and delete buttons.
- `Tab` and `Shift+Tab` also move through the enabled enum value input and its move or remove controls. The first Up and last Down controls are disabled and skipped.
- Expanding or collapsing leaves focus on the disclosure button; it does not move focus into or out of the panel.
- Editable property names commit when their input loses focus. Text-entry keys remain native input behavior.
- `Cmd+Z`, `Shift+Cmd+Z`, and `Cmd+Y` undo and redo on macOS. `Ctrl+Z`, `Shift+Ctrl+Z`, and `Ctrl+Y` provide the corresponding shortcuts elsewhere. They act only outside editable text controls, so native text-editing shortcuts remain available while focus is in an input.

Keep focus indicators visible. If you wrap or restyle JsonSchemaEditor, verify the focused element remains visually apparent in default and forced-colors modes.

## Names, roles, and state

The disclosure’s accessible name includes the property key and, when present, its nested validation-error count. Its `aria-expanded` state conveys whether its controlled panel is visible. The required toggle exposes its pressed state and an accessible name that explains the next action. Disabled controls communicate the read-only and dirty-JSON states through their native disabled state.

Nested validation is announced through the disclosure name and a danger badge labelled with the error count and property key. Reordering commits the new schema order, updates the form/JSON/diff views, leaves focus on the named control, and announces the property’s resulting position. Deleting a property announces the deletion and moves focus to the next property, previous property, or Add property when the list becomes empty.

The enum editor keeps an invalid raw value local so it cannot corrupt the committed schema. A valid JSON value, an enum reorder, or a removal commits through the same form-state path as every other form edit, keeping JSON and diff views synchronized.

Do not rely on color, icon shape, placeholder text, or layout position as the only way to communicate state or available actions.

When JsonSchemaEditor accepts snippets or arbitrary children, the caller owns the semantics inside those children. Prefer native elements first, and add ARIA only when it matches the rendered behavior.

## Verification

- Automated: `bun run --filter=@lostgradient/cinder test -- property-list.test.ts` verifies disclosure resting semantics, property-specific reorder names, and resulting order.
- Automated: `bun run --filter=@lostgradient/cinder test -- enum-editor.test.ts` verifies the enum table’s resting state, JSON-value validation, and resulting reorder state.
- Automated: `bun run --filter=@cinder/testing test:playwright -- editors-complex-residual.playwright.ts --grep "JSON commits surface editable enum values"` verifies JSON-to-form synchronization in a browser.
- Automated: `bun run --filter=@lostgradient/cinder test -- json-schema-editor-state.svelte.test.ts` verifies form and JSON commits, validation hooks, undo/redo history, diff baselines, dirty-draft handling, and `draftOverride` behavior.
- Manual browser check: tab through a nested object row, expand and collapse it with `Enter` and `Space`, then confirm focus remains on the disclosure and the nested panel controls join the tab order.
- Manual browser check: use a screen reader to confirm property-specific disclosure and reorder names, expanded state, nested-validation counts, and disabled controls in read-only or dirty-JSON form state.
- Manual browser check: check forced-colors mode when the component adds borders, focus rings, selected state, or status color.
