# DatePicker accessibility notes

## Role and label association

The trigger is `<input type="text" readonly role="combobox">`. Screen readers announce it as a combobox, which matches the APG "Date Picker Combobox" pattern. The `for` attribute on `<label>` associates with the input `id`.

The calendar popover is `<dialog role="dialog" aria-modal="false">`. Its accessible name comes from `aria-label="{label} — calendar"` (e.g., "Departure date — calendar").

## Keyboard interaction

### Trigger (input, popover closed)

| Key                           | Action                              |
| ----------------------------- | ----------------------------------- |
| `ArrowDown` / `Alt+ArrowDown` | Open popover, focus the initial day |
| `Space` / `Enter`             | Open popover, focus the initial day |

### Calendar grid (popover open)

| Key                              | Action                                                                |
| -------------------------------- | --------------------------------------------------------------------- |
| `ArrowLeft` / `ArrowRight`       | Move focus one day; crosses month boundaries                          |
| `ArrowUp` / `ArrowDown`          | Move focus one week; crosses month boundaries                         |
| `Home`                           | First day of the current grid row (respects locale first-day-of-week) |
| `End`                            | Last day of the current grid row                                      |
| `PageUp`                         | Previous month; same day-of-month (clamped)                           |
| `PageDown`                       | Next month; same day-of-month (clamped)                               |
| `Ctrl+PageUp` / `Cmd+PageUp`     | Previous year                                                         |
| `Ctrl+PageDown` / `Cmd+PageDown` | Next year                                                             |
| `Enter` / `Space`                | Select focused day                                                    |
| `Escape`                         | Close popover; return focus to trigger                                |

The calendar grid is one Tab stop using roving tabindex. All day-of-month buttons have `tabindex=-1` except the focused one which has `tabindex=0`.

## Focus management

On open, focus lands on:

1. The selected value (if in range)
2. Today (if in range)
3. The nearest in-range boundary (`min` or `max`)

On close, focus returns to the trigger input via `restoreFocusTo`.

There is **no focus trap**. Tab from the close button moves to the next focusable element in document order. This is intentional — the popover is non-modal.

## ARIA states

- Trigger: `aria-haspopup="dialog"`, `aria-expanded`, `aria-controls`, `aria-invalid`, `aria-required`, `aria-describedby`
- Grid: `role="grid"`, `aria-labelledby` → month title `<h2>`
- Column headers: `<th scope="col" abbr={fullDayName}>` (screen readers read the full name)
- Day buttons: `role="gridcell"`, `aria-selected`, `aria-disabled`, `aria-label` (full localized date), `aria-current="date"` on today
- Disabled days: `aria-disabled="true"` on the button element (NOT native `disabled`) so roving focus can still reach them
- Live region: `aria-live="polite"` announces the new month name after navigation

## Range highlight — not color only

Range endpoints use `data-range-start` and `data-range-end` data attributes in addition to `aria-selected`. CSS uses these attributes to apply a distinct border on each endpoint so forced-colors / high-contrast users see the boundary without relying on background color.

In-range cells use `data-in-range`. Both endpoints are `aria-selected="true"`; intermediate in-range cells are not selected but are visually highlighted and marked by the data attribute.

## Readonly combobox rationale

The trigger is `readonly`, not `disabled`, and carries `role="combobox"`. This matches the APG "Date Picker Combobox" example:

- `disabled` would prevent focus and announcement as a combobox
- An editable text input would require a locale-aware parser (deferred to v2)
- `readonly + role="combobox"` lets the field receive focus, announce its value, and participate in form constraint validation

## Forced colors / high-contrast

- Range endpoints use a left/right border set via `data-range-start` and `data-range-end` — visible in forced-colors where background-based highlights collapse
- Selected day border is 1px solid `currentColor` so it remains visible when the accent background is suppressed
- Focus ring uses `box-shadow` with `var(--cinder-ring-color)` — CSS custom properties may revert to system highlight in forced-colors; the `:focus-visible` outline fallback (`outline: var(--cinder-ring-width) solid transparent`) provides the minimum platform-required indicator
