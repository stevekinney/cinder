# CommandItem

Individual selectable row within a command palette or dropdown command list.

## Usage

```svelte
<script lang="ts">
  import CommandItem from 'cinder/command-item';
</script>

<CommandItem />
```

## Props

<!-- generated:props:start -->

| Prop            | Type                   | Required | Default | Description                                                                                                                |
| --------------- | ---------------------- | -------- | ------- | -------------------------------------------------------------------------------------------------------------------------- |
| `class`         | `string`               | no       | —       | Class merged with `.cinder-command-item`.                                                                                  |
| `description`   | `string`               | no       | —       | Optional secondary text shown below the main label.                                                                        |
| `disabled`      | `boolean`              | no       | —       | When true, the item is skipped by arrow keys and cannot be activated.                                                      |
| `selectionMode` | `"item"` \| `"parent"` | no       | —       | The item owns activation. This is the default CommandPalette mode.                                                         |
| `value`         | `string`               | yes      | —       | Submitted value; surfaced through the registration record.                                                                 |
| `children`      | `(opaque)`             | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |
| `leading`       | `(opaque)`             | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |
| `onselect`      | `(opaque)`             | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |
| `trailing`      | `(opaque)`             | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
