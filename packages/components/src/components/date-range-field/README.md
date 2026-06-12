# DateRangeField

Controlled start/end date range picker with preset shortcuts and validation feedback, designed for time-window filtering on dashboards, event streams, and audit logs.

## Overview

`DateRangeField` renders two native date inputs (start and end) along with a row of preset shortcut buttons (Today, Yesterday & today, Last 7 days by default). It is fully controlled: the consumer owns the `value` and responds to `onchange` callbacks. It does not own routing, query-string synchronization, or data fetching.

**v1 ships date-only.** Dates are expressed as ISO-8601 date strings (`YYYY-MM-DD`). Date-time support (hours, minutes, seconds, timezone) is a planned follow-up — it doubles the surface area with timezone complexity and time-picker UI. See the open GitHub issue for tracking demand.

## Usage

```svelte
<script lang="ts">
  import { DateRangeField } from '@lostgradient/cinder/date-range-field';
  import type { DateRangeValue } from '@lostgradient/cinder/date-range-field';

  let range: DateRangeValue = $state({ start: undefined, end: undefined });
</script>

<DateRangeField
  id="event-time-filter"
  label="Time window"
  bind:value={range}
  onchange={(next) => {
    range = next;
  }}
/>
```

### With custom presets

```svelte
<script lang="ts">
  import { DateRangeField } from '@lostgradient/cinder/date-range-field';
  import type { DateRangeDatePreset, DateRangeValue } from '@lostgradient/cinder/date-range-field';

  let range: DateRangeValue = $state({ start: undefined, end: undefined });

  const presets: DateRangeDatePreset[] = [
    {
      id: 'today',
      label: 'Today',
      resolve: () => {
        const today = new Date().toISOString().slice(0, 10);
        return { start: today, end: today };
      },
    },
    {
      id: 'this-month',
      label: 'This month',
      resolve: () => {
        const now = new Date();
        const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
        const end = now.toISOString().slice(0, 10);
        return { start, end };
      },
    },
  ];
</script>

<DateRangeField id="billing-filter" label="Billing period" {presets} bind:value={range} />
```

### With validation error

```svelte
<script lang="ts">
  import { DateRangeField } from '@lostgradient/cinder/date-range-field';
  import type { DateRangeValue } from '@lostgradient/cinder/date-range-field';

  let range: DateRangeValue = $state({ start: undefined, end: undefined });

  let error = $derived(
    range.start && range.end && range.start > range.end
      ? 'Start date must be on or before the end date.'
      : undefined,
  );
</script>

<DateRangeField id="validated-filter" label="Date range" bind:value={range} {error} />
```

## Props

```
id           string               no        Unique identifier for label and ARIA wiring. Generated via `$props.id()` when omitted.
value        DateRangeValue       no        Current range. Bindable. Both fields start undefined.
label        string               no        Visible legend rendered above the inputs.
startLabel   string               no        Label for the start input. Default: "Start date".
endLabel     string               no        Label for the end input. Default: "End date".
presets      DateRangeDatePreset[]  no      Custom preset buttons. Defaults to today, yesterday-today, last-7d.
hidePresets  boolean              no        When true, hides the preset row. Default: false.
description  string               no        Helper text below the field, wired via aria-describedby.
error        string               no        Validation error. Sets aria-invalid="true" on inputs.
disabled     boolean              no        Disables all inputs and preset buttons. Default: false.
class        string               no        Additional CSS classes on the root element.
onchange     (value) => void      no        Called when the range changes via preset or manual input.
```

## Types

```ts
type DateRangeValue = {
  start: string | undefined; // ISO-8601 date: YYYY-MM-DD
  end: string | undefined; // ISO-8601 date: YYYY-MM-DD
};

type DateRangeDatePreset = {
  id: string;
  label: string;
  resolve: () => DateRangeValue;
};
```

## Accessibility

The component implements accessible form labelling throughout:

- Each date input is associated with a `<label>` via `for`/`id`.
- The optional legend (`label` prop) is a `<p>` associated with the group visually.
- The preset button row carries `role="group"` with `aria-label="Date range presets"`.
- Each preset button carries `aria-pressed` to communicate current selection state to assistive technology.
- The error region uses `aria-live="polite"` and is always in the DOM so screen readers reliably pick up the live region before text is injected.
- When `error` is set, both inputs carry `aria-invalid="true"`.
- The root carries `role="group"` and `aria-labelledby` pointing to the legend element when a `label` prop is provided, associating the label with the start/end input group.
- `description` and `error` elements are wired into each input via `aria-describedby`, so a screen reader user tabbing to an input hears the description and any active error.
- Forced-colors (Windows High Contrast) mode: inputs and preset buttons receive a solid `outline` instead of `box-shadow` focus rings, which are ignored in that mode.

## v1 scope limits

Date-time support (hours/minutes/seconds/timezone) is out of scope for v1. The added complexity of timezone handling and a time-picker UI warrants a separate design iteration. The `DateRangeValue` type uses ISO-8601 date strings (`YYYY-MM-DD`) only.

If your use case requires sub-day precision, please add a comment on the GitHub issue to register demand for date-time mode.
