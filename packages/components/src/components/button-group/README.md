# ButtonGroup

Clusters related action buttons into a unified visual group with shared borders.

## Usage

```svelte
<script lang="ts">
  import Button from '@lostgradient/cinder/button';
  import ButtonGroup from '@lostgradient/cinder/button-group';
</script>

<ButtonGroup label="Document actions">
  <Button variant="secondary">Save</Button>
  <Button variant="secondary">Duplicate</Button>
  <Button variant="secondary">Archive</Button>
</ButtonGroup>
```

## Props

<!-- generated:props:start -->

| Prop             | Type                           | Required | Default        | Description                                                                                                                                           |
| ---------------- | ------------------------------ | -------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ariaLabelledby` | `string`                       | no       | —              | The `id` of a visible heading element that already names the group, applied as `aria-labelledby`. Provide exactly one of `label` or `ariaLabelledby`. |
| `class`          | `string`                       | no       | —              | Additional class merged with `.cinder-button-group`.                                                                                                  |
| `label`          | `string`                       | no       | —              | Inline accessible name for the group, applied as `aria-label`. Provide exactly one of `label` or `ariaLabelledby`.                                    |
| `orientation`    | `"horizontal"` \| `"vertical"` | no       | `"horizontal"` | Orientation of the visual collapse. Default: 'horizontal'.                                                                                            |
| `children`       | `(opaque)`                     | yes      | —              | Buttons (or split-button compositions) to render inside the group. Not expressible in JSON Schema; see the component types for the signature.         |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
