# Combobox

Filterable dropdown that combines a text input with a selectable option list.

## Usage

```svelte
<script lang="ts">
  import Combobox from '@lostgradient/cinder/combobox';
</script>

<Combobox />
```

## Props

<!-- generated:props:start -->

| Prop                | Type       | Required | Default | Description                                                                                                                                                                                                                            |
| ------------------- | ---------- | -------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `aria-describedby`  | `string`   | no       | —       | External element id(s) to compose into `aria-describedby`. Composed after the component-generated description and error ids, matching the field-control contract in Select. Useful for tooltip ids, counter ids, or any external hint. |
| `class`             | `string`   | no       | —       | Additional class names merged with `.cinder-combobox`.                                                                                                                                                                                 |
| `description`       | `string`   | no       | —       | Helper text displayed below the input; wired via aria-describedby.                                                                                                                                                                     |
| `disabled`          | `boolean`  | no       | —       | Disables the combobox.                                                                                                                                                                                                                 |
| `error`             | `string`   | no       | —       | Validation error message; sets aria-invalid="true".                                                                                                                                                                                    |
| `id`                | `string`   | yes      | —       | Unique identifier — required for label association and ARIA wiring.                                                                                                                                                                    |
| `inputValue`        | `string`   | no       | —       | Free-text input value (the text the user has typed). Bindable.                                                                                                                                                                         |
| `label`             | `string`   | no       | —       | Visible label rendered in a `<label>` associated via `for`.                                                                                                                                                                            |
| `maxVisibleOptions` | `number`   | no       | —       | Hard cap on visible filtered options. Default 200.                                                                                                                                                                                     |
| `placeholder`       | `string`   | no       | —       | Placeholder when no value is selected.                                                                                                                                                                                                 |
| `filter`            | `(opaque)` | no       | —       | Custom synchronous filter. Receives an option and the current input value; returns true to keep. Defaults to case-insensitive substring match on label. Not expressible in JSON Schema; see the component types for the signature.     |
| `options`           | `(opaque)` | yes      | —       | Full set of options to filter. The sole inference source for T. Not expressible in JSON Schema; see the component types for the signature.                                                                                             |
| `value`             | `(opaque)` | no       | —       | Currently selected value. Bindable. `''` when nothing is selected. Not expressible in JSON Schema; see the component types for the signature.                                                                                          |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
