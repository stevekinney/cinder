# Tooltip

Hover-and-focus triggered hint for terse controls, anchored to a focusable child element.

## Usage

```svelte
<script lang="ts">
  import Tooltip from 'cinder/tooltip';
</script>

<Tooltip text="Refresh data" describe={false}>
  <button type="button" aria-label="Refresh data">R</button>
</Tooltip>
```

## Props

<!-- generated:props:start -->

| Prop        | Type                                           | Required | Default | Description                                                       |
| ----------- | ---------------------------------------------- | -------- | ------- | ----------------------------------------------------------------- |
| `class`     | `string`                                       | no       | —       |                                                                   |
| `describe`  | `boolean`                                      | no       | —       | Whether to wire tooltip text to the trigger via aria-describedby. |
| `placement` | `"top"` \| `"right"` \| `"bottom"` \| `"left"` | no       | —       |                                                                   |
| `text`      | `string`                                       | yes      | —       |                                                                   |
| `children`  | `(opaque)`                                     | —        | —       | function-or-snippet                                               |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
