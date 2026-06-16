# TransferList

TransferList renders two listboxes and transfer controls for assigning items
from an available pool to a selected set.

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

| Prop         | Type                                                      | Required | Default       | Description                                                                                                                                     |
| ------------ | --------------------------------------------------------- | -------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `class`      | `string`                                                  | no       | —             | Custom class merged with `.cinder-transfer-list`.                                                                                               |
| `items`      | { disabled?: `boolean`; id: `string`; label: `string` }[] | yes      | —             | Full item pool. Item IDs must be unique; duplicate IDs after the first are ignored. The component never mutates this array.                     |
| `leftLabel`  | `string`                                                  | no       | `"Available"` | Accessible and visible label for the left list.                                                                                                 |
| `rightLabel` | `string`                                                  | no       | `"Selected"`  | Accessible and visible label for the right list.                                                                                                |
| `value`      | `string`[]                                                | no       | —             | Unique IDs currently assigned to the right-side selected list. Supports `bind:value`. Unknown IDs are ignored and dropped on the next transfer. |
| `onChange`   | `(opaque)`                                                | no       | —             | Called with the next right-side value after a transfer. Not expressible in JSON Schema; see the component types for the signature.              |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
