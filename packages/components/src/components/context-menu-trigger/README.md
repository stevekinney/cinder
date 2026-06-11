# ContextMenuTrigger

Compose-only trigger region that opens a context-menu on right-click or touch long-press.

## Usage

```svelte
<script lang="ts">
  import { ContextMenuTrigger } from '@lostgradient/cinder/context-menu-trigger';
</script>
```

## Guidance

### Use When

- Wrapping the region that should own contextual actions inside ContextMenu.
- Pairing pointer-positioned menu behavior with dropdown menu items.

### Avoid When

- Used outside context-menu — it requires the ContextMenu provider.
- Opening a normal click menu from a visible button — use dropdown-trigger.

## Props

<!-- generated:props:start -->

| Prop       | Type       | Required | Default | Description                                                                                                                |
| ---------- | ---------- | -------- | ------- | -------------------------------------------------------------------------------------------------------------------------- |
| `class`    | `string`   | no       | —       |                                                                                                                            |
| `children` | `(opaque)` | yes      | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
