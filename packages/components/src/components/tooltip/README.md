# Tooltip

Hover-and-focus triggered hint for terse controls, anchored to a focusable child element.

## Usage

```svelte
<script lang="ts">
  import Tooltip from '@lostgradient/cinder/tooltip';
</script>

<Tooltip text="Refresh data" describe={false}>
  <button type="button" aria-label="Refresh data">R</button>
</Tooltip>
```

## Props

<!-- generated:props:start -->

| Prop        | Type                                           | Required | Default | Description                                                                                                                |
| ----------- | ---------------------------------------------- | -------- | ------- | -------------------------------------------------------------------------------------------------------------------------- |
| `class`     | `string`                                       | no       | —       | Additional class names merged with the component's root class.                                                             |
| `describe`  | `boolean`                                      | no       | —       | Whether to wire tooltip text to the trigger via aria-describedby.                                                          |
| `placement` | `"top"` \| `"right"` \| `"bottom"` \| `"left"` | no       | —       | Preferred side of the trigger on which the tooltip appears. Default `top`.                                                 |
| `text`      | `string`                                       | yes      | —       | Text content rendered inside the tooltip.                                                                                  |
| `children`  | `(opaque)`                                     | yes      | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
