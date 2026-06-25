# DateRangeField · accessibility

## Pattern

No single WAI-ARIA Authoring Practices pattern covers a date range field exactly. The component follows the [group pattern](https://www.w3.org/WAI/ARIA/apg/patterns/) for the preset row and native `<input type="date">` or `<input type="datetime-local">` semantics for the range inputs, combining them into a single fieldset-like region.

## Roles names states

- The root `<div>` has `role="group"` and `aria-labelledby` pointing to the legend element id, so the field as a whole is named when a `label` prop is provided.
- The optional legend is a `<p>` with an id that is referenced by `aria-labelledby` on the root group. It visually and programmatically labels the start/end input group.
- The preset row is a `<div role="group" aria-label="Date range presets">`. Each preset is a `<button type="button">` with `aria-pressed` reflecting whether it is currently the active selection.
- Start and end inputs are native date or datetime-local elements based on `granularity`. Each is associated with a `<label for="{id}">`. Both inputs carry `aria-describedby` composed from the description and error element ids, so a screen reader user tabbing to an input hears the description and any active error. When `error` is set, both also carry `aria-invalid="true"`.
- The description paragraph carries the id referenced by `aria-describedby` on each input.
- The error paragraph carries `aria-live="polite"`. It is always present in the DOM (never conditionally rendered) so the live region is registered before any text is injected. When no error is active it is visually hidden via CSS but remains in the accessibility tree.

## Keyboard

| Key   | Action                                                        |
| ----- | ------------------------------------------------------------- |
| Tab   | Move focus between preset buttons, start input, and end input |
| Space | Activate the focused preset button (toggle `aria-pressed`)    |
| Enter | Activate the focused preset button (toggle `aria-pressed`)    |

Date and date-time inputs themselves expose the browser's native picker. The exact keyboard behavior inside the picker widget is browser-controlled and out of scope for this component.

## Mouse / pointer

Clicking a preset button applies that preset's resolved range, sets `aria-pressed="true"` on the clicked button, and calls `onchange`. Clicking either input opens the browser's native picker. Changing an input value manually clears the active preset selection.

## Hard scope caps

- **Timezone conversion is caller-owned.** Date-time values are local wall-clock strings from native `datetime-local` inputs, not timezone-aware instants.
- **The picker UI is browser-native.** Keyboard navigation inside the calendar or date-time widget is not specified or tested by this component — it is the browser's responsibility.
- **No range constraint enforcement.** The component sets `min`/`max` on the inputs to hint the browser's picker (end min = start, start max = end), but does not block the user from entering out-of-order dates programmatically. Validation is the consumer's responsibility via the `error` prop.
- **No year/month range limits.** Consumers who need to restrict the selectable date range should pass `error` after validating the emitted value.
