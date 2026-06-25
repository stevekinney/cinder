# DateRangeField

Controlled start/end date range picker with preset shortcuts and validation feedback, designed for time-window filtering on dashboards, event streams, and audit logs.

## Overview

`DateRangeField` renders two native date or date-time inputs (start and end) along with a row of preset shortcut buttons (Today, Yesterday & today, Last 7 days by default). It is fully controlled: the consumer owns the `value` and responds to `onchange` callbacks. It does not own routing, query-string synchronization, timezone conversion, or data fetching.

Values are ISO-8601 local strings. `granularity="day"` emits `YYYY-MM-DD`; `granularity="hour"`, `"minute"`, and `"second"` use native `datetime-local` inputs and emit values truncated to the selected precision.

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

  function formatLocalDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  const presets: DateRangeDatePreset[] = [
    {
      id: 'today',
      label: 'Today',
      resolve: () => {
        const today = formatLocalDate(new Date());
        return { start: today, end: today };
      },
    },
    {
      id: 'this-month',
      label: 'This month',
      resolve: () => {
        const now = new Date();
        const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
        const end = formatLocalDate(now);
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
granularity  DateRangeGranularity no        Precision for native inputs: day, hour, minute, or second. Default: day.
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
  start: string | undefined; // ISO-8601 local date or datetime string
  end: string | undefined; // ISO-8601 local date or datetime string
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

## Scope limits

- Timezone conversion is caller-owned. Native `datetime-local` values are local wall-clock strings without timezone offsets.
- The browser owns the date and date-time picker UI. Keyboard behavior inside those native pickers is browser-controlled.
- No range constraint enforcement. The component sets `min`/`max` on the inputs to hint the browser's picker (end min = start, start max = end), but does not block the user from entering out-of-order values programmatically. Validation is the consumer's responsibility via the `error` prop.
