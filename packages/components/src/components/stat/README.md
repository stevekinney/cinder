# Stat

A Stat component. Replace this sentence with a one-line purpose statement once the migration settles.

## Usage

```svelte
<script lang="ts">
  import Stat from 'cinder/stat';
</script>

<Stat />
```

## Props

<!-- generated:props:start -->

| Prop                 | Type                 | Required | Default | Description                                                                   |
| -------------------- | -------------------- | -------- | ------- | ----------------------------------------------------------------------------- |
| `change`             | `object`             | no       | —       | Optional change indicator with direction and accessible wording.              |
| `class`              | `string`             | no       | —       | Additional class names merged with `.cinder-stat`.                            |
| `label`              | `string`             | yes      | —       | Short label describing the metric, e.g. "Monthly Revenue".                    |
| `value`              | `string` \| `number` | yes      | —       | The statistic. Strings rendered verbatim; numbers formatted via formatNumber. |
| `valueFormatOptions` | `object`             | no       | —       | Intl.NumberFormat options applied only when `value` is a number.              |
| `valueLocale`        | `string`             | no       | —       | Locale forwarded to formatNumber (defaults to en-US).                         |
| `icon`               | `(opaque)`           | —        | —       | function-or-snippet                                                           |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
