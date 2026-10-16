---
'@lostgradient/markdown': patch
---

Republish `@lostgradient/markdown` with no change to its API or behavior. Version 0.6.1 was synced from corvidae `5eb355d4`, before stevekinney/corvidae#276 made `insideFiles.peerDependencies` a required part of the mirror's `target-owned.json`. The publication recorder can no longer load that commit's policy, so it cannot record a `publishedSnapshot` for 0.6.1. This patch is published from a sync made after #276, so its snapshot can be recorded. Weft syncs need that snapshot once `@lostgradient/weft` declares a development dependency on Markdown. Since 0.6.1, corvidae has changed only Markdown's `ssr-import` test and its development `test` script. Neither is part of the published package.
