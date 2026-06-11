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
| `description` | `(opaque)`                       | no       | —       | Secondary description below the title. A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                           |
| `leading`     | `(opaque)`                       | no       | —       | Leading visual (avatar, icon, status dot). A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                       |
| `meta`        | `(opaque)`                       | no       | —       | Tertiary metadata (timestamp, badge, system label). A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                              |
| `target`      | `(opaque)`                       | no       | —       | A prop whose shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                     |
| `title`       | `(opaque)`                       | yes      | —       | Primary label. Required. A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                         |
| `trailing`    | `(opaque)`                       | no       | —       | Trailing region (chevron, action button, dropdown trigger). A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                      |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
