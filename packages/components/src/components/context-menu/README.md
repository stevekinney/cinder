# ContextMenu

Right-click and long-press menu positioned at the user's pointer while reusing dropdown menu parts.

## Usage

```svelte
<script lang="ts">
  import { ContextMenu } from '@lostgradient/cinder/context-menu';
</script>
```

## Guidance

### Use When

- Providing contextual actions for a canvas, list row, file, or selected item.
- Opening a menu from a pointer location instead of a visible dropdown trigger.

### Avoid When

- The menu should open from a button — use dropdown.
- Showing arbitrary rich content rather than menu actions — use popover.

## Props

<!-- generated:props:start -->

| Prop             | Type                         | Required | Default | Description                                                                                                                |
| ---------------- | ---------------------------- | -------- | ------- | -------------------------------------------------------------------------------------------------------------------------- |
| `anchorPoint`    | { x: `number`; y: `number` } | no       | —       |                                                                                                                            |
| `class`          | `string`                     | no       | —       |                                                                                                                            |
| `disabled`       | `boolean`                    | no       | —       |                                                                                                                            |
| `longPressDelay` | `number`                     | no       | —       |                                                                                                                            |
| `open`           | `boolean`                    | no       | —       |                                                                                                                            |
| `children`       | `(opaque)`                   | yes      | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |
| `onopenchange`   | `(opaque)`                   | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
