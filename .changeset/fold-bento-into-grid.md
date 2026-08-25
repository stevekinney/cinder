---
'@lostgradient/cinder': minor
---

Remove `BentoGrid` and `BentoGrid.Cell`/`BentoCell` and fold their behavior into `Grid` and `Grid.Item`. `bento-grid.css` shipped zero CSS rules of its own — the mosaic layout was always `Grid` underneath — so the bento mosaic is now a documented recipe built from `Grid` and `Grid.Item` rather than a separate component pair, following the marketing-family precedent set in #1226.

Migration: replace `<BentoGrid columns={4} collapse>` with `<Grid columns="repeat(4, minmax(0, 1fr))" narrowCollapseEnabled>`, and replace `<BentoGrid.Cell columnSpan={2} rowSpan={2}>` with `<Grid.Item span={2} rowSpan={2}>` (`Grid.Item`'s incumbent prop is `span`, not `columnSpan`). `Grid.Item` gains a new `rowEnd` prop mirroring the existing `columnEnd`; when both `rowEnd` and `rowSpan` are set on the same `Grid.Item`, `rowEnd` wins, matching `BentoCell`'s prior suppression behavior. There is no compatibility alias for `BentoGridProps`, `BentoGridColumns`, `BentoCellProps`, or the `.cinder-bento-grid`/`.cinder-bento-cell` class hooks — remove any code or CSS that targets them directly.

Also, `Grid`'s numeric `columns` prop now maps to `repeat(<columns>, minmax(0, 1fr))` instead of `repeat(<columns>, 1fr)`, matching what `BentoGrid` (and `ChoiceGrid`, which composes on `Grid`) already did internally. This is a deliberate breaking visual change for any `Grid` consumer relying on bare `1fr` tracks with content wider than the track — `minmax(0, 1fr)` lets tracks shrink below their content's intrinsic width instead of overflowing. The `narrowCollapseEnabled` default on `Grid` remains `false`; the bento mosaic recipe passes it explicitly.

A live example of the recipe is available under the Grid documentation as "Asymmetric bento mosaic".
