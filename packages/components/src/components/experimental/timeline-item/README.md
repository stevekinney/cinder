# TimelineItem (experimental)

> **EXPERIMENTAL** — this component's API may change between minor versions until promoted to stable.

One entry in a `Timeline`. Renders a marker (dot or custom glyph) on the rail beside the item's title, time, and body content.

## Usage

```svelte
<TimelineItem time="10:00" title="Workflow started" status="success">
  Successfully kicked off the workflow.
</TimelineItem>
```

## Props

<!-- generated:props:start -->

| Prop     | Type                                                 | Required | Default  | Description                                                          |
| -------- | ---------------------------------------------------- | -------- | -------- | -------------------------------------------------------------------- |
| `class`  | `string`                                             | no       | —        | Additional class names merged with `.cinder-timeline-item`.          |
| `status` | `"info"` \| `"success"` \| `"warning"` \| `"danger"` | no       | `"info"` | Optional status that drives the marker color via a data attribute.   |
| `time`   | `string`                                             | no       | —        | Optional ISO timestamp / formatted time string for the entry header. |
| `title`  | `string`                                             | no       | —        | Visible event title.                                                 |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
