---
'@lostgradient/cinder': minor
---

feat(props)!: value-carrying callbacks stop squatting on native handler names

BREAKING: 28 lowercase `onchange`/`oninput`/`onsearch`/`onsubmit` props whose
first parameter was a VALUE (not an Event) are renamed to camelCase
`on<Noun>Change`-family names, matching the Checkbox/Input/Toggle/Tabs
exemplars. Lowercase `on*` names remain reserved for native DOM passthrough.

| Component                                                                                                                                                                                               | Old → New                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| autocomplete                                                                                                                                                                                            | `oninput` → `onValueChange`                               |
| calendar, color-field, color-swatch-picker, combobox, date-picker, date-range-field, number-input, pin-input, rating, schedule-builder, segmented-control, slider, tag-input, time-field, transfer-list | `onchange` → `onValueChange`                              |
| color-picker                                                                                                                                                                                            | `oninput` → `onValueChange`, `onchange` → `onValueCommit` |
| file-upload                                                                                                                                                                                             | `onchange` → `onFilesChange`                              |
| invocation-rule-builder                                                                                                                                                                                 | `onchange` → `onValueChange` (both arms)                  |
| json-schema-editor                                                                                                                                                                                      | `onchange` → `onSchemaChange`                             |
| kanban-board                                                                                                                                                                                            | `onchange` → `onColumnsChange`                            |
| phone-input                                                                                                                                                                                             | `onchange` → `onValueChange`                              |
| schema-form                                                                                                                                                                                             | `onsubmit` → `onSubmit`                                   |
| search-field                                                                                                                                                                                            | `oninput` → `onValueChange`, `onsearch` → `onSearch`      |
| FacetedFilterBar `CustomFacet.control` snippet                                                                                                                                                          | param `onchange` → `onValueChange`                        |

Native passthrough handlers (e.g. TagInput's `HTMLInputAttributes` forwards,
Backdrop/NavigationItem `onclick`) are unchanged, and the native names stay
omitted from rest-attribute surfaces where they were omitted before.

**This can't recur**: `check:prop-conventions` is now type-aware. It builds
one TypeScript program over every `*.types.ts`, resolves each exported Props
surface (through aliases, intersections, unions, and non-exported helper
types — closing the blind spot that let 20+ components drift), and fails any
lowercase `on*` prop whose call signatures don't take an Event-like first
parameter (structural probe: `preventDefault`/`stopPropagation`/`bubbles`).

Cross-package: `@lostgradient/editor`'s review-editor updated for the
SegmentedControl rename.
