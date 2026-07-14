# Segment

Individual option inside a SegmentedControl that renders either a selection button or a route-backed link with shared segmented styling.

## Usage

```svelte
<script lang="ts">
  import { Segment } from '@lostgradient/cinder/segment';
</script>
```

## Guidance

### Use When

- Authoring SegmentedControl children declaratively so consumers can compose icons, labels, and badges per segment.
- Mixing disabled and enabled segments inside a single radiogroup/tablist where each segment carries its own metadata.
- Rendering route filters as real links inside `SegmentedControl variant="navigation"`.

### Avoid When

- Building a standalone toggle button — use Button or Toggle instead.
- Selecting one option from a long list — use Select or Combobox instead.

## Props

<!-- generated:props:start -->

| Prop           | Type                                                                     | Required | Default | Description                                                                                                                                                                                         |
| -------------- | ------------------------------------------------------------------------ | -------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `class`        | `string`                                                                 | no       | —       | Custom class merged with `.cinder-segmented-control-option`.                                                                                                                                        |
| `controls`     | `string`                                                                 | no       | —       | ID of the panel this segment controls — only meaningful when the parent `SegmentedControl` uses `variant="tablist"`.                                                                                |
| `current`      | `boolean`                                                                | no       | —       | Marks this linked segment as the current route/filter.                                                                                                                                              |
| `currentToken` | `"page"` \| `"step"` \| `"location"` \| `"date"` \| `"time"` \| `"true"` | no       | —       | `aria-current` token emitted while `current` is true. Defaults to `"page"`.                                                                                                                         |
| `disabled`     | `boolean`                                                                | no       | —       | Disable just this segment (independent of the control-level `disabled`).                                                                                                                            |
| `href`         | `string`                                                                 | no       | —       | Render this segment as a real link inside `SegmentedControl variant="navigation"`.                                                                                                                  |
| `value`        | `string`                                                                 | no       | —       | Value this segment represents. Required when `href` is not provided.                                                                                                                                |
| `children`     | `(opaque)`                                                               | yes      | —       | The segment's label content. Not expressible in JSON Schema; see the component types for the signature.                                                                                             |
| `leading`      | `(opaque)`                                                               | no       | —       | Optional decorative content rendered before the label, inside `aria-hidden`. Not expressible in JSON Schema; see the component types for the signature.                                             |
| `onclick`      | `(opaque)`                                                               | no       | —       | Optional click handler for the rendered link. Disabled navigation segments prevent default and do not call this handler. Not expressible in JSON Schema; see the component types for the signature. |
| `trailing`     | `(opaque)`                                                               | no       | —       | Optional decorative content rendered after the label, inside `aria-hidden`. Not expressible in JSON Schema; see the component types for the signature.                                              |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
