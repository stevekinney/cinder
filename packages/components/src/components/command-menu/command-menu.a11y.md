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

## Empty state

When no items match, the `empty` snippet renders in a `role="status"` element
that is a sibling of the `<ul role="listbox">`, not a child of it — `listbox`
only permits `option`/`group` descendants, so the message can't live inside
the list without breaking that contract. Instead, the listbox gets
`aria-describedby` pointing at the empty-state element, so a screen reader
user who lands on the (otherwise childless) listbox still hears why it's
empty. The listbox also keeps a 1px `min-block-size` while empty so it never
collapses to a zero-size box.
