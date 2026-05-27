# CommandItem

A CommandItem component. Replace this sentence with a one-line purpose statement once the migration settles.

## Usage

```svelte
<script lang="ts">
  import CommandItem from 'cinder/command-item';
</script>

<CommandItem />
```

## Props

<!-- generated:props:start -->

| Prop            | Type                   | Required | Default | Description                                                           |
| --------------- | ---------------------- | -------- | ------- | --------------------------------------------------------------------- |
| `class`         | `string`               | no       | —       | Class merged with `.cinder-command-item`.                             |
| `description`   | `string`               | no       | —       | Optional secondary text shown below the main label.                   |
| `disabled`      | `boolean`              | no       | —       | When true, the item is skipped by arrow keys and cannot be activated. |
| `selectionMode` | `"item"` \| `"parent"` | no       | —       | The item owns activation. This is the default CommandPalette mode.    |
| `value`         | `string`               | yes      | —       | Submitted value; surfaced through the registration record.            |
| `children`      | `(opaque)`             | —        | —       | function-or-snippet                                                   |
| `leading`       | `(opaque)`             | —        | —       | function-or-snippet                                                   |
| `onselect`      | `(opaque)`             | —        | —       | function-or-snippet                                                   |
| `trailing`      | `(opaque)`             | —        | —       | function-or-snippet                                                   |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
