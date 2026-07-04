# Sparkbar · accessibility

## Pattern

Sparkbar communicates a bounded measurement in a compact labeled row.

Purpose: Inline meter for dense cost, token, budget, or quota breakdowns where a full chart would be too heavy.

## Use when

- Showing a bounded value next to a visible label and optional trailing value.
- Comparing several compact usage or spend rows in a summary surface.

## Avoid when

- Reporting task completion over time such as uploads/imports — use progress.
- Rendering axes, scales, or multiple series — use bar-chart.

## Keyboard and focus

Sparkbar is non-interactive and does not enter the tab order by default. Do not add keyboard handlers unless the surrounding composition introduces a real interactive control with visible focus and matching semantics.

## Names, roles, and state

Sparkbar renders `role="meter"` with `aria-valuemin`, `aria-valuemax`, `aria-valuenow`, and `aria-valuetext`. The accessible name defaults to the visible label plus percentage; pass `ariaLabel` when the surrounding context needs a more specific name.

Do not rely on fill color alone to communicate meaning. Use the visible label, trailing value, and surrounding copy to identify what is being measured.

## Verification

- Render Sparkbar in the playground or a focused test fixture.
- Inspect the accessible name, `meter` role, and value state in browser accessibility tools.
- Check forced-colors mode when using variant colors.

Related components: `meter`, `progress`, `bar-chart`.
