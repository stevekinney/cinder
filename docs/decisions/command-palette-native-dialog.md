# CommandPalette native dialog contract

Decision: retain CommandPalette's native modal `<dialog>` rather than composing
the panel from `cinder-_floating-surface`.

## Why

CommandPalette is a modal command surface, not a non-modal anchored popover. The
native `showModal()` path supplies top-layer placement, a modal backdrop, and
browser focus containment. Its existing lifecycle also routes Escape, backdrop
dismissal, focus restoration, and the combobox/listbox virtual-focus contract
through one component. Replacing it with the floating-surface primitive would
require rebuilding those guarantees and could weaken modal isolation or keyboard
accessibility.

The nearest alternative is `Combobox` for a non-modal single-value picker. Use
`Popover` or `cinder-_floating-surface` for contextual, non-modal surfaces.

## Contract and consequences

- CommandPalette renders a native `<dialog>` and calls `showModal()` while open.
- The dialog remains in the browser top layer with `aria-modal="true"`; its
  native focus trap is part of the public accessibility contract.
- Escape is owned by the shared escape stack and closes the palette once; the
  native `cancel` event is prevented so dismissal is single-sourced.
- Clicking the dialog backdrop closes it; clicks inside the panel do not.
- Focus remains on the combobox input while `aria-activedescendant` moves across
  listbox options, and closing restores the captured or supplied trigger focus.

## Alternatives rejected

Using `Popover` or a bare floating surface would preserve positioning but not
the native modal top layer, backdrop, focus trap, or modal semantics without a
new bespoke modal implementation. Migrating is therefore out of scope unless a
separate contract decision explicitly replaces those guarantees and adds
browser and assistive-technology verification.
