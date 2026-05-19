# Spinner

A loading indicator with size variants and an accessible status label.

## Usage

```svelte
<script lang="ts">
  import Spinner from 'cinder/spinner';
</script>

<Spinner size="md" label="Loading" />
```

## Props

<!-- generated:props:start -->

| Prop    | Type                       | Required | Default     | Description                                 |
| ------- | -------------------------- | -------- | ----------- | ------------------------------------------- |
| `class` | `string`                   | no       | —           | Extra classes appended to the root element. |
| `label` | `string`                   | no       | `"Loading"` | Accessible loading label.                   |
| `size`  | `"sm"` \| `"md"` \| `"lg"` | no       | `"md"`      | Spinner size.                               |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

- `--cinder-spinner-size`
<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

<!-- generated:subcomponents:end -->
