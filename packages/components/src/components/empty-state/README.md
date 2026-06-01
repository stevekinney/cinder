# EmptyState

Placeholder layout for zero-data views, with optional illustration, heading, and action.

## Usage

```svelte
<script lang="ts">
  import EmptyState from 'cinder/empty-state';
</script>

<EmptyState />
```

## Props

<!-- generated:props:start -->

| Prop           | Type                                   | Required | Default | Description                                                                                                                |
| -------------- | -------------------------------------- | -------- | ------- | -------------------------------------------------------------------------------------------------------------------------- |
| `class`        | `string`                               | no       | —       |                                                                                                                            |
| `description`  | `string`                               | no       | —       |                                                                                                                            |
| `headingLevel` | `1` \| `2` \| `3` \| `4` \| `5` \| `6` | no       | `3`     | Heading level for the title element.                                                                                       |
| `title`        | `string`                               | yes      | —       |                                                                                                                            |
| `action`       | `(opaque)`                             | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |
| `icon`         | `(opaque)`                             | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
