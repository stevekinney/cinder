# Calendar accessibility notes

- Uses the WAI-ARIA date-picker grid pattern:
  - `role="grid"` on the calendar table.
  - `role="row"` for each week.
  - `role="gridcell"` with a focusable button per day.
- Keyboard support:
  - Arrow keys move one day/week.
  - `Home` / `End` move to week boundaries.
  - `PageUp` / `PageDown` move one month.
  - `Enter` / `Space` selects focused date.
- Disabled days expose `aria-disabled="true"` and are not selectable.
