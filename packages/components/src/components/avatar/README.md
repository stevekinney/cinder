# Avatar

Displays a user's profile photo, initials, or fallback icon at a consistent size.

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
| `class` | `(opaque)`                                     | no       | —       | A prop whose shape is not captured by the JSON schema; see the component types for the exact signature.         |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
