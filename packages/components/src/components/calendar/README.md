# Calendar

Keyboard-navigable month grid for selecting a single local calendar date.

## Usage

```svelte
<script lang="ts">
  import { Calendar } from '@lostgradient/cinder/calendar';

  let value = $state<string | undefined>('2026-06-29');
</script>

<Calendar bind:value />
```

## Props

<!-- generated:props:start -->

| Prop             | Type       | Required | Default | Description                                                                                                              |
| ---------------- | ---------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------ |
| `class`          | `string`   | no       | —       | Additional classes for the root node.                                                                                    |
| `disabled`       | `boolean`  | no       | —       | Disable interaction.                                                                                                     |
| `firstDayOfWeek` | `number`   | no       | —       | First weekday index, `0` Sunday to `6` Saturday. Defaults to `0`.                                                        |
| `id`             | `string`   | no       | —       | Optional root id.                                                                                                        |
| `label`          | `string`   | no       | —       | Accessible label for the grid. Defaults to `Calendar`.                                                                   |
| `locale`         | `string`   | no       | —       | Localized month label locale. Defaults to `en-US`.                                                                       |
| `max`            | `string`   | no       | —       | Latest selectable day (`YYYY-MM-DD`).                                                                                    |
| `min`            | `string`   | no       | —       | Earliest selectable day (`YYYY-MM-DD`).                                                                                  |
| `month`          | `string`   | no       | —       | Visible month anchor (`YYYY-MM-DD`), defaults to selected date or today.                                                 |
| `value`          | `string`   | no       | —       | Selected ISO date (`YYYY-MM-DD`). Bindable.                                                                              |
| `disabledDate`   | `(opaque)` | no       | —       | Return true to disable a specific day. Not expressible in JSON Schema; see the component types for the signature.        |
| `onchange`       | `(opaque)` | no       | —       | Called when the user commits a day selection. Not expressible in JSON Schema; see the component types for the signature. |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->
<!-- generated:subcomponents:end -->
