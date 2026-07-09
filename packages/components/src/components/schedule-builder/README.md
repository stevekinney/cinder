# ScheduleBuilder

A recurrence-definition control. Users author a schedule via friendly presets (every N minutes/hours, daily, weekly on selected days, or monthly on a day), raw five-field cron, or a fixed interval — all three authoring modes lower to the same portable emitted value: `{ mode: 'cron', expression }` or `{ mode: 'interval', every, unit }`. `mode: 'preset'` never appears in the emitted value; presets are sugar.

`ScheduleBuilder` ships no date, cron-parsing, or scheduling library. The always-visible "next N fires" preview is entirely consumer-supplied via `computeNextFires`, and the preview section is not rendered at all when that prop is omitted. Scope is recurrence only — overlap policy, jitter, and backfill belong to the consumer's surrounding form.

## Usage

```svelte
<script lang="ts">
  import ScheduleBuilder from '@lostgradient/cinder/schedule-builder';
  import type { ScheduleFire, ScheduleValue } from '@lostgradient/cinder/schedule-builder';

  let value = $state<ScheduleValue>({ mode: 'interval', every: 15, unit: 'minutes' });

  // Cinder ships no date math — bring your own cron/interval library here.
  // Labels are illustrative; a real implementation would compute actual fire times.
  function computeNextFires(current: ScheduleValue, count: number): ScheduleFire[] {
    if (current.mode === 'interval') {
      return Array.from({ length: count }, (_, index) => ({
        id: `fire-${index}`,
        label: `In ${(index + 1) * current.every} ${current.unit}`,
      }));
    }
    return Array.from({ length: count }, (_, index) => ({
      id: `fire-${index}`,
      label: `Next occurrence ${index + 1}`,
    }));
  }
</script>

<ScheduleBuilder
  {value}
  onchange={(next) => (value = next)}
  {computeNextFires}
  timezoneLabel="America/New_York"
  label="Job schedule"
/>
```

## Authoring modes

Three modes live behind a tablist (`Presets`, `Cron`, `Interval`); presets is the default.

- **Presets** — a preset-kind selector (`Every N` / `Daily` / `Weekly` / `Monthly`) reveals the matching fields. `Every N` lowers to an `interval` value; `Daily`, `Weekly`, and `Monthly` lower to a `cron` value.
- **Cron** — five separate fields (minute, hour, day of month, month, day of week), each validated independently with an inline error and hint. The emitted value is the joined five-field expression.
- **Interval** — a number and a unit (`minutes` / `hours` / `days` / `weeks`).

Switching modes never emits a change by itself — it re-seeds the destination mode's fields from the last value you actually committed, losslessly where representable (an `interval` always converts to an equivalent cron pattern; a cron pattern only converts back to an `interval` when it is a pure step pattern, e.g. `*/15 * * * *`).

Regardless of mode, three things are always visible: a plain-English summary line, the next-fires preview (when `computeNextFires` is supplied), and a timezone display slot (`timezone` snippet, else `timezoneLabel` text, else a "Not set" placeholder).

## Props

<!-- generated:props:start -->

| Prop               | Type                                                                                                                                         | Required | Default | Description                                                                                                                                                                                                                                                                                               |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `class`            | `string`                                                                                                                                     | no       | —       | Additional CSS classes applied to the root element.                                                                                                                                                                                                                                                       |
| `label`            | `string`                                                                                                                                     | no       | —       | Accessible label for the whole control. Defaults to "Schedule".                                                                                                                                                                                                                                           |
| `previewCount`     | `number`                                                                                                                                     | no       | —       | How many upcoming fires to request from `computeNextFires`. Defaults to 5.                                                                                                                                                                                                                                |
| `timezoneLabel`    | `string`                                                                                                                                     | no       | —       | Timezone label rendered in the always-visible timezone display slot.                                                                                                                                                                                                                                      |
| `value`            | { expression: `string`; mode: `"cron"` } \| { every: `number`; mode: `"interval"`; unit: `"minutes"` \| `"hours"` \| `"days"` \| `"weeks"` } | no       | —       | The current recurrence value (controlled). When omitted, the component starts from a sensible default (`interval`, every 15 minutes).                                                                                                                                                                     |
| `computeNextFires` | `(opaque)`                                                                                                                                   | no       | —       | Injected next-fires computation. The component passes the current value and the requested count and renders whatever fires the consumer returns. When omitted, the preview list is hidden (the component ships no date logic). Not expressible in JSON Schema; see the component types for the signature. |
| `onchange`         | `(opaque)`                                                                                                                                   | no       | —       | Called whenever the user edits the recurrence. Receives the next lossless {@link ScheduleValue}. The consumer owns persistence and validation. Not expressible in JSON Schema; see the component types for the signature.                                                                                 |
| `timezone`         | `(opaque)`                                                                                                                                   | no       | —       | Custom content for the timezone display slot. Takes precedence over `timezoneLabel` when both are supplied. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                    |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
