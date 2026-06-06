---
'@lostgradient/cinder': minor
---

Visual-token refinement that improves light/dark separation and accent legibility, plus six new semantic alias tokens.

- **Accent reads more like ink.** `--cinder-accent` is now `light-dark(oklch(66% 0.16 195), oklch(78% 0.13 195))` — the light arm darkens from the previous bright cyan toward a more ink-like read (its foreground contrast improves from ~2:1 to ~2.7:1, though it still uses the dedicated `--cinder-accent-text` token for foreground use), and the dark-arm chroma calms from 0.15 to 0.13 to stop the cyan vibrating. As a fill it carries the dark-ink `--cinder-accent-contrast` label at ~7.2:1. Because `--cinder-accent-hover` and `--cinder-accent-active` derive from `--cinder-accent` with `oklch(from …)`, both hover and active states re-derive automatically. `--cinder-accent-text` keeps its dark-arm chroma in lockstep at 0.13.
- **New `--cinder-accent-active-on-fill` token keeps pressed primary buttons AA-legible.** Darkening the base accent dropped the general `--cinder-accent-active` (a `−0.15` lightness step → `L=0.51`) to ~4.09:1 for the dark-ink label on a pressed primary `Button`/`FloatingActionButton`, below WCAG AA. The new token uses a gentler `−0.11` step (light `L=0.55` ~4.79:1, dark ~7.1:1); those two components now consume it for their pressed fill. `--cinder-accent-active` is unchanged for every other consumer.
- **Wider dark surface ladder.** The dark elevation steps now run 15 → 20 → 26 → 11 (`--cinder-surface-raised` 24% → 26%, `--cinder-surface-inset` 12% → 11%); `--cinder-bg` and `--cinder-surface` are unchanged.
- **Stronger borders in both arms.** `--cinder-border` becomes `light-dark(oklch(79% 0.013 245), oklch(40% 0.05 245))` for a more defined edge against surfaces.
- **Deeper small elevation.** `--cinder-shadow-sm` gains a second hairline layer and higher alphas in both arms; `--cinder-shadow-md` and `--cinder-shadow-lg` raise their dark-arm alphas (light arms unchanged).
- **Calmer disabled text.** `--cinder-text-disabled` dark arm drops from 62% to 58%.
- **Six new semantic alias tokens** (additive, public) that express intent over the raw scale: `--cinder-pad-control`, `--cinder-pad-card`, `--cinder-gap-stack`, `--cinder-gap-inline`, `--cinder-radius-control`, and `--cinder-radius-surface`.
