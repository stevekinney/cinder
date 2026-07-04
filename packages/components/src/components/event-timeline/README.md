# EventTimeline

Horizontal time-axis strip for scheduled events with proportional dots, a now marker, and collision-nudged labels.

## Usage

```svelte
<script lang="ts">
  import { EventTimeline } from '@lostgradient/cinder/event-timeline';
</script>

<EventTimeline
  label="Next 24 hours"
  start="2026-07-03T00:00:00.000Z"
  end="2026-07-04T00:00:00.000Z"
  now="2026-07-03T10:30:00.000Z"
  items={[
    { at: '2026-07-03T02:00:00.000Z', label: 'Digest', sublabel: '02:00', state: 'done' },
    { at: '2026-07-03T16:00:00.000Z', label: 'Deploy', sublabel: '16:00' },
  ]}
/>
```

## Props

<!-- generated:props:start -->

| Prop        | Type                                                                                                                                  | Required | Default | Description                                                        |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------- | ------------------------------------------------------------------ |
| `ariaLabel` | `string`                                                                                                                              | no       | —       | Accessible name override. Defaults to `label` or `Event timeline`. |
| `class`     | `string`                                                                                                                              | no       | —       | Custom class merged with `.cinder-event-timeline`.                 |
| `end`       | `string` \| `number`                                                                                                                  | yes      | —       | Inclusive end of the displayed time range.                         |
| `items`     | ({ at: `string` \| `number`; id?: `string`; label: `string`; state?: `"done"` \| `"upcoming"` \| `"failed"`; sublabel?: `string` })[] | yes      | —       | Events positioned proportionally between `start` and `end`.        |
| `label`     | `string`                                                                                                                              | no       | —       | Visible heading for the timeline.                                  |
| `now`       | `string` \| `number`                                                                                                                  | no       | —       | Optional current time marker.                                      |
| `size`      | `"sm"` \| `"md"`                                                                                                                      | no       | —       | Timeline density. Default `md`.                                    |
| `start`     | `string` \| `number`                                                                                                                  | yes      | —       | Inclusive start of the displayed time range.                       |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
