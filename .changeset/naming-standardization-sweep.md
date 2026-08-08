---
'@lostgradient/cinder': minor
---

feat(props)!: naming-standardization sweep — polarity, aria spellings, and collision renames

BREAKING prop renames beyond the value-callback sweep (documented in its own
changeset). Same values, same behavior — only the names and, for the
visibility props, the polarity change:

- **Positive-polarity visibility props** — `hide*` booleans become `*Visible`
  with a `true` default, so hiding is now an explicit `{false}`:
  - `hideLabel` → `labelVisible` on FormField, Input, PhoneInput, PinInput,
    Rating, SegmentedControl, Select, StatusDot, and Toggle
    (`hideLabel` → `labelVisible={false}`).
  - DateRangeField `hidePresets` → `presetsVisible`.
  - DiffStatistics `hideZero` → `zeroVisible`.
- **`aria-labelledby` spelling standardized** to `ariaLabelledby` (lowercase
  `b`, matching the attribute) everywhere the prop appears: ButtonGroup,
  ChoiceGrid, DropdownGroup, Drawer, MenuBar, Meter, Popover, Progress,
  TabList, and TabPanel previously used a mix of `labelledBy` and
  `ariaLabelledBy`.
- **SegmentedControl** `disallowEmptySelection` → `selectionRequired`.
- **Tree** `disableTypeahead` → `typeaheadDisabled` (adjective-last state
  name, matching `labelVisible`-style naming).
- **Tree item** `draggable` → `reorderHandleVisible` — the old name collided
  with the native HTML `draggable` attribute.
- **PricingCard** `cta` → `callToActionLabel` (no abbreviations in
  identifiers) and `onSelect` → `onPlanSelect` (names the noun).

`check:prop-conventions` bans every removed name with a pointed message, so a
stale prop fails the gate instead of silently type-erroring.
