---
'cinder': patch
---

Buttons & Actions visual polish.

- New `--cinder-text-md` design token (15px) and a clearer button font-size ladder: `lg` now uses `--cinder-text-md` (15px) and `xl` uses `--cinder-text-lg` (16px), so large buttons read as visibly larger than the default. `xs`/`sm`/`md` are unchanged.
- Ghost buttons keep their muted text color on hover and only change background, so hover no longer brightens the label.
- Button groups draw a single deterministic 1px seam between members via a pseudo-element instead of overlapping borders with negative margins, so mixed-variant groups no longer hairline-notch at transparent-bordered boundaries.
- Dropdown danger items now show a danger-colored focus ring (`--cinder-danger`) instead of the neutral ring.
- Segmented-control selected and pressed segments now respond to hover (the accent fill darkens) so they no longer read as disabled.
