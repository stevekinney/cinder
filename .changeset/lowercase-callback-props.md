---
'@lostgradient/cinder': major
---

**Breaking: PascalCase event-callback props renamed to lowercase.** Svelte 5 event
props use the same lowercase syntax as DOM handler props (`onclick`, `ondismiss`),
and cinder's convention is all-lowercase. The following public callback props are
renamed to their lowercase forms across the affected components (alert, banner,
capability-gate, collapsible, click-away-listener, data-grid, load-more,
markdown-editor, media-controls, table, table-header, table-row, transfer-list,
tree, tree-item):

`onDismiss`→`ondismiss`, `onToggle`→`ontoggle`, `onReorder`→`onreorder`,
`onPlay`→`onplay`, `onLoadMore`→`onloadmore`, `onSelectedChange`→`onselectedchange`,
`onSelectionChange`→`onselectionchange`, `onFilterChange`→`onfilterchange`,
`onPause`→`onpause`, `onReplay`→`onreplay`, `onLoadError`→`onloaderror`,
`onRename`→`onrename`, `onChange`→`onchange`, `onClickAway`→`onclickaway`,
`onSortChange`→`onsortchange`, `onSortModelChange`→`onsortmodelchange`,
`onSelectionModelChange`→`onselectionmodelchange`, `onReady`→`onready`.

Each renamed callback keeps the same payload arguments and invocation timing. No
compatibility aliases are provided — update call sites to the lowercase names.

The stable-promotion `PROP_NAME_DENYLIST` is now compared case-insensitively for
`on*` props, so a PascalCase event-callback prop can no longer slip past the gate.
