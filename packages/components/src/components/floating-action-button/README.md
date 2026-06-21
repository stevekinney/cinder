# FloatingActionButton

Circular button representing the single most important action on a screen.

## Usage

```svelte
<script lang="ts">
  import { FloatingActionButton } from '@lostgradient/cinder/floating-action-button';
</script>
```

## Guidance

### Use When

- One action dominates the page purpose (compose, add, create).

### Avoid When

- Multiple equally-important actions exist — use a toolbar or button group.
- You need it pinned to the viewport — it doesn't position itself; wrap it in your own fixed/sticky container.

## Props

<!-- generated:props:start -->

| Prop       | Type                                        | Required | Default     | Description                                                                                                                                                                                                                        |
| ---------- | ------------------------------------------- | -------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `class`    | `string`                                    | no       | —           | Custom class merged with `.cinder-fab`.                                                                                                                                                                                            |
| `disabled` | `boolean`                                   | no       | `false`     | When true, disables the button and prevents interaction.                                                                                                                                                                           |
| `href`     | `string`                                    | no       | —           | Render as an anchor `<a>` element with this href.                                                                                                                                                                                  |
| `shape`    | `"filled"` \| `"extended"`                  | no       | `"filled"`  | Shape. `filled` = circle, `extended` = pill.                                                                                                                                                                                       |
| `size`     | `"sm"` \| `"md"` \| `"lg"`                  | no       | `"md"`      | Size of the FAB.                                                                                                                                                                                                                   |
| `variant`  | `"primary"` \| `"secondary"` \| `"surface"` | no       | `"primary"` | Color palette.                                                                                                                                                                                                                     |
| `children` | `(opaque)`                                  | no       | —           | The icon (or icon + label for extended shape). Always provide `aria-label` when the FAB renders an icon without visible text — i.e. the `filled` shape. Not expressible in JSON Schema; see the component types for the signature. |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
