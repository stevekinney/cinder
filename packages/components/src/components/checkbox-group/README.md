# CheckboxGroup

A CheckboxGroup component. Replace this sentence with a one-line purpose statement once the migration settles.

## Usage

```svelte
<script lang="ts">
  import CheckboxGroup from 'cinder/checkbox-group';
</script>

<CheckboxGroup />
```

## Props

<!-- generated:props:start -->

| Prop          | Type                    | Required | Default | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------- | ----------------------- | -------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `class`       | `string`                | no       | —       | Additional class names merged with `.cinder-checkbox-group`.                                                                                                                                                                                                                                                                                                                                                                                                     |
| `description` | `string`                | no       | —       | Helper text below the group; wired via `aria-describedby` on the fieldset.                                                                                                                                                                                                                                                                                                                                                                                       |
| `disabled`    | `boolean`               | no       | —       | Disables every native form control inside via the fieldset's built-in cascade. Renders as the native `disabled` attribute on `<fieldset>`.                                                                                                                                                                                                                                                                                                                       |
| `error`       | `string`                | no       | —       | Group-level validation message. Rendered as a polite live region and referenced by the fieldset's `aria-describedby`. Also sets `aria-invalid="true"` on the fieldset itself as a supplementary signal. Note: fieldset-level `aria-describedby` is not reliably re-announced as focus moves between descendants. This is best-effort supplemental context — if a specific control must announce as invalid on focus, pass `error` to that `<Checkbox>` directly. |
| `legend`      | `string`                | no       | —       | Optional legend rendered as a `<legend>` inside the `<fieldset>`.                                                                                                                                                                                                                                                                                                                                                                                                |
| `required`    | `boolean`               | no       | —       | Marks the group as visually required. Sets `data-cinder-required` on the fieldset so consumers can target it (e.g. legend asterisk). This is a visual/data-attribute hint. It does NOT set `required` on any child `<input>` and does NOT enforce constraint validation. Per-control `required` must be set on the individual `<Checkbox>`.                                                                                                                      |
| `variant`     | `"default"` \| `"card"` | no       | —       | Layout variant. `'default'` is a stacked column. `'card'` styles each direct child `.cinder-checkbox-field` as a bordered card row. Always emitted as `data-variant` on the fieldset. Card variant assumes each direct child of the items container is a single `<Checkbox>`.                                                                                                                                                                                    |
| `children`    | `(opaque)`              | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature.                                                                                                                                                                                                                                                                                                                                       |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
