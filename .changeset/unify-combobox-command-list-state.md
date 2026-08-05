---
'@lostgradient/cinder': patch
---

Compose Combobox's roving active-option state on the shared `createCommandListState` utility instead of a hand-rolled index, matching the MultiSelect/CommandMenu/CommandPalette precedent. Adds an `autoActivateFirst` option to the utility so an editable combobox can leave no option highlighted until the user types or navigates, and Combobox now scrolls the active option into view during keyboard navigation. Public API and observable behavior are unchanged.
