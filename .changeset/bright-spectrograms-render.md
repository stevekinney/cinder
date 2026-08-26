---
'@lostgradient/cinder': patch
---

Reduce the maximum visual density of large `Spectrogram` plots while preserving maximum aggregation within each sampled bucket. This prevents large SVG heatmaps from creating excessive DOM work during rendering.
