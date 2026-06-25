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

| Prop                | Type                                                                                      | Required | Default     | Description                                                                                                                                                                                                                                                               |
| ------------------- | ----------------------------------------------------------------------------------------- | -------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `class`             | `string`                                                                                  | no       | —           | Custom class merged with `.cinder-badge`.                                                                                                                                                                                                                                 |
| `mono`              | `boolean`                                                                                 | no       | `false`     | Render the badge label in a monospace font. Useful for version strings, error codes, or other technical labels.                                                                                                                                                           |
| `size`              | `"xs"` \| `"sm"` \| `"md"`                                                                | no       | `"md"`      | Size of the badge.                                                                                                                                                                                                                                                        |
| `subscriptionState` | `"active"` \| `"trialing"` \| `"past-due"` \| `"canceled"` \| `"expired"` \| `"refunded"` | no       | —           | Render a standardized subscription lifecycle badge without hand-wiring tone, icon, and label.                                                                                                                                                                             |
| `variant`           | `"neutral"` \| `"success"` \| `"warning"` \| `"danger"` \| `"info"` \| `"accent"`         | no       | `"neutral"` | Visual style.                                                                                                                                                                                                                                                             |
| `children`          | `(opaque)`                                                                                | no       | —           | Badge content — intentionally required. A badge without content is semantically meaningless. The render site uses optional chaining (`children?.()`) as a runtime safety net for JS consumers. Not expressible in JSON Schema; see the component types for the signature. |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
