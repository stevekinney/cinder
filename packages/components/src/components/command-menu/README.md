# CommandMenu

Inline caret-anchored slash-command list for textareas and single-line text inputs.

## Usage

```svelte
<script lang="ts">
  import { CommandMenu } from '@lostgradient/cinder/command-menu';
</script>
```

## Guidance

### Use When

- Showing a contextual command list at the caret while a user types in a textarea or input.
- Building slash-command insertion flows where the host owns text replacement.

### Avoid When

- Exposing a global app launcher — use command-palette instead.
- Selecting from a static form option list — use combobox instead.

## Props

<!-- generated:props:start -->

| Prop            | Type                                                                                                                 | Required | Default | Description                                                                                                                                                                               |
| --------------- | -------------------------------------------------------------------------------------------------------------------- | -------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `caretIndex`    | `number`                                                                                                             | yes      | —       | Caret offset within the anchor value.                                                                                                                                                     |
| `class`         | `string`                                                                                                             | no       | —       | Class merged with `.cinder-command-menu`.                                                                                                                                                 |
| `label`         | `string`                                                                                                             | no       | —       | Accessible listbox label. Default `'Commands'`.                                                                                                                                           |
| `offset`        | `number`                                                                                                             | no       | —       | Distance in px between the caret and menu. Default `6`.                                                                                                                                   |
| `open`          | `boolean`                                                                                                            | no       | —       | Open state. Bindable. Default `false`.                                                                                                                                                    |
| `placement`     | `"top"` \| `"bottom"` \| `"left"` \| `"right"` \| `"top-start"` \| `"top-end"` \| `"bottom-start"` \| `"bottom-end"` | no       | —       | Caret-relative placement. Default `'bottom-start'`.                                                                                                                                       |
| `query`         | `string`                                                                                                             | no       | —       | Query text after the trigger character. Bindable. Default `''`.                                                                                                                           |
| `anchor`        | `(opaque)`                                                                                                           | yes      | —       | Text field used as the caret-position anchor. A prop whose shape is not captured by the JSON schema; see the component types for the exact signature.                                     |
| `empty`         | `(opaque)`                                                                                                           | no       | —       | Optional empty state rendered after item registration settles. A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |
| `items`         | `(opaque)`                                                                                                           | yes      | —       | Render command items for the current query. A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                    |
| `ondismiss`     | `(opaque)`                                                                                                           | no       | —       | Invoked when Escape or outside pointerdown dismisses the menu. A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |
| `onselect`      | `(opaque)`                                                                                                           | no       | —       | Invoked when an enabled command is activated. A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                  |
| `onstatechange` | `(opaque)`                                                                                                           | no       | —       | One-way state output for host-owned field ARIA. A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
