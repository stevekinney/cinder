# Stat

Single metric tile displaying a labelled numeric value with optional trend or unit.

## When to use

- Surfacing a single KPI or headline number in a dashboard or summary card (revenue, users, uptime).
- Pairing related figures — wrap multiple `Stat` tiles in [`StatGroup`](../stat-group/README.md) for consistent grid layout.
- Showing a trend or change value alongside the primary number via the `change` prop.

## When not to use

- Code-change line counts (+/- additions and removals) — use [`DiffStatistics`](../diff-statistics/README.md), which is purpose-built for that display.
- Long lists of data points — use a [`Table`](../table/README.md) or [`DataList`](../data-list/README.md) instead.

## Related components

- [`StatGroup`](../stat-group/README.md) — grid wrapper for multiple `Stat` tiles with shared layout.
- [`DiffStatistics`](../diff-statistics/README.md) — specialised display for added, modified, and removed line counts.

## Usage

`Stat` is a compose-only leaf of [`StatGroup`](../stat-group/README.md).
The idiomatic API is `StatGroup.Stat`, reached through the parent
namespace — see the [stat-group README](../stat-group/README.md#usage) for the composed
snippet. The flat `@lostgradient/cinder/stat` subpath remains exported for
à-la-carte builds that import the leaf directly.

## Props

<!-- generated:props:start -->

| Prop                 | Type                 | Required | Default | Description                                                                                                                                                                                     |
| -------------------- | -------------------- | -------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `class`              | `string`             | no       | —       | Additional class names merged with `.cinder-stat`.                                                                                                                                              |
| `label`              | `string`             | yes      | —       | Short label describing the metric, e.g. "Monthly Revenue".                                                                                                                                      |
| `value`              | `string` \| `number` | yes      | —       | The statistic. Strings rendered verbatim; numbers formatted via formatNumber.                                                                                                                   |
| `valueLocale`        | `string`             | no       | —       | Locale forwarded to formatNumber (defaults to en-US).                                                                                                                                           |
| `change`             | `(opaque)`           | no       | —       | Optional change indicator with direction and accessible wording. A prop whose shape is not captured by the JSON schema; see the component types for the exact signature.                        |
| `icon`               | `(opaque)`           | no       | —       | Optional leading icon snippet (decorative — wrapper is aria-hidden). A function or snippet prop. Its shape is not captured by the JSON schema; see the component types for the exact signature. |
| `valueFormatOptions` | `(opaque)`           | no       | —       | Intl.NumberFormat options applied only when `value` is a number. A prop whose shape is not captured by the JSON schema; see the component types for the exact signature.                        |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
