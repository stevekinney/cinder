# Combobox

A Combobox component. Replace this sentence with a one-line purpose statement once the migration settles.

## Usage

```svelte
<script lang="ts">
  import Combobox from 'cinder/combobox';
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
| `filter`            | `(opaque)` | —        | —       | function-or-snippet                                                                                                                                                                                                                    |
| `options`           | `(opaque)` | —        | —       | unknown-shape                                                                                                                                                                                                                          |
| `value`             | `(opaque)` | —        | —       | generic-type-parameter                                                                                                                                                                                                                 |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
