# TimelineItem

One event entry in a `Timeline`. Renders a decorative tone marker on the rail beside the item's timestamp, title, and body content.

## Usage

```svelte
<TimelineItem
  datetime="2026-05-23T10:00:00Z"
  timestamp="10:00"
  title="Workflow started"
  tone="success"
>
  Successfully kicked off the workflow.
</TimelineItem>
```

Marker snippets are decorative. Do not place focusable or interactive content inside `marker`; the marker wrapper is hidden from assistive technology and marked inert.

## Props

<!-- generated:props:start -->

| Prop               | Type                                                | Required | Default     | Description                                                                                                                                          |
| ------------------ | --------------------------------------------------- | -------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `class`            | `string`                                            | no       | —           | Additional class names merged with `.cinder-timeline-item`.                                                                                          |
| `connectorAfter`   | `"visible"` \| `"hidden"`                           | no       | `"visible"` | Whether to draw the connector to the following event.                                                                                                |
| `datetime`         | `string`                                            | yes      | —           | Machine-readable ISO datetime rendered into `<time datetime>`.                                                                                       |
| `groupHeader`      | `string`                                            | no       | —           | Optional adjacent group heading rendered inside this list item before the event body.                                                                |
| `groupHeaderLevel` | `1` \| `2` \| `3` \| `4` \| `5` \| `6`              | no       | `3`         | Heading level applied when `groupHeader` is rendered.                                                                                                |
| `timestamp`        | `string`                                            | yes      | —           | Visible timestamp label rendered inside `<time>`.                                                                                                    |
| `title`            | `string`                                            | yes      | —           | Visible event title.                                                                                                                                 |
| `tone`             | `"info"` \| `"success"` \| `"warning"` \| `"error"` | no       | `"info"`    | Semantic marker tone.                                                                                                                                |
| `children`         | `(opaque)`                                          | no       | —           | Item body content. Not expressible in JSON Schema; see the component types for the signature.                                                        |
| `marker`           | `(opaque)`                                          | no       | —           | Decorative custom marker glyph. Must not contain interactive descendants. Not expressible in JSON Schema; see the component types for the signature. |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
