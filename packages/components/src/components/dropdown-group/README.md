# DropdownGroup

Accessible group boundary that clusters related dropdown-item rows inside a dropdown-menu.

## Usage

```svelte
<script lang="ts">
  import { DropdownGroup } from '@lostgradient/cinder/dropdown-group';
</script>
```

## Guidance

### Use When

- Grouping related dropdown actions under one accessible heading.
- Pairing dropdown-label with a role='group' container inside dropdown-menu.

### Avoid When

- Rendering a clickable row — use dropdown-item.
- Separating sections without a group label — use dropdown-separator.

## Props

<!-- generated:props:start -->

| Prop         | Type       | Required | Default | Description                                                                                                                                                              |
| ------------ | ---------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ariaLabel`  | `string`   | no       | —       |                                                                                                                                                                          |
| `class`      | `string`   | no       | —       | Additional class names merged onto the group root.                                                                                                                       |
| `labelledBy` | `string`   | no       | —       |                                                                                                                                                                          |
| `children`   | `(opaque)` | no       | —       | DropdownLabel plus grouped DropdownItem rows. A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
