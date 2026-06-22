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

<DataList items={members} key={(member) => member.id} density="condensed">
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

| Prop       | Type                             | Required | Default | Description                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------- | -------------------------------- | -------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `class`    | `string`                         | no       | —       | Additional class merged onto the `.cinder-data-list` root element.                                                                                                                                                                                                                                                                                                                                                                  |
| `density`  | `"comfortable"` \| `"condensed"` | no       | —       | List-level density inherited by StackedListItem rows that do not set their own `density` prop. Omit to let each row use its own default. A per-row `density` always overrides this list-level value. Note: when passing a variable that may be `undefined`, spread conditionally because `exactOptionalPropertyTypes` is enabled: `{...(density ? { density } : {})}`                                                               |
| `children` | `(opaque)`                       | yes      | —       | Row renderer. MUST render an `<li>` (the list root is a `<ul role="list">`). StackedListItem is the recommended row — it renders an `<li>` with leading/title/description/meta/trailing slots. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                           |
| `empty`    | `(opaque)`                       | no       | —       | Rendered when `items` is empty. The component automatically wraps the snippet output in `<li class="cinder-data-list-empty">`. **Do NOT wrap in an `<li>` yourself** — the component provides the `<li>` wrapper automatically. Pass only inner content (e.g. a `<p>`, a `<div>`, or plain text). Contrast with `children`, which must render an `<li>`. Not expressible in JSON Schema; see the component types for the signature. |
| `items`    | `(opaque)`                       | yes      | —       | The records to render. Each is passed to `children`. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                                                                                                                                                                                                     |
| `key`      | `(opaque)`                       | yes      | —       | Key extractor for stable DOM reconciliation. Svelte uses this to identify each row when the list is reordered, filtered, or updated. Without a key, rows are matched by index and the wrong row instances may receive updated props, causing O(n) churn and incorrect rendering. `svelte <DataList {items} key={(m) => m.id}> ` Not expressible in JSON Schema; see the component types for the signature.                          |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
