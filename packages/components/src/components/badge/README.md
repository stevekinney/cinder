# Badge

A small inline label for status, category, or count display.

Use Badge for attached counts, statuses, and compact annotations; use `Chip mode="display"` when the item is an issue label or tag.

## Usage

```svelte
<script lang="ts">
  import Badge from '@lostgradient/cinder/badge';
</script>

<Badge variant="success">Published</Badge>
```

## Props

<!-- generated:props:start -->

| Prop      | Type                                                                              | Required | Default     | Description                               |
| --------- | --------------------------------------------------------------------------------- | -------- | ----------- | ----------------------------------------- |
| `class`   | `string`                                                                          | no       | —           | Custom class merged with `.cinder-badge`. |
| `size`    | `"xs"` \| `"sm"` \| `"md"`                                                        | no       | `"md"`      | Size of the badge.                        |
| `variant` | `"neutral"` \| `"success"` \| `"warning"` \| `"danger"` \| `"info"` \| `"accent"` | no       | `"neutral"` | Visual style.                             |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
