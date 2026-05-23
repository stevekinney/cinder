# Rating

Star rating control with bindable numeric value, optional half-star precision, and a non-interactive readonly display mode.

## Usage

```svelte
<script lang="ts">
  import Rating from 'cinder/rating';
  let score = $state(0);
</script>

<Rating id="rating" bind:value={score} label="Quality" />
```

## Props

<!-- generated:props:start -->

| Prop              | Type                  | Required | Default | Description                                                                                                                                      |
| ----------------- | --------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `aria-label`      | `string`              | no       | —       | Group accessible name when no visible `label` is supplied.                                                                                       |
| `aria-labelledby` | `string`              | no       | —       | Space-separated list of ids that label the group when no `label` is supplied.                                                                    |
| `class`           | `string`              | no       | —       | Extra class names appended to the root group element.                                                                                            |
| `count`           | `number`              | no       | —       | Number of rating slots. Normalized to an integer in `[1, 10]`; non-finite or out-of-range values fall back to `5`.                               |
| `description`     | `string`              | no       | —       | Optional description text rendered below the rating.                                                                                             |
| `disabled`        | `boolean`             | no       | —       | Disable every rating control and the hidden input.                                                                                               |
| `error`           | `string`              | no       | —       | Optional error message; sets `aria-invalid="true"` on the rating group.                                                                          |
| `hideLabel`       | `boolean`             | no       | —       | Visually hide the rendered `label` while keeping it programmatically associated.                                                                 |
| `id`              | `string`              | yes      | —       | Stable id used as the radio-group id prefix and as the hidden input id.                                                                          |
| `label`           | `string`              | no       | —       | Visible group label rendered above the rating.                                                                                                   |
| `name`            | `string`              | no       | —       | Form-control name applied to the hidden `<input>` that submits with the form.                                                                    |
| `precision`       | `"whole"` \| `"half"` | no       | —       | Precision of each step. Defaults to `'whole'`.                                                                                                   |
| `readonly`        | `boolean`             | no       | —       | Render a non-interactive display with an accessible text equivalent.                                                                             |
| `required`        | `boolean`             | no       | —       | Mark the group as required for assistive technology.                                                                                             |
| `value`           | `number`              | no       | —       | Bindable rating value. `0` represents an unrated state. External values are clamped into `[0, count]` and snapped to the nearest precision step. |
| `onchange`        | `(opaque)`            | —        | —       | function-or-snippet                                                                                                                              |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
