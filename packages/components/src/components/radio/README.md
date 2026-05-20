# Radio

A Radio component. Replace this sentence with a one-line purpose statement once the migration settles.

## Usage

```svelte
<script lang="ts">
  import Radio from 'cinder/radio';
</script>

<Radio />
```

## Props

<!-- generated:props:start -->

| Prop          | Type       | Required | Default | Description                                                                      |
| ------------- | ---------- | -------- | ------- | -------------------------------------------------------------------------------- |
| `description` | `string`   | no       | —       | Helper text rendered as `<p id="{id}-description">`, wired via aria-describedby. |
| `disabled`    | `boolean`  | no       | —       | Override the group's `disabled` for this single radio.                           |
| `id`          | `string`   | yes      | —       | Unique identifier — required for label association.                              |
| `label`       | `string`   | yes      | —       | Visible label rendered in a `<label>` element associated via `for`.              |
| `class`       | `(opaque)` | —        | —       | unknown-shape                                                                    |
| `value`       | `(opaque)` | —        | —       | unknown-shape                                                                    |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
