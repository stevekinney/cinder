# DateRangeField · accessibility

## Pattern

No single WAI-ARIA Authoring Practices pattern covers a date range field exactly. The component follows the group pattern for the preset row and custom calendar/time dialog semantics for the range inputs.

## Roles names states

- The root `<div>` has `role="group"` and `aria-labelledby` pointing to the legend element id, so the field as a whole is named when a `label` prop is provided.
- The optional legend is a `<p>` with an id that is referenced by `aria-labelledby` on the root group. It visually and programmatically labels the start/end input group.
- The preset row is a `<div role="group" aria-label="Date range presets">`. Each preset is a `<button type="button">` with `aria-pressed` reflecting whether it is currently the active selection.
- Start and end inputs are text elements backed by custom calendar/time dialogs. Each is associated with a label and carries `aria-describedby` composed from description and error ids.
- The description paragraph carries the id referenced by `aria-describedby` on each input.
- The error paragraph carries `aria-live="polite"`. It is always present in the DOM (never conditionally rendered) so the live region is registered before any text is injected. When no error is active it is visually hidden via CSS but remains in the accessibility tree.

## Keyboard

| Key   | Action                                                        |
| ----- | ------------------------------------------------------------- |
| Tab   | Move focus between preset buttons, start input, and end input |
| Space | Activate the focused preset button (toggle `aria-pressed`)    |
| Enter | Activate the focused preset button (toggle `aria-pressed`)    |

The custom calendar and time dialogs expose the picker interaction and keyboard behavior.

## Mouse / pointer

Clicking a preset button applies that preset's resolved range, sets `aria-pressed="true"` on the clicked button, and calls `onchange`. Clicking a calendar trigger opens the custom picker. Changing an input value manually clears the active preset selection.

## Hard scope caps

- **Timezone conversion is caller-owned.** Date-time values are local wall-clock strings, not timezone-aware instants.
- **The picker UI is component-owned.** Calendar and time dialog interaction is exposed by the custom controls.
- **No range constraint enforcement.** The component sets `min`/`max` on the inputs to hint the browser's picker (end min = start, start max = end), but does not block the user from entering out-of-order dates programmatically. Validation is the consumer's responsibility via the `error` prop.
- **No year/month range limits.** Consumers who need to restrict the selectable date range should pass `error` after validating the emitted value.
