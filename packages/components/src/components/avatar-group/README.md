# AvatarGroup

Overlapping collaborator stack built on Avatar, with focusable names and an overflow count.

## Usage

```svelte
<script lang="ts">
  import AvatarGroup from 'cinder/avatar-group';
</script>

<AvatarGroup avatars={[{ name: 'Ada Lovelace' }, { name: 'Grace Hopper' }]} />
```

## Props

<!-- generated:props:start -->

| Prop            | Type                                                | Required | Default         | Description                                                                      |
| --------------- | --------------------------------------------------- | -------- | --------------- | -------------------------------------------------------------------------------- |
| `avatars`       | { id?: `string`; name: `string`; src?: `string` }[] | yes      | —               | Collaborators to render in the stack.                                            |
| `class`         | `string`                                            | no       | —               | Additional class names merged with `.cinder-avatar-group`.                       |
| `maxVisible`    | `number`                                            | no       | `5`             | Maximum visible avatars before overflow.                                         |
| `overflowLabel` | `string`                                            | no       | —               | Accessible label for the overflow indicator.                                     |
| `overlap`       | `string`                                            | no       | `"0.75rem"`     | Non-negative CSS length token for the amount each item overlaps its predecessor. |
| `shape`         | `"circle"` \| `"square"`                            | no       | `"circle"`      | Shape forwarded to each visible Avatar.                                          |
| `size`          | `"xs"` \| `"sm"` \| `"md"` \| `"lg"` \| `"xl"`      | no       | `"md"`          | Size token forwarded to each visible Avatar.                                     |
| `zOrder`        | `"first-on-top"` \| `"last-on-top"`                 | no       | `"last-on-top"` | Stacking order for visible avatars.                                              |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

- `--cinder-avatar-group-overlap`
<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

<!-- generated:subcomponents:end -->
