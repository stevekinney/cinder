# Dropdown

A Dropdown component. Replace this sentence with a one-line purpose statement once the migration settles.

## Usage

`Dropdown` is a compound component. Import the parent and compose its leaves
via the namespace API: `Dropdown.Trigger`, `Dropdown.Menu`, `Dropdown.Item`,
`Dropdown.Label`, and `Dropdown.Separator`.

```svelte
<script lang="ts">
  import { Dropdown } from 'cinder/dropdown';
</script>

<Dropdown id="dropdown-actions">
  <Dropdown.Trigger>Options</Dropdown.Trigger>
  <Dropdown.Menu>
    <Dropdown.Label id="dropdown-actions-document">Document</Dropdown.Label>
    <Dropdown.Item>Edit</Dropdown.Item>
    <Dropdown.Item>Duplicate</Dropdown.Item>
    <Dropdown.Separator />
    <Dropdown.Item variant="danger">Delete</Dropdown.Item>
  </Dropdown.Menu>
</Dropdown>
```

The leaves remain importable individually for à-la-carte builds — see
`cinder/dropdown-trigger`, `cinder/dropdown-menu`, `cinder/dropdown-item`,
`cinder/dropdown-label`, and `cinder/dropdown-separator`.

## Props

<!-- generated:props:start -->

| Prop        | Type                               | Required | Default | Description         |
| ----------- | ---------------------------------- | -------- | ------- | ------------------- |
| `class`     | `string`                           | no       | —       |                     |
| `id`        | `string`                           | no       | —       |                     |
| `open`      | `boolean`                          | no       | —       |                     |
| `placement` | `"bottom-start"` \| `"bottom-end"` | no       | —       |                     |
| `children`  | `(opaque)`                         | —        | —       | function-or-snippet |
| `trigger`   | `(opaque)`                         | —        | —       | function-or-snippet |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

- `Dropdown.Trigger` — the button that toggles the menu; see
  [`dropdown-trigger`](../dropdown-trigger/README.md).
- `Dropdown.Menu` — the menu surface; see [`dropdown-menu`](../dropdown-menu/README.md).
- `Dropdown.Item` — a menu item with optional `variant="danger"`; see
  [`dropdown-item`](../dropdown-item/README.md).
- `Dropdown.Label` — accessible section label inside the menu; see
  [`dropdown-label`](../dropdown-label/README.md).
- `Dropdown.Separator` — a visual divider; see
  [`dropdown-separator`](../dropdown-separator/README.md).
- `Dropdown.Group` — accessible grouping for related items inside the menu; see
  [`dropdown-group`](../dropdown-group/README.md).

<!-- generated:subcomponents:end -->
