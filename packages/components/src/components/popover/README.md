# Popover

A Popover component. Replace this sentence with a one-line purpose statement once the migration settles.

## Usage

```svelte
<script lang="ts">
  import Popover from 'cinder/popover';
</script>

<Popover />
```

## Props

<!-- generated:props:start -->

| Prop             | Type                                                                                                                 | Required | Default | Description                                                               |
| ---------------- | -------------------------------------------------------------------------------------------------------------------- | -------- | ------- | ------------------------------------------------------------------------- |
| `ariaLabelledby` | `string`                                                                                                             | no       | —       | Id of an element labelling the panel. Wins over `label`.                  |
| `class`          | `string`                                                                                                             | no       | —       | Extra class merged onto `.cinder-popover`.                                |
| `label`          | `string`                                                                                                             | no       | —       | Accessible name. Sets `aria-label` when `ariaLabelledby` is not supplied. |
| `offset`         | `number`                                                                                                             | no       | —       | Distance in px between trigger and panel. Default `8`.                    |
| `open`           | `boolean`                                                                                                            | no       | —       | Open state. Bindable. Default `false`.                                    |
| `placement`      | `"top"` \| `"bottom"` \| `"left"` \| `"right"` \| `"top-start"` \| `"top-end"` \| `"bottom-start"` \| `"bottom-end"` | no       | —       | Anchor placement. Default `'bottom-start'`.                               |
| `role`           | `"dialog"` \| `"group"` \| `"listbox"`                                                                               | no       | —       | ARIA role for the panel. Default `'dialog'`.                              |
| `showArrow`      | `boolean`                                                                                                            | no       | —       | Render a directional arrow on the panel. Default `false`.                 |
| `triggerRef`     | `object` \| `null`                                                                                                   | no       | —       | Explicit anchor element. Wins over the snippet-resolved focusable.        |
| `children`       | `(opaque)`                                                                                                           | —        | —       | function-or-snippet                                                       |
| `trigger`        | `(opaque)`                                                                                                           | —        | —       | function-or-snippet                                                       |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
