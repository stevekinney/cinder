# RadioGroup

A RadioGroup component. Replace this sentence with a one-line purpose statement once the migration settles.

## Usage

```svelte
<script lang="ts">
  import RadioGroup from 'cinder/radio-group';
</script>

<RadioGroup />
```

## Props

<!-- generated:props:start -->

| Prop          | Type                    | Required | Default | Description                                                                          |
| ------------- | ----------------------- | -------- | ------- | ------------------------------------------------------------------------------------ |
| `class`       | `string`                | no       | —       | Additional class names merged with `.cinder-radio-group`.                            |
| `description` | `string`                | no       | —       | Helper text displayed below the group; wired via `aria-describedby` on the fieldset. |
| `disabled`    | `boolean`               | no       | —       | Disables the entire group.                                                           |
| `error`       | `string`                | no       | —       | Validation error message; sets `aria-invalid="true"` on the group's children.        |
| `legend`      | `string`                | no       | —       | Optional legend rendered as a `<legend>` inside the `<fieldset>`.                    |
| `name`        | `string`                | yes      | —       | Shared `name` for all radios in the group; required for native form submission.      |
| `required`    | `boolean`               | no       | —       | When true, marks the group's radios as required for form submission.                 |
| `value`       | `string`                | no       | —       | Bound selected value.                                                                |
| `variant`     | `"default"` \| `"card"` | no       | —       | Visual layout. 'card' wraps each radio row in a bordered surface.                    |
| `children`    | `(opaque)`              | —        | —       | function-or-snippet                                                                  |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
