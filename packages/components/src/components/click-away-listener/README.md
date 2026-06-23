# ClickAwayListener

Headless utility that calls a function when the user clicks or taps outside a subtree.

## Usage

```svelte
<script lang="ts">
  import { ClickAwayListener } from '@lostgradient/cinder/click-away-listener';
</script>
```

## Guidance

### Use When

- Building a custom inline-edit field, custom dropdown, or any overlay that should close on outside interaction.

### Avoid When

- Using Popover, Dropdown, or Modal — those handle click-away internally.

## Props

<!-- generated:props:start -->

| Prop          | Type       | Required | Default | Description                                                                                                                                                                                                                                                           |
| ------------- | ---------- | -------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `class`       | `string`   | no       | —       | Additional class names merged with the root element.                                                                                                                                                                                                                  |
| `enabled`     | `boolean`  | no       | —       | When false the document listener is detached and `onclickaway` is never called. Defaults to `true`.                                                                                                                                                                   |
| `children`    | `(opaque)` | yes      | —       | Content rendered inside the root element. Required. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                        |
| `onclickaway` | `(opaque)` | yes      | —       | Called with the triggering PointerEvent (or MouseEvent/TouchEvent on browsers that do not support the Pointer Events API) when the user presses a pointer device outside the root element. Not expressible in JSON Schema; see the component types for the signature. |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
