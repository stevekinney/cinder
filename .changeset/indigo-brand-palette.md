---
'@lostgradient/cinder': minor
---

Retune the color palette around an indigo brand, polish the command-palette and timeline, and remove the previously-deprecated experimental-timeline aliases (a pre-1.0 export-map removal shipping in this minor — see the migration note below).

**Palette (visible default change for every consumer):**

- Brand accent is now indigo (hue 270) and carries white labels in light mode. `--cinder-accent` moves to `oklch(50% 0.22 270)` (light) / `oklch(72% 0.14 270)` (dark) and `--cinder-accent-contrast` flips to white in light mode — primary buttons, the active command-palette item, and every solid accent fill show white text on indigo (6.45:1, clears WCAG AA). `--cinder-accent-text` (links/icons) and the focus ring re-hue automatically; the ring's light-arm lightness clamp drops 0.58 → 0.55 so the indigo ring keeps ≥3:1 (WCAG 1.4.11) on near-white surfaces.
- Info status nudged hue 245 → 230 so the blue "info" state no longer competes with the indigo brand.
- The 8 categorical chart series are retuned: brand-safe (no hue in 248–292) and strongly distinguishable in normal vision (min CIEDE2000 ΔE00 ≥ 12). Each arm additionally keeps a minimum pairwise CIE L\* separation of ≥ 4 so lightness stays a usable secondary distinguishing channel when hue contrast degrades for color-vision-deficient viewers. The light and dark arms are tuned independently for in-theme contrast and gamut, so a series is not guaranteed the same hue across themes.
- Status fills (success/warning/danger) refitted to the sRGB gamut — several were authored over-chroma and silently clamped (warning especially). The danger button's hover and active states are now authored explicitly instead of derived by darkening the fill at constant chroma: red sits near the gamut boundary, so the old constant-chroma derivation clamped the pressed/hover states to a duller red than specified. Each light-arm state is now pinned to its in-gamut chroma maximum, so the darkening is both monotonic and exactly rendered (white labels stay ≥ 6.7:1).
- A new gate, `check-token-contrast.test.ts` (`bun run colors:contrast`), parses the actual token values and asserts WCAG contrast, sRGB-gamut integrity, and chart distinguishability so the palette can't silently regress.

**Command palette:** the search input no longer carries its own 3px focus ring (it read as a stray floating box around the edgeless input). Keyboard focus is now indicated by the search row's bottom border recoloring to the ring color on `:focus-within`; the border is reserved at 2px at rest so focusing causes no layout shift.

**Timeline:** the connector line now runs continuously from each marker's center to the next marker's center, instead of leaving stubby gaps that didn't reach the dots. The geometry is derived from the marker's center coordinates — the marker is a fixed-size box (`--_cinder-timeline-marker-size`) that custom `marker` snippets fill rather than resize — so the line meets the dot in the default and custom-marker examples alike. The previous fixed-offset calibration left the line short of the next dot.

**Migration — removed the previously-deprecated `@lostgradient/cinder/experimental/timeline` and `@lostgradient/cinder/experimental/timeline-item` export paths.** These aliases were deprecated once the stable paths shipped; removing them pre-1.0 ships as a minor (no major bump). Import from `@lostgradient/cinder/timeline` and `@lostgradient/cinder/timeline-item` instead.
