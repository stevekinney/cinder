# Timeline (experimental)

> **EXPERIMENTAL** — this component's API may change between minor versions until promoted to stable.

Vertical event-rail container. Render `TimelineItem` children inside to display workflow events, audit logs, or run histories.

## Usage

```svelte
<script lang="ts">
  import Timeline from 'cinder/experimental/timeline';
  import TimelineItem from 'cinder/experimental/timeline-item';
</script>

<Timeline>
  <TimelineItem id="created" title="Workflow started" time="10:00" status="info" />
  <TimelineItem id="completed" title="Workflow completed" time="10:30" status="success" />
</Timeline>
```

## Props

<!-- generated:props:start -->

| Prop    | Type     | Required | Default | Description                                            |
| ------- | -------- | -------- | ------- | ------------------------------------------------------ |
| `class` | `string` | no       | —       | Additional class names merged with `.cinder-timeline`. |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

- `TimelineItem` — one event entry on the rail.
<!-- generated:subcomponents:end -->
