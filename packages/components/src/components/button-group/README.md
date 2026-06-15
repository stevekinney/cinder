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

| Prop          | Type                           | Required | Default | Description                                                                                                                                       |
| ------------- | ------------------------------ | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `class`       | `string`                       | no       | —       | Additional class merged with `.cinder-button-group`.                                                                                              |
| `label`       | `string`                       | no       | —       | Inline accessible name for the group, applied as `aria-label`. Provide exactly one of `label` or `labelledBy`.                                    |
| `labelledBy`  | `string`                       | no       | —       | The `id` of a visible heading element that already names the group, applied as `aria-labelledby`. Provide exactly one of `label` or `labelledBy`. |
| `orientation` | `"horizontal"` \| `"vertical"` | no       | —       | Orientation of the visual collapse. Default: 'horizontal'.                                                                                        |
| `children`    | `(opaque)`                     | yes      | —       | Buttons (or split-button compositions) to render inside the group. Not expressible in JSON Schema; see the component types for the signature.     |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
