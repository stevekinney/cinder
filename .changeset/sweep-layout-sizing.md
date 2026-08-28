---
'@lostgradient/cinder': patch
---

Fix layout and sizing defects across NavigationBar, TimeField, MegaMenu, Table, and StackedListItem.

NavigationBar's mobile panel rows now derive their corner radius concentrically from the panel
that contains them, instead of picking a smaller step off the radius scale. Bottom tabs gain an
inline-axis touch-target floor, which they previously lacked entirely — `flex: 1 1 0` plus a
zero min-content label let them shrink arbitrarily thin in a narrow bar.

TimeField's timezone select now matches its sibling time input's vertical rhythm and inherits
form-control typography. A native `select` does not inherit font settings, so it had been
rendering in browser-default type beside an input at `--cinder-text-sm`.

MegaMenu's links and submenu triggers share one `padding-block`, so a single panel no longer
mixes two row heights.

Table's sort chevrons move from four to six viewBox units apart. Round caps at `stroke-width: 2`
consume a unit off each side of the gap, so the previous spread left the two marks visually
touching at the rendered size.

StackedListItem's `condensed` density now actually condenses. It had been re-declaring the
leading value it already inherited, making the variant a no-op.
