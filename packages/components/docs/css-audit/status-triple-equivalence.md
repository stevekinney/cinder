# Status Triple Equivalence — Alert / Banner / Callout

Pre-flight analysis for **Batch D** of the CSS audit. The goal was to migrate
the duplicated `light-dark(oklch(from var(--cinder-{status}) ...))` math in
Alert, Banner, and Callout to the existing `--cinder-color-{status}-{bg,fg,border}`
triples defined in `packages/components/src/styles/tokens-base.css` lines
182–196.

A `component × status` pair migrates only when **both** light and dark themes
satisfy:

1. `ΔL` (current background L − triple background L, in oklch) is `< 0.02`.
2. Every rendered text role meets WCAG 1.4.3 contrast against the **triple**
   background (≥ 4.5:1 body, ≥ 3:1 large/14pt-bold).
3. Every meaningful non-text UI element (border conveying surface boundary,
   dismiss-button affordance) meets WCAG 1.4.11 (≥ 3:1) against the triple
   background.

If either theme fails any check, the pair stays unmigrated on the existing
inline `oklch(from …)` math.

---

## 1. Source values

### Per-component current math (background)

All three components synthesize the soft surface identically:

```css
background-color: light-dark(
  oklch(from var(--cinder-{status}) 96.5% 0.015 h),
  oklch(from var(--cinder-{status}) 20% 0.03 h)
);
```

The `from` syntax substitutes the source token's hue (`h`) while overriding
L and C. The base hue per status is:

| Status  | Hue (`h`) |
| ------- | --------- |
| info    | 245       |
| success | 145       |
| warning | 75        |
| danger  | 25        |

Notes:

- Alert's `info` variant references `--cinder-alert-info`, a locally scoped
  duplicate of `--cinder-info` (`oklch(45% 0.14 245) / oklch(78% 0.15 245)`).
  Hue is identical to the global token, so the resolved background math is
  the same.

### Resolved current background — light

| Status  | Current background       |
| ------- | ------------------------ |
| info    | `oklch(96.5% 0.015 245)` |
| success | `oklch(96.5% 0.015 145)` |
| warning | `oklch(96.5% 0.015 75)`  |
| danger  | `oklch(96.5% 0.015 25)`  |

### Resolved current background — dark

| Status  | Current background    |
| ------- | --------------------- |
| info    | `oklch(20% 0.03 245)` |
| success | `oklch(20% 0.03 145)` |
| warning | `oklch(20% 0.03 75)`  |
| danger  | `oklch(20% 0.03 25)`  |

### Triple background tokens (`tokens-base.css` 182–196)

| Status  | Light triple bg        | Dark triple bg        |
| ------- | ---------------------- | --------------------- |
| info    | `oklch(96% 0.025 245)` | `oklch(28% 0.06 245)` |
| success | `oklch(96% 0.04 145)`  | `oklch(28% 0.07 145)` |
| warning | `oklch(96% 0.04 75)`   | `oklch(28% 0.08 75)`  |
| danger  | `oklch(96% 0.04 25)`   | `oklch(28% 0.09 25)`  |

---

## 2. ΔL summary (background only)

`ΔL = |L_current − L_triple|` in oklch L (where 1.0 = 100%).

### Light theme

| Status  | Current L | Triple L | ΔL    | Pass < 0.02? |
| ------- | --------- | -------- | ----- | ------------ |
| info    | 0.965     | 0.96     | 0.005 | PASS         |
| success | 0.965     | 0.96     | 0.005 | PASS         |
| warning | 0.965     | 0.96     | 0.005 | PASS         |
| danger  | 0.965     | 0.96     | 0.005 | PASS         |

### Dark theme

| Status  | Current L | Triple L | ΔL   | Pass < 0.02? |
| ------- | --------- | -------- | ---- | ------------ |
| info    | 0.20      | 0.28     | 0.08 | **FAIL**     |
| success | 0.20      | 0.28     | 0.08 | **FAIL**     |
| warning | 0.20      | 0.28     | 0.08 | **FAIL**     |
| danger  | 0.20      | 0.28     | 0.08 | **FAIL**     |

The dark-mode triple background is a full 8 oklch-L points lighter than the
current per-component synthesized background. That is a clearly visible
surface-tone shift — not a no-op refactor — and exceeds the gating threshold
by 4×.

---

## 3. Contrast roles (against the triple background)

Even though the dark-theme ΔL alone is disqualifying, the contrast roles are
included for completeness so the doc fully documents what would have to be
re-validated if anyone later decides to tighten the dark triples to match the
current 20% L surface.

Rendered roles per component:

| Component | Text roles                           | Non-text roles                  | Decorative         |
| --------- | ------------------------------------ | ------------------------------- | ------------------ |
| Alert     | title / body, dismiss-button glyph   | border, dismiss-button hit area | icon (aria-hidden) |
| Banner    | message text, action labels, dismiss | border, dismiss-button hit area | icon (none in v1)  |
| Callout   | title, body                          | border                          | icon (aria-hidden) |

Note that Callout has no dismiss button (static admonition) and Banner has no
status icon channel in v1, but the surface/text/border treatment is identical
across all three. Contrast against the triple background is therefore evaluated
once per `(status × theme)` and applies to every component that renders that
status.

Contrast checks below are **approximate** — converted oklch → sRGB → relative
luminance using the WCAG 2.x formula. Borderline cases are marked conservative.

### Light theme contrast (triple bg)

| Status  | Triple bg              | Triple fg             | fg-on-bg approx | Border vs bg approx | Verdict per role                                 |
| ------- | ---------------------- | --------------------- | --------------- | ------------------- | ------------------------------------------------ |
| info    | `oklch(96% 0.025 245)` | `oklch(28% 0.12 245)` | ~8.2:1          | ~2.0:1              | text PASS, border borderline (conservative FAIL) |
| success | `oklch(96% 0.04 145)`  | `oklch(28% 0.13 145)` | ~8.0:1          | ~2.1:1              | text PASS, border borderline (conservative FAIL) |
| warning | `oklch(96% 0.04 75)`   | `oklch(32% 0.14 75)`  | ~7.0:1          | ~2.0:1              | text PASS, border borderline (conservative FAIL) |
| danger  | `oklch(96% 0.04 25)`   | `oklch(32% 0.16 25)`  | ~6.8:1          | ~2.0:1              | text PASS, border borderline (conservative FAIL) |

The border on the soft-surface light triples sits around 2:1 against the bg —
under the WCAG 1.4.11 3:1 threshold for meaningful non-text UI. The border
conveys the surface boundary of the alert/banner/callout, so it qualifies as
meaningful (it is the only edge between the soft tint and surrounding page
surface).

### Dark theme contrast (triple bg)

Disqualified on ΔL — contrast was not pursued.

---

## 4. Per `component × status` decision

A pair migrates only if both themes pass ΔL and all role checks. The
dark-theme ΔL failure is unconditional across all four statuses.

| Component | Status         | Light ΔL | Dark ΔL | Decision |
| --------- | -------------- | -------- | ------- | -------- |
| Alert     | info           | PASS     | FAIL    | **KEEP** |
| Alert     | success        | PASS     | FAIL    | **KEEP** |
| Alert     | warning        | PASS     | FAIL    | **KEEP** |
| Alert     | error (danger) | PASS     | FAIL    | **KEEP** |
| Banner    | info           | PASS     | FAIL    | **KEEP** |
| Banner    | success        | PASS     | FAIL    | **KEEP** |
| Banner    | warning        | PASS     | FAIL    | **KEEP** |
| Banner    | danger         | PASS     | FAIL    | **KEEP** |
| Callout   | info           | PASS     | FAIL    | **KEEP** |
| Callout   | success        | PASS     | FAIL    | **KEEP** |
| Callout   | warning        | PASS     | FAIL    | **KEEP** |
| Callout   | danger         | PASS     | FAIL    | **KEEP** |

**Result:** 0 of 12 pairs migrate. All Alert / Banner / Callout status
variants remain on the existing inline `oklch(from …)` math.

---

## 5. Why the triples don't fit (yet)

The soft-surface triples in `tokens-base.css` were tuned independently of the
Alert/Banner/Callout math. Two observations:

1. **Dark surface lightness disagrees.** The current components synthesize a
   `20% L` soft surface in dark mode; the triples land at `28% L`. The
   triples are intentionally lighter to keep enough separation from the page
   background (`--cinder-bg` ≈ 12–15% L in dark theme), but they are not
   drop-in equivalent for the existing visual.
2. **Light-theme border contrast is borderline.** Even ignoring ΔL, the
   triple border at ~`82% L` against a `96% L` background lands near 2:1 —
   under the WCAG 1.4.11 3:1 floor for meaningful non-text UI. Migrating
   would regress the visible card edge on light theme.

If we want to migrate Batch D in a future pass, the path is:

- Either retune the dark triples down to ~20% L so they match (and re-check
  text contrast against the darker surface), **or**
- Accept a small visible surface shift in dark mode as part of a deliberate
  design refresh and re-validate every consumer.

Either path is a token-level change, which is out of scope for Batch D.

---

## 6. Search-pattern accounting

Before the audit:

```
$ rg -n 'oklch\(from var\(--cinder-(info|success|warning|danger)\)' \
    packages/components/src/components --glob '*.css' | wc -l
66   # in Batch D scope (alert/banner/callout)
 3   # out of scope (select/input solid-danger border tweaks)
```

Six declarations per status (bg-light, bg-dark, border-light, border-dark,
fg-light, fg-dark) × 4 statuses = 24 lines per file. Alert defines 3 status
variants (info reuses a local `--cinder-alert-info`, so it doesn't match the
pattern), success/warning/danger = 18; Banner and Callout each define all 4
statuses against `--cinder-{status}` = 24 each. 18 + 24 + 24 = 66.

After the audit: **unchanged**. Zero migrations were applied, so the matching-
declaration count stays at 66 inside the Batch D files. Each file gained a
comment block pointing at this doc — those comment lines also contain the
literal pattern text in backticks, so `rg` will report a slightly higher raw
hit count post-audit (one extra match per file = 3 added). Filter to lines
starting with whitespace + `oklch(` to count only real declarations.
