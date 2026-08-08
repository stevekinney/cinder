# DateRangeField

Controlled start/end date range picker with preset shortcuts and validation feedback, designed for time-window filtering on dashboards, event streams, and audit logs.

## Overview

`DateRangeField` renders two text inputs backed by custom calendar/time popovers (start and end) along with preset shortcut buttons. It is fully controlled: the consumer owns the `value` and responds to `onValueChange` callbacks. It does not own routing, query-string synchronization, timezone conversion, or data fetching.

Values are ISO-8601 local strings. `granularity="day"` emits `YYYY-MM-DD`; time granularities use the custom time popover and emit values truncated to the selected precision.

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
  onValueChange={(next) => {
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

## Props

<!-- generated:props:start -->

| Prop             | Type                                            | Required | Default | Description                                                                                                                                                                                                                                                                                 |
| ---------------- | ----------------------------------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `class`          | `string`                                        | no       | —       | Additional CSS classes applied to the root element.                                                                                                                                                                                                                                         |
| `description`    | `string`                                        | no       | —       | Helper text displayed below the field; wired via aria-describedby.                                                                                                                                                                                                                          |
| `disabled`       | `boolean`                                       | no       | —       | Disables the entire field including presets and date inputs.                                                                                                                                                                                                                                |
| `endLabel`       | `string`                                        | no       | —       | Accessible label for the end input. Defaults to "End date" for day granularity and "End date and time" for datetime granularities.                                                                                                                                                          |
| `error`          | `string`                                        | no       | —       | Validation error message. When provided, marks both inputs as aria-invalid="true" and renders the message in a live region.                                                                                                                                                                 |
| `granularity`    | `"day"` \| `"hour"` \| `"minute"` \| `"second"` | no       | —       | Date-time precision. Defaults to day precision.                                                                                                                                                                                                                                             |
| `id`             | `string`                                        | yes      | —       | Unique identifier used to generate accessible IDs for labels and error regions.                                                                                                                                                                                                             |
| `label`          | `string`                                        | no       | —       | Visible legend rendered above the start/end inputs.                                                                                                                                                                                                                                         |
| `presetsVisible` | `boolean`                                       | no       | `true`  | Whether the preset buttons render. Set `false` for date inputs only.                                                                                                                                                                                                                        |
| `startLabel`     | `string`                                        | no       | —       | Accessible label for the start input. Defaults to "Start date" for day granularity and "Start date and time" for datetime granularities.                                                                                                                                                    |
| `onValueChange`  | `(opaque)`                                      | no       | —       | Called when the user changes the date range (preset or manual input). Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                            |
| `presets`        | `(opaque)`                                      | no       | —       | Consumer-defined preset options shown above the date inputs. Each preset has a label and a resolve() function that returns a DateRangeValue. Defaults to today, yesterday-today, last-7d built-ins when omitted. Not expressible in JSON Schema; see the component types for the signature. |
| `value`          | `(opaque)`                                      | no       | —       | Current date range value. Bindable. Both fields start undefined when unset. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                      |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

<!-- generated:subcomponents:end -->

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

- Timezone conversion is caller-owned. Emitted date-time values are local wall-clock strings without timezone offsets.
- The component owns the custom date and date-time picker UI.
- Start and end constrain each other through DatePicker's `min`/`max` contract: the calendar disables out-of-range dates and manual edits are validated and clamped. Consumers still own domain-specific validation and error messaging through the `error` prop.
