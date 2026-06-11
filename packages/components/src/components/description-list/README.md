# DescriptionList

Semantic dl/dt/dd list for term–description pairs such as metadata or attributes.

## Usage

```svelte
<script lang="ts">
  import DescriptionList from '@lostgradient/cinder/description-list';
</script>

<DescriptionList />
```

## Props

<!-- generated:props:start -->

| Prop      | Type                                                       | Required | Default | Description                                                                                                                                                                                                                                                                                                                                                              |
| --------- | ---------------------------------------------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `class`   | `string`                                                   | no       | —       |                                                                                                                                                                                                                                                                                                                                                                          |
| `variant` | `"default"` \| `"striped"` \| `"two-column"` \| `"narrow"` | no       | —       | Controls the visual layout: - `default`: stacked rows with visible terms. - `striped`: alternating row backgrounds. - `two-column`: term and definition share a row; collapses to stacked at narrow widths. - `narrow`: `<dt>` is visually hidden via `.cinder-sr-only`. Only appropriate when surrounding context already labels the value. NOT a general compact mode. |
| `actions` | `(opaque)`                                                 | no       | —       | Optional snippet rendered once per row. Receives the full `DescriptionListItem` so consumers can build disambiguated `aria-label` strings (e.g. `aria-label="Edit ${item.term}"`). Any interactive element in `actions` MUST set an unambiguous `aria-label`. Not expressible in JSON Schema; see the component types for the signature.                                 |
| `items`   | `(opaque)`                                                 | yes      | —       | A prop whose shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                                                                                                                  |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
