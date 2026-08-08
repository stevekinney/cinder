# TransferList

TransferList renders one compact multiselect listbox for assigning items from a
fixed pool to a selected set. The count and selected state stay visible in the
same surface.

## Usage

```svelte
<script lang="ts">
  import { TransferList } from '@lostgradient/cinder/transfer-list';

  const items = [
    { id: 'read', label: 'Read' },
    { id: 'write', label: 'Write' },
  ];

  let value = $state(['read']);
</script>

<TransferList {items} bind:value leftLabel="Available permissions" rightLabel="Granted" />
```

## Props

<!-- generated:props:start -->

| Prop            | Type                                                      | Required | Default       | Description                                                                                                                                |
| --------------- | --------------------------------------------------------- | -------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `class`         | `string`                                                  | no       | —             | Custom class merged with `.cinder-transfer-list`.                                                                                          |
| `items`         | { disabled?: `boolean`; id: `string`; label: `string` }[] | yes      | —             | Full item pool. Item IDs must be unique; duplicate IDs after the first are ignored. The component never mutates this array.                |
| `leftLabel`     | `string`                                                  | no       | `"Available"` | Accessible and visible label for the compact selection list.                                                                               |
| `rightLabel`    | `string`                                                  | no       | `"Selected"`  | Label used in the selection count and transfer announcements.                                                                              |
| `value`         | `string`[]                                                | no       | —             | Unique IDs currently selected in the list. Supports `bind:value`. Unknown IDs are ignored and dropped on the next update.                  |
| `onValueChange` | `(opaque)`                                                | no       | —             | Called with the next selected value after an option is toggled. Not expressible in JSON Schema; see the component types for the signature. |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
