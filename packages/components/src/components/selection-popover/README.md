# SelectionPopover

A SelectionPopover component. Replace this sentence with a one-line purpose statement once the migration settles.

## Usage

```svelte
<script lang="ts">
  import SelectionPopover from 'cinder/selection-popover';
</script>

<SelectionPopover />
```

## Props

<!-- generated:props:start -->

| Prop              | Type               | Required | Default | Description                                                     |
| ----------------- | ------------------ | -------- | ------- | --------------------------------------------------------------- |
| `class`           | `string`           | no       | —       | Additional class names merged with `.cinder-selection-popover`. |
| `id`              | `string`           | yes      | —       | Unique identifier for the popover.                              |
| `open`            | `boolean`          | no       | —       | Whether the popover is visible.                                 |
| `position`        | `object` \| `null` | yes      | —       | Viewport-relative position for the popover.                     |
| `oncancel`        | `(opaque)`         | —        | —       | function-or-snippet                                             |
| `onclose`         | `(opaque)`         | —        | —       | function-or-snippet                                             |
| `oncommentsubmit` | `(opaque)`         | —        | —       | function-or-snippet                                             |
| `onexpand`        | `(opaque)`         | —        | —       | function-or-snippet                                             |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
