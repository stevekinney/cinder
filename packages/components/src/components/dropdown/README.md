# Dropdown

Composite dropdown root that coordinates the trigger, menu, and item subcomponents.

## Usage

`Dropdown` is a compound component. Import the parent and compose its leaves
via the namespace API: `Dropdown.Trigger`, `Dropdown.Menu`, `Dropdown.Item`,
`Dropdown.Label`, `Dropdown.Separator`, and `Dropdown.Group`.

```svelte
<script lang="ts">
  import { Dropdown } from '@lostgradient/cinder/dropdown';
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
`@lostgradient/cinder/dropdown-trigger`, `@lostgradient/cinder/dropdown-menu`, `@lostgradient/cinder/dropdown-item`,
`@lostgradient/cinder/dropdown-label`, `@lostgradient/cinder/dropdown-separator`, and `@lostgradient/cinder/dropdown-group`.

## Props

<!-- generated:props:start -->

| Prop        | Type                                                               | Required | Default | Description                                                                                                                             |
| ----------- | ------------------------------------------------------------------ | -------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `class`     | `string`                                                           | no       | —       | Additional class names merged with the component's root class.                                                                          |
| `id`        | `string`                                                           | no       | —       | HTML id applied to the dropdown root element. Auto-generated when omitted.                                                              |
| `open`      | `boolean`                                                          | no       | —       | Controls the open state of the dropdown menu; bindable for controlled usage.                                                            |
| `placement` | `"top-start"` \| `"top-end"` \| `"bottom-start"` \| `"bottom-end"` | no       | —       | Preferred menu placement relative to the trigger. Default `bottom-start`. The rendered menu may still flip to stay within the viewport. |
| `children`  | `(opaque)`                                                         | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.              |
| `trigger`   | `(opaque)`                                                         | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.              |

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
