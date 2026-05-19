# Kbd

A styled keyboard key element for displaying keyboard shortcuts in help text and command palettes.

## Usage

```svelte
<script lang="ts">
  import Kbd from 'cinder/kbd';
</script>

<Kbd label="⌘K" />
```

## Props

<!-- generated:props:start -->

| Prop    | Type             | Required | Default | Description                                       |
| ------- | ---------------- | -------- | ------- | ------------------------------------------------- |
| `class` | `string`         | no       | —       | Additional class names merged with `.cinder-kbd`. |
| `label` | `string`         | no       | —       | Key label content.                                |
| `size`  | `"sm"` \| `"md"` | no       | `"md"`  | Keyboard key size.                                |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
