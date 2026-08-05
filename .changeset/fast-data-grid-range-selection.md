---
'@lostgradient/cinder': patch
---

Make DataGrid range selection O(1) per cell instead of enumerating the range on every pointermove, gate aria-multiselectable on selectionMode, and remove DataGridSelectionModel.selectedCells.
