---
'@lostgradient/cinder': patch
---

Route SpeedDial actions, Combobox empty results, and collapsed NavigationBar
menus through the shared portal and Floating UI positioning path so clipping
and local stacking contexts cannot obscure them. Make the public z-index scale
the single source of truth, including a top-level drag-preview token, and add a
Stylelint guard against token fallbacks and unexplained layer values.
