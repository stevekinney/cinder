---
'@lostgradient/cinder': patch
---

fix(styles): form dropdown option rows adopt the shared `_row-item` primitive

`combobox`, `autocomplete`, `multi-select`, and `transfer-list` option rows
now take their geometry, padding, active fill, keyboard-cursor ring,
disabled state, and forced-colors treatment from the shared
`cinder-_option-row` primitive instead of three drifted local copies. The
shared padding is tuned once at the primitive (`space-1-5` block /
`space-2` inline — the tightest of the previous three pairs), so combobox,
autocomplete, and transfer-list rows tighten slightly; multi-select is
unchanged. Menu/navigation composers (dropdown-item, command-item,
navigation-item) keep their own roomier padding overrides.

Behavior deltas: autocomplete's disabled rows converge on
`--cinder-text-disabled` + `cursor: not-allowed`; transfer-list's keyboard
cursor drops from a 2px to the system-wide 1px inset ring, gains the shared
active fill and a forced-colors outline it lacked, and keeps its deliberate
`--cinder-surface-inset` selected fill (selection must stay distinct from
the cursor); its disabled rows no longer dim with `opacity`.
