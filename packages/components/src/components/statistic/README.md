# Statistic

Single metric tile displaying a labelled numeric value with optional trend or unit.

## Choosing this component

- Surfacing a single KPI or headline number in a dashboard or summary card (revenue, users, uptime).
- Pairing related figures — wrap multiple `Statistic` tiles in [`StatisticGroup`](../statistic-group/README.md) for consistent grid layout.
- Showing a trend or change value alongside the primary number via the `change` prop.

## Choosing something else

- Code-change line counts (+/- additions and removals) — use [`DiffStatistics`](../diff-statistics/README.md), which is purpose-built for that display.
- Long lists of data points — use a [`Table`](../table/README.md) or [`DataList`](../data-list/README.md) instead.

## Related components

- [`StatisticGroup`](../statistic-group/README.md) — grid wrapper for multiple `Statistic` tiles with shared layout.
- [`DiffStatistics`](../diff-statistics/README.md) — specialised display for added, modified, and removed line counts.

## Usage

`Statistic` is a compose-only leaf of [`StatisticGroup`](../statistic-group/README.md).
The idiomatic API is `StatisticGroup.Statistic`, reached through the parent
namespace — see the [statistic-group README](../statistic-group/README.md#usage) for the composed
snippet. The flat `@lostgradient/cinder/statistic` subpath remains exported for
à-la-carte builds that import the leaf directly.

## Props

<!-- generated:props:start -->

| Prop                 | Type                 | Required | Default | Description                                                                                                                                     |
| -------------------- | -------------------- | -------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `class`              | `string`             | no       | —       | Additional class names merged with `.cinder-statistic`.                                                                                         |
| `label`              | `string`             | yes      | —       | Short label describing the metric, e.g. "Monthly Revenue".                                                                                      |
| `style`              | `string`             | no       | —       | Inline style string applied to the `.cinder-statistic` root.                                                                                    |
| `value`              | `string` \| `number` | yes      | —       | The statistic. Strings rendered verbatim; numbers formatted via formatNumber.                                                                   |
| `valueLocale`        | `string`             | no       | —       | Locale forwarded to formatNumber. Defaults to the nearest LocaleProvider locale, then en-US.                                                    |
| `change`             | `(opaque)`           | no       | —       | Optional change indicator with direction and accessible wording. Not expressible in JSON Schema; see the component types for the signature.     |
| `icon`               | `(opaque)`           | no       | —       | Optional leading icon snippet (decorative — wrapper is aria-hidden). Not expressible in JSON Schema; see the component types for the signature. |
| `valueFormatOptions` | `(opaque)`           | no       | —       | Intl.NumberFormat options applied only when `value` is a number. Not expressible in JSON Schema; see the component types for the signature.     |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

- `--cinder-statistic-change-font-size`
- `--cinder-statistic-change-gap`
- `--cinder-statistic-column-gap`
- `--cinder-statistic-label-font-size`
- `--cinder-statistic-row-gap`
- `--cinder-statistic-value-font-size`
- `--cinder-statistic-value-font-weight`
- `--cinder-statistic-value-line-height`
<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
