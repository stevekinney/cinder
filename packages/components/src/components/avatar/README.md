# Avatar

A Avatar component. Replace this sentence with a one-line purpose statement once the migration settles.

## Usage

```svelte
<script lang="ts">
  import Avatar from 'cinder/avatar';
</script>

<Avatar />
```

## Props

<!-- generated:props:start -->

| Prop    | Type                                           | Required | Default | Description                                                                                                     |
| ------- | ---------------------------------------------- | -------- | ------- | --------------------------------------------------------------------------------------------------------------- |
| `alt`   | `string`                                       | no       | —       | Alternative text for the image. Defaults to `name` when present.                                                |
| `name`  | `string`                                       | no       | —       | Display name used to compute initials when no image is available. Also used as the default `alt` for the image. |
| `shape` | `"circle"` \| `"square"`                       | no       | —       | Shape. Default `circle`.                                                                                        |
| `size`  | `"xs"` \| `"sm"` \| `"md"` \| `"lg"` \| `"xl"` | no       | —       | Size token. Default `md`.                                                                                       |
| `src`   | `string`                                       | no       | —       | Image source. When omitted, the initials fallback renders.                                                      |
| `class` | `(opaque)`                                     | —        | —       | unknown-shape                                                                                                   |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
