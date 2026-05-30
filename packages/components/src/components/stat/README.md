# Stat

A Stat component. Replace this sentence with a one-line purpose statement once the migration settles.

## Usage

`Stat` is a compose-only leaf of [`StatGroup`](../stat-group/README.md).
The idiomatic API is `StatGroup.Stat`, reached through the parent
namespace — see the [stat-group README](../stat-group/README.md#usage) for the composed
snippet. The flat `cinder/stat` subpath remains exported for
à-la-carte builds that import the leaf directly.

## Props

<!-- generated:props:start -->

| Prop                 | Type                 | Required | Default | Description                                                                                                                |
| -------------------- | -------------------- | -------- | ------- | -------------------------------------------------------------------------------------------------------------------------- |
| `class`              | `string`             | no       | —       | Additional class names merged with `.cinder-stat`.                                                                         |
| `label`              | `string`             | yes      | —       | Short label describing the metric, e.g. "Monthly Revenue".                                                                 |
| `value`              | `string` \| `number` | yes      | —       | The statistic. Strings rendered verbatim; numbers formatted via formatNumber.                                              |
| `valueLocale`        | `string`             | no       | —       | Locale forwarded to formatNumber (defaults to en-US).                                                                      |
| `change`             | `(opaque)`           | no       | —       | A prop whose shape is not captured by the JSON schema; see the component types for the exact signature.                    |
| `icon`               | `(opaque)`           | no       | —       | A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |
| `valueFormatOptions` | `(opaque)`           | no       | —       | A prop whose shape is not captured by the JSON schema; see the component types for the exact signature.                    |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
