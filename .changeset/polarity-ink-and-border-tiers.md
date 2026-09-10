---
'@lostgradient/cinder': minor
---

feat(tokens): one polarity ink, and neutral border tiers composed from it

Two related token changes.

**`--cinder-polarity-ink`** is new: the neutral ink that contrasts with whatever
the current theme paints underneath it — black in light mode, white in dark. The
three scrollbar washes are now `color-mix()` values over it rather than
open-coded `light-dark()` pairs, so they re-polarize together when it is
overridden. Rendering is unchanged: `color-mix(in oklch, C, transparent 96%)`
computes byte-for-byte to `oklch(C / 0.04)`.

It is deliberately a complete color value rather than a bare `0% 0 0` component
triplet. A triplet assigned to a color property is an invalid declaration, and
CSS drops invalid declarations silently — the mistake renders as "nothing
changed" rather than as something you can see. Two new gates hold that line: the
generator rejects a bare component list in any color position, and a browser test
hands every public color token to the real CSS parser and asserts the declaration
sticks.

**`--cinder-border-ink`** is new, and `--cinder-border-muted`, `--cinder-border`,
and `--cinder-border-strong` are now alpha steps over it (19%, 48%, 58%) instead
of opaque per-arm colors. This is a **visual change**: an alpha border tracks the
surface underneath it, so each tier now reads at the same weight everywhere it is
used. The dark surface ramp spans L 0.11–0.28, and a single opaque border used to
measure 4.80:1 on `surface-inset` against 3.42:1 on `surface-raised` — a 29%
spread. Every tier now holds under 15% in both arms, gated in
`check-token-contrast.test.ts` alongside the existing per-surface floors.

Retinting all three tiers is now one override:

```css
:root {
  --cinder-border-ink: light-dark(oklch(20% 0.03 280), oklch(86% 0.06 280));
}
```

Two things to know if you consume these directly. A structural border mixed into
another color inherits its transparency, so `color-mix(in oklch, var(--cinder-surface),
var(--cinder-border-muted) 10%)` now yields a slightly translucent result. And two
of these borders on the same pixel stack their alpha — draw interior dividers as a
single edge on one of the two adjacent elements, which the `interior-border-weight`
stylelint rule already requires.

`--cinder-border-faint` and the four hued status borders (`info`, `success`,
`warning`, `danger`) stay opaque. `--cinder-status-neutral-border` does not — it
is a straight alias of `--cinder-border` and becomes translucent with it, which
is the intent: that tier is neutral structure, not a hue.

Also fixes a pre-existing defect in the contrast gate itself: it composited
translucent colors in linear-light sRGB, but browsers composite on
gamma-encoded channels. Measured against Chromium, the old model reported roughly
1.5× more contrast than ships for a light ink over a dark surface — exactly the
dark-arm case these border tiers now use.
