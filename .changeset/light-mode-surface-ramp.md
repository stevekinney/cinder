---
'@lostgradient/cinder': minor
---

Widen the light-mode surface ramp, lighten the focus ring, and step the radius scale down.

Light mode's four elevation tiers used to sit inside a 6-lightness-point band
(`--cinder-surface-inset` 0.94 → `--cinder-surface-raised` 1.00) against the dark
arm's 17. Fills could not separate regions, so components leaned on a permanent
`1px solid` border for every boundary. The light arm now spans 11.5 points —
inset 0.885 → bg 0.921 → surface 0.962 → raised 1.000 — which is where light mode's
end-to-end WCAG contrast (1.410:1) matches dark mode's (1.406:1). Surface chroma
becomes a monotonic cool ramp (0 → 0.010 → 0.014 → 0.018) instead of the previous
non-monotonic 0.006–0.010.

The focus ring goes from 3px at a 1px offset to 2px at a 2px offset — the same 4px
total footprint, but half of it is now separation, so the ring reads as a ring
around a control rather than an outline on it and stops merging with an adjacent
border. `--cinder-ring-offset-color` moves from `--cinder-bg` to
`--cinder-surface-raised` so the offset band disappears into the surfaces controls
actually sit on instead of painting a dark moat around them.

The radius scale steps down one notch: `--cinder-radius-sm` 6px → 4px,
`--cinder-radius-md` 8px → 6px, `--cinder-radius-lg` 12px → 8px.

Also fixed, all consequences of the above:

- `--cinder-surface-hover` used to resolve to L 0.9506 against a `--cinder-bg` of
  0.95, so hovering a card body painted it exactly the page background; in the dark
  arm `--cinder-surface-pressed` resolved within ΔL 0.007 of `--cinder-surface-raised`.
  The interaction mixes are now 2.5% / 6% (from 3% / 8%) and every state clears every
  resting tier by at least ΔL 0.013 in light and 0.018 in dark. Dark-mode hover and
  pressed steps are correspondingly smaller.
- `--cinder-border-muted` 0.88 → 0.855 and `--cinder-fill-disabled` 0.88 → 0.86
  (light arm); both were within ΔL 0.005 of the new darkest surface.
- The four `--cinder-color-*-bg` soft status surfaces drop to L 0.945 so a tinted
  Alert still separates from a card body. Re-fitting their chroma fixed a
  pre-existing bug: `--cinder-color-warning-bg` and `--cinder-color-danger-bg` were
  both authored outside the sRGB gamut and had been silently clamping.
- `--cinder-surface-raised` is authored `oklch(100% 0 245)` rather than
  `oklch(100% 0.006 245)`, which was out of gamut and painted as nothing.
- `SegmentedControl`'s option radius derives from its container's own token
  (`calc(var(--cinder-radius-md) - 1px)`) instead of an unrelated step on the scale,
  so the inner and outer corners are concentric.

Consumers that override `--cinder-bg`, `--cinder-surface`, `--cinder-surface-raised`,
or `--cinder-surface-inset` should re-check their own ramp against the new spacing.
