---
'@lostgradient/cinder': minor
---

feat(drawer)!: merge Sheet into Drawer behind a `placement` prop

BREAKING: `Sheet` is gone. `Drawer` now covers all three edges via
`placement: 'left' | 'right' | 'bottom'` (default `'right'`), and the
`side` prop is renamed to `placement`. No compatibility alias is shipped —
cinder is pre-release.

Migration, former Drawer consumers:

- `side="left" | "right"` → `placement="left" | "right"` (default is still `right`)
- `DrawerSide` type → `DrawerPlacement`
- `data-cinder-side` attribute (CSS/test hooks) → `data-cinder-placement`
- Initial focus on open now lands on the body container (unless a child has
  `[autofocus]`) instead of the first tabbable — the Modal/Sheet policy the
  Drawer a11y notes already documented.
- Header/footer padding tightened to align with Modal
  (`space-4/space-5` header, `space-3/space-5` footer).

Migration, former Sheet consumers:

- `import { Sheet } from '@lostgradient/cinder/sheet'` →
  `import { Drawer } from '@lostgradient/cinder/drawer'`
- `<Sheet …>` → `<Drawer placement="bottom" …>`; `SheetProps` → `DrawerProps`
- `.cinder-sheet*` classes → the `.cinder-drawer*` equivalents;
  `aria-label="Close sheet"` → `"Close drawer"`
- `@lostgradient/cinder/sheet/{schema,variables,styles,examples}` →
  `/drawer/{…}`
- `--cinder-z-sheet` token and `Z_LAYERS.sheet` are removed (both components
  already rendered at `--cinder-z-modal`).
- Geometry is identical under `placement="bottom"` (100% width, 90dvh cap,
  rounded top corners, optional `dragHandleVisible` drag handle); `size` is
  ignored for `bottom`.

Every placement now has an explicit `@starting-style` + closing rule pair, and
a unit test pins one per placement (derived from the generated schema enum) so
a future edge can't ship a pop-in.

Also fixed in the shared sliding-dialog layer, affecting Modal too:

- Reopening a dialog while its close transition is still running now re-fires
  the initial-focus policy — previously focus stayed stranded on
  `document.body` behind the open dialog.
- Modal's "focus the body unless a child is autofocused" open behavior
  actually works now: it ran synchronously before the panel subtree flushed,
  so the body element never existed when it looked. Both components share one
  deferred `focusDialogBodyUnlessAutofocused` helper.
