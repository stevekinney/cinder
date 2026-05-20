# Toggle

A Toggle component. Replace this sentence with a one-line purpose statement once the migration settles.

## Usage

```svelte
<script lang="ts">
  import Toggle from 'cinder/toggle';
</script>

<Toggle />
```

## Props

<!-- generated:props:start -->

| Prop       | Type      | Required | Default | Description                                                                           |
| ---------- | --------- | -------- | ------- | ------------------------------------------------------------------------------------- |
| `checked`  | `boolean` | no       | —       | Whether the toggle is currently checked. Bindable — defaults to false.                |
| `class`    | `string`  | no       | —       | Additional class names merged with `.cinder-toggle`.                                  |
| `disabled` | `boolean` | no       | —       | Prevents interaction when true. Sets `disabled` attribute.                            |
| `id`       | `string`  | yes      | —       | Native id placed on the `<button>` so an external `<label for="…">` can reference it. |
| `label`    | `string`  | yes      | —       | Visible accessible name placed on `aria-label`. Required.                             |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
