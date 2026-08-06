---
'@lostgradient/cinder': minor
---

Re-anchor the light-mode surface ramp at white, wash interaction states toward the
accent, and lighten the focus ring.

Light mode now anchors at white and stays compressed: `--cinder-surface-inset`
0.960 → `--cinder-bg` 0.984 → `--cinder-surface` 0.994 → `--cinder-surface-raised`
1.000. Region separation is carried by border and shadow rather than by fill, which
is how light interfaces conventionally work — the page canvas reads as white, and a
card lifts off it with a hairline and a shadow instead of by everything around it
getting darker. Neutral surface chroma drops roughly 3x (0.010–0.018 → 0.002–0.005)
so large light surfaces read as white rather than as pale slate; saturation is
reserved for the accent and the status colors.

Interaction states change direction in the light arm only. `--cinder-surface-hover`
and `--cinder-surface-pressed` (and their `-raised-` twins) now mix toward
`--cinder-accent` at 6% / 12% instead of toward black. Near white a proportional
black mix is structurally unusable: the resting tiers span 0.040 lightness points
while a 6% black mix moves a surface 0.060, so every state lands on a resting tier
regardless of the percentage chosen. Mixing toward the accent separates states by
chroma and hue as well as lightness, so they stay legible at a step small enough to
fit the ramp. The dark arm is unchanged — it builds up from near-black across 17
lightness points, where a proportional lightness mix has room and already works.

The focus ring goes from 3px at a 1px offset to 2px at a 2px offset — the same 4px
total footprint, but half of it is now separation, so the ring reads as a ring
around a control rather than an outline on it and stops merging with an adjacent
border. `--cinder-ring-offset-color` moves from `--cinder-bg` to
`--cinder-surface-raised`.

Also in this release:

- Soft status surfaces (Alert, Banner, Callout) move from L 0.965 / C 0.015 to
  L 0.945 / C 0.026. The old tint was capped by the sRGB gamut rather than chosen:
  at L 0.965 the maximum in-gamut chroma for the danger hue is 0.0172, so a chroma
  shared across all four statuses could not exceed that and every status was held
  to red's headroom near white. Dropping the lightness raises the binding ceiling
  to 0.0275.
- The four `--cinder-color-*-bg` triples sit at L 0.945 with re-fitted chroma,
  which fixes a pre-existing bug where `--cinder-color-warning-bg` and
  `--cinder-color-danger-bg` were authored outside the sRGB gamut and had been
  silently clamping to a desaturated grey.
- `--cinder-border` 0.79 → 0.83 and `--cinder-border-muted` 0.88 → 0.90, with chroma
  dropping alongside the surfaces so a hairline reads as a neutral line rather than
  a faint blue one. `--cinder-border` deliberately stays dark enough to hold the
  secondary Button's outline against its white fill; on a white-anchored ramp that
  border is the only thing making the control read as a control.
- CodeBlock takes the surface radius and its header no longer paints a fill of its
  own. The header previously filled `--cinder-surface-inset` while the body filled
  `--cinder-surface-raised`, stacking two plates inside one rounded, clipped
  container. The code surface itself is unchanged: it stays pure white in light
  mode, because Shiki's `github-light` palette is fitted to `#ffffff` and its
  keyword red measures only 4.58:1 there against a 4.5:1 AA floor, so any tint
  behind highlighted code fails WCAG.
- `--cinder-surface-raised` is authored `oklch(100% 0 255)` rather than
  `oklch(100% 0.006 245)`, which was out of gamut and painted as nothing.
- `SegmentedControl`'s option radius derives from its container's own token
  (`calc(var(--cinder-radius-md) - 1px)`), so the inner and outer corners are
  concentric.

The radius scale is unchanged from the previous release at 6 / 8 / 12px.

Consumers that override `--cinder-bg`, `--cinder-surface`, `--cinder-surface-raised`
or `--cinder-surface-inset` should re-check their own ramp: the light arm's spacing
and direction have both changed, and a consumer ramp built to sit against a grey
canvas will need retuning against a white one.
