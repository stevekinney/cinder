# StackedListItem

Single row within a stacked list, typically pairing a label with metadata or an action.

## Usage

```svelte
<script lang="ts">
  import { DataList } from '@lostgradient/cinder/data-list';
  import { StackedListItem } from '@lostgradient/cinder/stacked-list-item';

  const members = [{ id: 'alice', name: 'Alice Chen', role: 'Engineer' }];
</script>

<DataList items={members} key={(member) => member.id}>
  {#snippet children(member)}
    <StackedListItem>
      {#snippet title()}{member.name}{/snippet}
      {#snippet meta()}{member.role}{/snippet}
    </StackedListItem>
  {/snippet}
</DataList>
```

## Props

<!-- generated:props:start -->

| Prop          | Type                             | Required | Default | Description                                                                                                                                                                                                                 |
| ------------- | -------------------------------- | -------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `class`       | `string`                         | no       | —       | Merged with `cinder-stacked-list-item`.                                                                                                                                                                                     |
| `density`     | `"comfortable"` \| `"condensed"` | no       | —       | Density token surfaced as `data-cinder-density`. When omitted, inherits the enclosing DataList's list-level `density` (if any), then falls back to `comfortable`. An explicit value here always overrides the list default. |
| `href`        | `string`                         | no       | —       | Destination URL that turns the `title` snippet into an `<a>` link for the row.                                                                                                                                              |
| `hreflang`    | `string` \| `null`               | no       | —       | `hreflang` attribute forwarded to the title anchor, indicating the language of the linked resource.                                                                                                                         |
| `rel`         | `string` \| `null`               | no       | —       | `rel` attribute forwarded to the title anchor; `noopener noreferrer` is merged automatically when `target="_blank"`.                                                                                                        |
| `description` | `(opaque)`                       | no       | —       | Secondary description below the title. Not expressible in JSON Schema; see the component types for the signature.                                                                                                           |
| `leading`     | `(opaque)`                       | no       | —       | Leading visual (avatar, icon, status dot). Not expressible in JSON Schema; see the component types for the signature.                                                                                                       |
| `meta`        | `(opaque)`                       | no       | —       | Tertiary metadata (timestamp, badge, system label). Not expressible in JSON Schema; see the component types for the signature.                                                                                              |
| `target`      | `(opaque)`                       | no       | —       | Browsing context for the title anchor (`_blank`, `_self`, `_parent`, `_top`, or a named frame). Not expressible in JSON Schema; see the component types for the signature.                                                  |
| `title`       | `(opaque)`                       | yes      | —       | Primary label. Required. Not expressible in JSON Schema; see the component types for the signature.                                                                                                                         |
| `trailing`    | `(opaque)`                       | no       | —       | Trailing region (chevron, action button, dropdown trigger). Not expressible in JSON Schema; see the component types for the signature.                                                                                      |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
