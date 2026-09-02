---
'@lostgradient/cinder': patch
---

Fix StatisticGroup's column collapse and row-end dividers. The group's `@container` rules queried the element that declared the container, so a standalone group never collapsed at the documented 30rem and 18rem thresholds; a `.cinder-statistic-group__container` wrapper now owns `container-type`, and the grid collapses against its own inline size whether standalone or nested. The default variant's row-end divider suppression was also inert — the generic enabler out-ranked every `nth-child` suppressor by specificity — so every group that wrapped to a second row drew a divider at the end of each row. Divider rules are now enumerated per column count at uniform specificity and follow the collapse thresholds, so they describe the grid that actually renders.
