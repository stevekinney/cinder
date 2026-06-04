# Surface

A themed container that publishes its tone to descendant components through Svelte context.

## Usage

```svelte
<script lang="ts">
  import Surface from '@lostgradient/cinder/surface';
</script>

<Surface tone="raised">Content</Surface>
```

## Props

<!-- generated:props:start -->

| Prop    | Type                                                      | Required | Default     | Description            |
| ------- | --------------------------------------------------------- | -------- | ----------- | ---------------------- |
| `class` | `string`                                                  | no       | —           | Additional CSS classes |
| `tone`  | `"default"` \| `"raised"` \| `"inset"` \| `"transparent"` | no       | `"default"` | Surface tone.          |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

<!-- generated:subcomponents:end -->
