# CommandMenu Accessibility

`CommandMenu` renders only the floating listbox. The host keeps ownership of the
textarea or input and must wire the field ARIA from `onstatechange`.

For a textarea host, keep the native textbox role and apply:

- `aria-controls={listboxId}` while open
- `aria-activedescendant={activeItemId}` when an option is active
- `aria-autocomplete="list"`

Do not add `aria-expanded` to a native textarea; axe flags it as unsupported for
that role. For a single-line text input, the host may additionally use
`role="combobox"` and `aria-expanded={open}`.
Selection belongs to `CommandMenu.onselect`; do not put replacement logic on
`CommandItem.onselect` inside `CommandMenu`.
