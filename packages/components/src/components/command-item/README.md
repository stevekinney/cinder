# CommandItem

Individual selectable row within a command palette or dropdown command list.

## Usage

```svelte
<script lang="ts">
  import CommandItem from '@lostgradient/cinder/command-item';
</script>

<CommandItem />
```

## Props

<!-- generated:props:start -->

| Prop               | Type                   | Required | Default | Description                                                                                                                               |
| ------------------ | ---------------------- | -------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `accessibleLabel`  | `string`               | no       | —       | Accessible name for the option when the rendered row contains secondary text or rich content.                                             |
| `class`            | `string`               | no       | —       | Class merged with `.cinder-command-item`.                                                                                                 |
| `description`      | `string`               | no       | —       | Optional secondary text shown below the main label.                                                                                       |
| `disabled`         | `boolean`              | no       | —       | When true, the item is skipped by arrow keys and cannot be activated.                                                                     |
| `keyboardShortcut` | `string`               | no       | —       | Keyboard shortcut exposed through `aria-keyshortcuts`, e.g. `Meta+N`.                                                                     |
| `selectionMode`    | `"item"` \| `"parent"` | no       | —       | The item owns activation. This is the default CommandPalette mode.                                                                        |
| `value`            | `string`               | yes      | —       | Submitted value; surfaced through the registration record.                                                                                |
| `children`         | `(opaque)`             | yes      | —       | Main label content. Not expressible in JSON Schema; see the component types for the signature.                                            |
| `leading`          | `(opaque)`             | no       | —       | Leading content (icon, avatar). Rendered with aria-hidden. Not expressible in JSON Schema; see the component types for the signature.     |
| `onselect`         | `(opaque)`             | no       | —       | Invoked when the item is activated inside CommandPalette. Not expressible in JSON Schema; see the component types for the signature.      |
| `trailing`         | `(opaque)`             | no       | —       | Trailing content (kbd hint, badge). Rendered with aria-hidden. Not expressible in JSON Schema; see the component types for the signature. |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
