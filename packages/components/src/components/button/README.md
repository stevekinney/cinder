# Button

A clickable button or anchor with built-in loading state, icon slots, and a discriminated prop union that forces consumers to provide an accessible name at compile time.

## Usage

```svelte
<script lang="ts">
  import Button from '@lostgradient/cinder/button';
</script>

<Button variant="primary" size="md" label="Save" />
```

When `href` is set, the component renders as `<a>`; otherwise it renders as `<button>`. Setting `loading` swaps in a spinner, blocks the consumer's `onclick`, forces `aria-disabled` / `aria-busy`, and strips `href` to prevent navigation.

## Props

<!-- generated:props:start -->

| Prop        | Type                                                                                                       | Required | Default       | Description                                                              |
| ----------- | ---------------------------------------------------------------------------------------------------------- | -------- | ------------- | ------------------------------------------------------------------------ |
| `class`     | `string`                                                                                                   | no       | —             | Custom class merged with `.cinder-button`.                               |
| `fullWidth` | `boolean`                                                                                                  | no       | `false`       | Expand to container width.                                               |
| `href`      | `string`                                                                                                   | no       | —             | Render as an anchor `<a>` element with this href.                        |
| `iconOnly`  | `boolean`                                                                                                  | no       | `false`       | Render the button with only an icon. Requires an accessible name source. |
| `label`     | `string`                                                                                                   | no       | —             | Visible text label. Must be non-empty if provided.                       |
| `loading`   | `boolean`                                                                                                  | no       | `false`       | Disable the button and show a spinner.                                   |
| `size`      | `"xs"` \| `"sm"` \| `"md"` \| `"lg"` \| `"xl"`                                                             | no       | `"md"`        | Size of the button.                                                      |
| `variant`   | `"primary"` \| `"secondary"` \| `"soft"` \| `"danger"` \| `"soft-danger"` \| `"ghost"` \| `"ghost-danger"` | no       | `"secondary"` | Visual style.                                                            |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
