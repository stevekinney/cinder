---
'@lostgradient/cinder': patch
---

fix(statistic): restore the muted text hierarchy for unthemed Statistics

`Statistic` resolved its colours through `resolveChartTheme()`, whose
unthemed defaults are `currentColor` for both `foreground` and `muted`.
Because the component writes those as **inline** custom properties, the
`var(--_cinder-chart-*, …)` fallbacks in `statistic.css` could never apply —
so a `Statistic` rendered without an explicit `theme` painted its label,
icon, and change description at full text colour, visually identical to the
value. The label/value hierarchy that `--cinder-text-muted` provided was
silently lost for every consumer that doesn't pass a chart theme.

The chart components absorb the same `currentColor` default with a
compensating `opacity` on their tick labels. That is the wrong tool here:
this is body text, which has to clear the 4.5:1 AA floor rather than land
wherever a multiplier puts it — the same reasoning that moved status text
off the fill tokens in 0.21.

Unthemed `Statistic` now defaults to the contrast-tuned text tokens
(`--cinder-text` / `--cinder-text-muted`). The substitution is all-or-nothing on
`theme`'s presence rather than per-field: supplying any theme — including a
partial one — keeps `resolveChartTheme()`'s `currentColor` inheritance for the
fields it omits, so `theme={{ foreground: 'white', background: 'black' }}`
leaves the label inheriting white instead of dropping the application's dark
muted token onto a black panel. `background` keeps its `transparent` default.
To make an otherwise-unthemed Statistic follow an ancestor's `color`, ask for
it explicitly with `theme={{ foreground: 'currentColor', muted: 'currentColor' }}`.
No API change.
