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

## Theming

With no `theme`, Statistic paints its value from `--cinder-text-default` and its label, icon, and change description from `--cinder-text-muted`, keeping the background transparent. The muted token is what separates the label from the value, so it is a real token rather than an opacity on inherited text — the label is body text and has to clear the 4.5:1 contrast floor on its own.

Pass a partial `theme` when a statistic needs an explicit local foreground, muted color, or background — on a custom-coloured panel, for instance. Supplying a `theme` switches the omitted fields back to inheriting `currentColor` from the surrounding application, so a partial theme never mixes your explicit colours with the global tokens: `theme={{ foreground: 'white', background: 'black' }}` leaves the label inheriting white rather than dropping the app's dark muted token onto a black surface. To make an unthemed-looking Statistic follow an ancestor's `color` instead of the tokens, ask for it explicitly with `theme={{ foreground: 'currentColor', muted: 'currentColor' }}`.

Change direction remains visible through its arrow glyph, signed value, description, and screen-reader text rather than color alone.

## Props

<!-- generated:props:start -->

| Prop                 | Type                                                                                                      | Required | Default | Description                                                                                                                                     |
| -------------------- | --------------------------------------------------------------------------------------------------------- | -------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `class`              | `string`                                                                                                  | no       | —       | Additional class names merged with `.cinder-statistic`.                                                                                         |
| `label`              | `string`                                                                                                  | yes      | —       | Short label describing the metric, e.g. "Monthly Revenue".                                                                                      |
| `style`              | `string`                                                                                                  | no       | —       | Inline style string applied to the `.cinder-statistic` root.                                                                                    |
| `theme`              | { background?: `string`; foreground?: `string`; grid?: `string`; muted?: `string`; palette?: `string`[] } | no       | —       | Partial visual theme override. Omitted fields inherit the surrounding application.                                                              |
| `value`              | `string` \| `number`                                                                                      | yes      | —       | The statistic. Strings rendered verbatim; numbers formatted via formatNumber.                                                                   |
| `valueLocale`        | `string`                                                                                                  | no       | —       | Locale forwarded to formatNumber. Defaults to the nearest LocaleProvider locale, then en-US.                                                    |
| `change`             | `(opaque)`                                                                                                | no       | —       | Optional change indicator with direction and accessible wording. Not expressible in JSON Schema; see the component types for the signature.     |
| `icon`               | `(opaque)`                                                                                                | no       | —       | Optional leading icon snippet (decorative — wrapper is aria-hidden). Not expressible in JSON Schema; see the component types for the signature. |
| `valueFormatOptions` | `(opaque)`                                                                                                | no       | —       | Intl.NumberFormat options applied only when `value` is a number. Not expressible in JSON Schema; see the component types for the signature.     |

<!-- generated:props:end -->

## CSS Variables

<!-- generated:variables:start -->

This component does not declare any local CSS variables.

<!-- generated:variables:end -->

## Subcomponents

<!-- generated:subcomponents:start -->

None.

<!-- generated:subcomponents:end -->
