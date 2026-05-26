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

| Prop        | Type      | Required | Default | Description                                                                                                     |
| ----------- | --------- | -------- | ------- | --------------------------------------------------------------------------------------------------------------- |
| `checked`   | `boolean` | no       | —       | Whether the toggle is currently checked. Bindable — defaults to false.                                          |
| `class`     | `string`  | no       | —       | Additional class names merged with `.cinder-toggle` on the switch button.                                       |
| `disabled`  | `boolean` | no       | —       | Prevents interaction when true. Sets `disabled` attribute.                                                      |
| `hideLabel` | `boolean` | no       | —       | Visually hide the rendered label while keeping it as the accessible name. Use for icon-only or inline contexts. |
| `id`        | `string`  | yes      | —       | Native id placed on the `<button>` so the rendered `<label for="…">` can reference it.                          |
| `label`     | `string`  | yes      | —       | Visible label text. Always the accessible name, even when `hideLabel` is set. Required.                         |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
