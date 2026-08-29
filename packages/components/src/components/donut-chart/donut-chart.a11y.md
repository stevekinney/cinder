# DonutChart Accessibility

## Pattern

DonutChart presents a labelled part-to-whole visualization. It renders one SVG arc per non-negative datum, a center total equal to the sum of those values, and an optional text legend containing exact values. `valueLabels` is intentionally a legend/value treatment, not text painted into the arc geometry.

Purpose: Compact categorical proportion chart with an explicit total and an optional series-click interaction.

## Design review

Nearest neighbours: `BarChart`, `Statistic`, and `ChartDataTable`. BarChart remains the choice for precise magnitude comparison; DonutChart owns the radial part-to-whole relationship. A true pie variant is intentionally not added: the hollow center provides a useful total region and avoids introducing a second presentation-only component.

Visual outcome: a fixed-size ring that preserves distinct arc boundaries and places the aggregate in the center. `scrollable` creates an inline overflow escape hatch for narrow parents without changing the chart's accessible structure.

## Keyboard and focus

When `onSeriesClick` is provided, each series group is keyboard focusable with `role="button"`, an accessible label containing the series name and value, and a click activation target. Consumers should provide a callback when series activation is part of the interaction contract. Without the callback, arcs are visual marks and are not placed in the tab order. The component does not intercept arrow keys; Tab follows native document order.

## Names, roles, and state

The figure and SVG both receive the required `label`. The optional legend exposes every exact value in ordinary list semantics, so screen-reader users are not required to infer proportions from geometry or color. The center total is supplemental and never the only representation of a datum. Series color is not the sole signal; labels and values remain available.

## Verification

- Render DonutChart with positive, zero, and mixed-value data in a focused fixture.
- Navigate callback-enabled series with keyboard only and verify each accessible name.
- Inspect the figure, SVG, button groups, center total, and legend in browser accessibility tools.
- Check forced-colors mode and a narrow parent with `scrollable` enabled.

Related components: `bar-chart`, `statistic`, `table`.
