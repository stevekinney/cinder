# DescriptionList

A DescriptionList component. Replace this sentence with a one-line purpose statement once the migration settles.

## Usage

```svelte
<script lang="ts">
  import DescriptionList from 'cinder/description-list';
</script>

<DescriptionList />
```

## Props

<!-- generated:props:start -->

| Prop      | Type                                                       | Required | Default | Description                                                                                                                                                                                                                                                                                                                                                              |
| --------- | ---------------------------------------------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `class`   | `string`                                                   | no       | —       |                                                                                                                                                                                                                                                                                                                                                                          |
| `items`   | `object`[]                                                 | yes      | —       |                                                                                                                                                                                                                                                                                                                                                                          |
| `variant` | `"default"` \| `"striped"` \| `"two-column"` \| `"narrow"` | no       | —       | Controls the visual layout: - `default`: stacked rows with visible terms. - `striped`: alternating row backgrounds. - `two-column`: term and definition share a row; collapses to stacked at narrow widths. - `narrow`: `<dt>` is visually hidden via `.cinder-sr-only`. Only appropriate when surrounding context already labels the value. NOT a general compact mode. |
| `actions` | `(opaque)`                                                 | —        | —       | function-or-snippet                                                                                                                                                                                                                                                                                                                                                      |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
