# ButtonGroup

Clusters related action buttons into a unified visual group with shared borders.

## Usage

```svelte
<script lang="ts">
  import ButtonGroup from '@lostgradient/cinder/button-group';
</script>

<ButtonGroup />
```

## Props

<!-- generated:props:start -->

| Prop          | Type                           | Required | Default | Description                                                                                                                                                                                   |
| ------------- | ------------------------------ | -------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `class`       | `string`                       | no       | —       | Additional class merged with `.cinder-button-group`.                                                                                                                                          |
| `label`       | `string`                       | no       | —       |                                                                                                                                                                                               |
| `labelledBy`  | `string`                       | no       | —       |                                                                                                                                                                                               |
| `orientation` | `"horizontal"` \| `"vertical"` | no       | —       | Orientation of the visual collapse. Default: 'horizontal'.                                                                                                                                    |
| `children`    | `(opaque)`                     | yes      | —       | Buttons (or split-button compositions) to render inside the group. A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
