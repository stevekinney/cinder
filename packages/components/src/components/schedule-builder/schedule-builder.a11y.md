# ScheduleBuilder accessibility

## Pattern

The root element is `role="group"` labeled by the `label` prop (default `"Schedule"`), `aria-label`, or `aria-labelledby`. Inside it, the top-level authoring-mode switch (Presets / Cron / Interval) follows the [WAI-ARIA Tabs pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/): a `SegmentedControl` with `variant="tablist"` renders the three tabs, and the currently active mode's panel is `role="tabpanel"` with `aria-labelledby` pointing back at its tab.

Unlike the reference tabs implementation (which keeps every panel mounted and toggles `hidden`), ScheduleBuilder mounts only the ACTIVE panel's content. This is a deliberate, accepted variation on the pattern (the same choice several mainstream headless tab implementations make): several fields share the same visible label text across panels (`"Every"` / `"Unit"` appear in both the "every N" preset and interval mode), so keeping inactive panels in the DOM would produce duplicate label text for assistive technology and text-based "find in page" navigation. Switching modes re-seeds the destination panel from the last _committed_ recurrence value (what was last emitted via `onchange`, or the initial `value`), so a mode's committed recurrence is preserved when you return to it. An uncommitted, in-progress edit — for example a half-typed invalid cron field that has not emitted a change — is not carried across a mode switch.

The preset-kind selector inside Presets mode (Every N / Daily / Weekly / Monthly) is a second, nested `SegmentedControl` using the default `variant="radiogroup"` (not tablist) — it is a single-choice selector that reveals a different subset of ordinary form fields below it, not a switch between independently-owned panels.

## Roles names states

- The mode tabs (`SegmentedControl` `variant="tablist"`) render `role="tab"` on each `Segment`, with the selected tab's tabpanel matched via `aria-controls` / `aria-labelledby`. See `segmented-control.a11y.md` for the full tab pattern.
- The preset-kind selector renders `role="radiogroup"` with `role="radio"` children — see `segmented-control.a11y.md`.
- Every text/number/time field (`Input`, `NumberInput`, `TimeField`) carries its own `<label for>` association, so `getByLabelText`-style lookup and screen-reader field announcement both work out of the box.
- Each of the five cron fields (`Input`) is labeled with its field name (`Minute`, `Hour`, `Day of month`, `Month`, `Day of week`), has a persistent hint (`description`, e.g. `"0–59"`) associated via `aria-describedby`, and gets an inline `error` message plus `aria-invalid="true"` the moment `validateCronField` rejects the current text. Hint and error are both wired into the same `aria-describedby` chain (`Input`'s own field-control resolver), so assistive technology announces the hint and, when present, the error together.
- The weekly preset's day-of-week chips are `Chip` `mode="toggle"` buttons (`aria-pressed`) inside a `role="group"` labeled `"Days of week"`. Each chip shows the short day name (`"Mon"`) but carries the full day name (`"Monday"`) as its `aria-label` so the accessible name isn't a potentially ambiguous abbreviation.
- The summary line is a `<dl>`/`<dt>`/`<dd>` pair (`"Summary"` term, plain-English description as the definition) — always present, updates live as any field changes.
- The next-fires preview, when `computeNextFires` is supplied, is a labeled `<ul>` (`aria-labelledby` pointing at a visible `"Upcoming fires"` label) of `<li>` rows keyed by `ScheduleFire.id`. An empty result renders a `"No upcoming fires."` paragraph instead of an empty list.
- The timezone slot is a second `<dl>`/`<dt>`/`<dd>` pair (`"Timezone"` term). It renders the `timezone` snippet when provided, else `timezoneLabel` text, else an italic `"Not set"` placeholder — never nothing, so the always-visible contract holds even with no timezone information supplied.

## Keyboard

| Key                           | Action                                                                                                         |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `Tab` / `Shift+Tab`           | Move focus between the mode tablist, the preset-kind radiogroup, and each visible field.                       |
| `ArrowLeft` / `ArrowRight`    | Move focus and selection between mode tabs (horizontal tablist), and between preset-kind options (radiogroup). |
| `Space` / `Enter`             | Activate a focused day-of-week chip; commit a focused numeric field's stepper adjustment.                      |
| Native text/number/time entry | Standard browser editing keys apply inside `Input`, `NumberInput`, and `TimeField`.                            |

## Mouse / pointer

Clicking a mode tab switches the visible panel. Clicking a preset-kind option switches the visible field subset. Clicking a day-of-week chip toggles its inclusion in the weekly preset. All other interaction is standard native form-control pointer behavior (typing, native number steppers, native time picker affordances).

## Hard scope caps

- ScheduleBuilder computes no dates and ships no cron-parsing or scheduling library. The next-fires preview is entirely consumer-supplied via `computeNextFires`; when that prop is omitted, the preview section is not rendered at all (not rendered-but-empty) so the component never implies a capability it doesn't have.
- Cron-field validation is limited to `validateCronField`'s supported grammar (wildcard, step, range, comma list, plain number) — it does not validate cross-field semantics (e.g. day-of-month 31 in February).
- Overlap policy, jitter, and backfill are explicitly out of scope; nothing in this component's markup implies their presence.
- No autofocus on mount, and no focus management on mode or preset-kind switch beyond the browser's default (focus stays on the control that was activated).
