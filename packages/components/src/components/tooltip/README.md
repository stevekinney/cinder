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

| Prop         | Type                                           | Required | Default | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------ | ---------------------------------------------- | -------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `class`      | `string`                                       | no       | —       | Additional class names merged with the component's root class.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `describe`   | `boolean`                                      | no       | `true`  | Whether to wire tooltip text to the trigger via aria-describedby.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `placement`  | `"top"` \| `"right"` \| `"bottom"` \| `"left"` | no       | —       | Preferred side of the trigger on which the tooltip appears. Default `top`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `text`       | `string`                                       | yes      | —       | Text content rendered inside the tooltip.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `children`   | `(opaque)`                                     | no       | —       | The trigger element the tooltip wraps and anchors to. Required unless `triggerRef` supplies the anchor instead. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `triggerRef` | `(opaque)`                                     | no       | —       | Explicit anchor element, for when the tooltip cannot wrap its trigger. The default form renders a wrapper around `children` and resolves the anchor from it, which puts the `role="tooltip"` panel inside whatever structure the trigger sits in. That is wrong wherever the surrounding markup constrains its children — `AvatarGroup` wraps each avatar in a `role="listitem"`, so an in-tree panel lands inside a list item. With `triggerRef`, the Tooltip renders ONLY the panel and anchors it to the supplied element, so the consumer places the panel wherever it belongs. `children` is then unnecessary — the trigger is already in the consumer's own markup. Mirrors `PopoverProps.triggerRef`. Not expressible in JSON Schema; see the component types for the signature. |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
