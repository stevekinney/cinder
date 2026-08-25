---
'@lostgradient/cinder-mcp': patch
---

Pick up the `components.json` catalog change from the `BentoGrid`/`BentoCell` → `Grid`/`Grid.Item` fold: `loadCinderKnowledge()` no longer surfaces `bento-grid`/`bento-cell`, and `grid-item` now documents `rowEnd`. No tool API change.
