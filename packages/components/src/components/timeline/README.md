# Timeline

Timestamp-first event rail for workflow events, audit logs, run histories, and grouped temporal sequences. Timeline is not a live region; use `Feed` for streaming activity that should be announced to assistive technology.

## Usage

```svelte
<script lang="ts">
  import Timeline from '@lostgradient/cinder/timeline';

  const entries = [
    {
      id: 'created',
      datetime: '2026-05-23T10:00:00Z',
      timestamp: '10:00',
      title: 'Workflow started',
      tone: 'info',
    },
    {
      id: 'completed',
      datetime: '2026-05-23T10:30:00Z',
      timestamp: '10:30',
      title: 'Workflow completed',
      tone: 'success',
    },
  ];
</script>

<Timeline {entries} label="Workflow timeline">
  {#snippet children(entry)}
    {entry.title}
  {/snippet}
</Timeline>
```

Marker snippets are decorative. Do not place focusable or interactive content inside `marker`; the marker wrapper is hidden from assistive technology and marked inert.

## Props

<!-- generated:props:start -->

| Prop                  | Type                                                                                                                                                              | Required | Default      | Description                                                                                                                                                                                               |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `class`               | `string`                                                                                                                                                          | no       | —            | Additional class names merged with `.cinder-timeline`.                                                                                                                                                    |
| `entries`             | ({ datetime: `string`; groupLabel?: `string`; id: `string`; timestamp: `string`; title: `string`; tone?: `"info"` \| `"success"` \| `"warning"` \| `"error"` })[] | yes      | —            | Timeline entries rendered in source order.                                                                                                                                                                |
| `gapThresholdMinutes` | `number`                                                                                                                                                          | no       | —            | Hide the following connector when adjacent valid timestamps exceed this gap.                                                                                                                              |
| `groupBy`             | `"none"` \| `"day"` \| `"week"`                                                                                                                                   | no       | `"none"`     | Optional adjacent UTC day/week grouping mode.                                                                                                                                                             |
| `groupHeaderLevel`    | `1` \| `2` \| `3` \| `4` \| `5` \| `6`                                                                                                                            | no       | `3`          | Heading level applied to rendered group headers.                                                                                                                                                          |
| `label`               | `string`                                                                                                                                                          | no       | —            | Fallback accessible label used only when aria-label and aria-labelledby are absent.                                                                                                                       |
| `orientation`         | `"vertical"` \| `"horizontal"`                                                                                                                                    | no       | `"vertical"` | Layout orientation.                                                                                                                                                                                       |
| `weekStartsOn`        | `"sunday"` \| `"monday"`                                                                                                                                          | no       | `"monday"`   | Week start used for UTC week grouping.                                                                                                                                                                    |
| `children`            | `(opaque)`                                                                                                                                                        | no       | —            | Optional per-entry body content. A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                               |
| `marker`              | `(opaque)`                                                                                                                                                        | no       | —            | Decorative per-entry marker content. Must not contain interactive descendants. A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

- `TimelineItem` — one event entry on the rail.
<!-- generated:subcomponents:end -->
