# Color value format for ColorField and ColorPicker

**Status:** Open (raised 2026-08-05). Do not treat the current tree as the
decided end state.

Question: do `ColorField` and `ColorPicker` keep hex-only output, or move to
format-tagged values?

What the tree currently pins (so this stub cannot be read as a blank slate):
`color-field.types.ts` accepts several _input_ color string formats but
documents "Output is always hex", and `color-picker.types.ts` reads `value`
as `#rrggbb` / `#rrggbbaa`. The bindable `value` contract and form-mirror
round-tripping both assume hex today.

The open half: whether output widens (oklch, rgb objects, an alpha policy)
— which would change the bindable `value` contract — and how the accepted
feature wants (a color-palette popover on the ColorField swatch, wider
format support, copy-in-multiple-formats in ColorPicker) interact with that
contract.

Closing this requires: a decided output type (string format union vs tagged
object), a migration story for the bindable `value`, and updates to both
components' schema surfaces in one coordinated change.
