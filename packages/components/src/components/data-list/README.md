# DataList

A semantic list container (`<ul role="list">`) for a homogeneous collection of
records. DataList owns the list element, the list reset, and the empty state; it
delegates row chrome (padding, dividers, density) to the row primitive. Each
record is rendered through the `children` snippet, which **must** render an
`<li>` — [`StackedListItem`](../stacked-list-item/README.md) is the recommended
row.

Reach for DataList when you have a vertical list of like records. For key–value
metadata about a single entity use [`DescriptionList`](../description-list/README.md);
for tabular rows and columns use [`Table`](../table/README.md).

## Usage

```svelte
<script lang="ts">
  import { DataList } from '@lostgradient/cinder/data-list';
  import { StackedListItem } from '@lostgradient/cinder/stacked-list-item';

  const members = [
    { id: 'a', name: 'Alice Chen', role: 'Engineer' },
    { id: 'b', name: 'Bob Osei', role: 'Designer' },
  ];
</script>

<DataList items={members} density="condensed">
  {#snippet children(member)}
    <StackedListItem>
      {#snippet title()}{member.name}{/snippet}
      {#snippet meta()}{member.role}{/snippet}
    </StackedListItem>
  {/snippet}
  {#snippet empty()}
    No members yet.
  {/snippet}
</DataList>
```

A list-level `density` is inherited by every `StackedListItem` row that does not
set its own `density` prop. The `empty` snippet renders inside a component-owned
`<li class="cinder-data-list-empty">`, so it needs no inline styling.

## Props

<!-- generated:props:start -->

| Prop       | Type                             | Required | Default | Description                                                                                                                                                                                                                                                                                                                                                           |
| ---------- | -------------------------------- | -------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `class`    | `string`                         | no       | —       |                                                                                                                                                                                                                                                                                                                                                                       |
| `density`  | `"comfortable"` \| `"condensed"` | no       | —       | List-level density inherited by StackedListItem rows that do not set their own `density` prop. Omit to let each row use its own default. A per-row `density` always overrides this list-level value. Note: when passing a variable that may be `undefined`, spread conditionally because `exactOptionalPropertyTypes` is enabled: `{...(density ? { density } : {})}` |
| `children` | `(opaque)`                       | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                                                                                            |
| `empty`    | `(opaque)`                       | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                                                                                            |
| `items`    | `(opaque)`                       | no       | —       | A generically typed prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                                                                                              |
| `key`      | `(opaque)`                       | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                                                                                            |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
