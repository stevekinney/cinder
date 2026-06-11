# StackedListItem

Single row within a stacked list, typically pairing a label with metadata or an action.

## Usage

```svelte
<script lang="ts">
  import StackedListItem from '@lostgradient/cinder/stacked-list-item';
</script>

<StackedListItem />
```

## Props

<!-- generated:props:start -->

| Prop          | Type                             | Required | Default | Description                                                                                                                                                                                                                 |
| ------------- | -------------------------------- | -------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `class`       | `string`                         | no       | —       | Merged with `cinder-stacked-list-item`.                                                                                                                                                                                     |
| `density`     | `"comfortable"` \| `"condensed"` | no       | —       | Density token surfaced as `data-cinder-density`. When omitted, inherits the enclosing DataList's list-level `density` (if any), then falls back to `comfortable`. An explicit value here always overrides the list default. |
| `href`        | `string`                         | no       | —       |                                                                                                                                                                                                                             |
| `hreflang`    | `string` \| `null`               | no       | —       |                                                                                                                                                                                                                             |
| `rel`         | `string` \| `null`               | no       | —       |                                                                                                                                                                                                                             |
| `description` | `(opaque)`                       | no       | —       | Secondary description below the title. Not expressible in JSON Schema; see the component types for the signature.                                                                                                           |
| `leading`     | `(opaque)`                       | no       | —       | Leading visual (avatar, icon, status dot). Not expressible in JSON Schema; see the component types for the signature.                                                                                                       |
| `meta`        | `(opaque)`                       | no       | —       | Tertiary metadata (timestamp, badge, system label). Not expressible in JSON Schema; see the component types for the signature.                                                                                              |
| `target`      | `(opaque)`                       | no       | —       | A prop whose shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                     |
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
