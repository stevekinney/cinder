/**
 * Parity-floor regression for the light-mode theme tune (ticket 89d25073, items 10-13).
 *
 * The light theme used to read as one pale wash: the surface-lightness ladder
 * was compressed into the top ~3.5% of the range, the default (secondary)
 * button rode on a white-on-white fill plus a faint hairline border, and the
 * primary accent was less vivid than its dark counterpart. The fix tuned ONLY
 * the light arm of a handful of global `:root` tokens.
 *
 * This test pins the NOMINAL authored OKLCH lightness/chroma ladder — the
 * values we directly control in tokens-base.css. It is calibrated to FAIL on
 * the pre-fix values and PASS on the post-fix values, so the ladder cannot
 * silently re-collapse. The companion Playwright spec
 * (`theme-parity-light-ladder.playwright.ts`) proves the PAINTED-BACK behavior
 * (after Chromium's gamut clipping) in a real browser; this unit test guards
 * the source-of-truth token authoring without needing a server.
 *
 * Test files may use `any` per project conventions.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'bun:test';

const tokensCss = readFileSync(
  fileURLToPath(new URL('./tokens-base.css', import.meta.url)),
  'utf8',
);

type Oklch = { L: number; C: number; H: number };

/**
 * Read the LIGHT arm of a `light-dark()` token declaration from tokens-base.css
 * and parse its OKLCH components. We deliberately read the light arm only — the
 * dark arm is preserved untouched by this task, and the parity-floor assertions
 * are about light mode specifically.
 */
function lightArmOklch(tokenName: string): Oklch {
  // Match: `<tokenName>: light-dark(oklch(<light>), oklch(<dark>));`
  const pattern = new RegExp(`${tokenName}\\s*:\\s*light-dark\\(\\s*oklch\\(([^)]+)\\)`, 'm');
  const match = tokensCss.match(pattern);
  if (!match?.[1]) {
    throw new Error(`Could not find light-dark(oklch(...)) for ${tokenName} in tokens-base.css`);
  }
  const [lRaw, cRaw, hRaw] = match[1].trim().split(/\s+/);
  if (lRaw === undefined || cRaw === undefined || hRaw === undefined) {
    throw new Error(`Malformed oklch() for ${tokenName} in tokens-base.css: "${match[1]}"`);
  }
  // Lightness may be authored as a percentage (e.g. `95%`) or a 0..1 number.
  const L = lRaw.endsWith('%') ? Number.parseFloat(lRaw) / 100 : Number.parseFloat(lRaw);
  return { L, C: Number.parseFloat(cRaw), H: Number.parseFloat(hRaw) };
}

describe('light-mode surface ladder parity floor', () => {
  const bg = lightArmOklch('--cinder-bg');
  const surface = lightArmOklch('--cinder-surface');
  const raised = lightArmOklch('--cinder-surface-raised');
  const inset = lightArmOklch('--cinder-surface-inset');

  test('surface-raised sits above the page background', () => {
    // The light ramp is intentionally GENTLE: a subtle blue-tinted ladder (echoing dark mode's
    // blue character) with shallow steps so no surface reads as a heavy slab. raised 1.0 − bg 0.96
    // = 0.04. The strict-ordering test below is the load-bearing guarantee; this floor just guards
    // against the step collapsing to zero.
    expect(raised.L - bg.L).toBeGreaterThanOrEqual(0.03);
  });

  test('surface sits above surface-inset', () => {
    // inset was lightened to 0.955 (from a cold dark 0.915) so large inset regions — chat timeline,
    // panels, segmented-control track, disabled fields — stop reading as a dark slab against the
    // white message card. The trough is deliberately shallow now: surface 0.985 − inset 0.955 = 0.03,
    // and inset stays below the page bg (0.96) by 0.005 so the ladder ordering still holds.
    expect(surface.L - inset.L).toBeGreaterThanOrEqual(0.025);
  });

  test('surface-raised stays the pure-white anchor', () => {
    // The fix explicitly keeps raised at L=1.0 (pure-white) as the top of the
    // ladder. Guard against an accidental nudge that would invert the ladder.
    expect(raised.L).toBe(1);
  });

  test('the four surfaces are strictly ordered inset < bg < surface < raised', () => {
    expect(inset.L).toBeLessThan(bg.L);
    expect(bg.L).toBeLessThan(surface.L);
    expect(surface.L).toBeLessThan(raised.L);
  });
});

describe('light-mode border parity floor', () => {
  const border = lightArmOklch('--cinder-border');
  const raised = lightArmOklch('--cinder-surface-raised');

  test('the default border reads against the secondary button fill (surface-raised)', () => {
    // Secondary button: fill = surface-raised (L=1.0), border = --cinder-border.
    // Pre-fix border L=0.86 → ΔL=0.14 (fails). Post-fix L=0.79 → ΔL=0.21.
    expect(raised.L - border.L).toBeGreaterThanOrEqual(0.15);
  });
});

describe('light-mode accent vividness floor', () => {
  const accent = lightArmOklch('--cinder-accent');
  const accentContrast = lightArmOklch('--cinder-accent-contrast');

  test('accent is darkened toward an ink-like cyan, not collapsed to a dark teal', () => {
    // Design decision (89d25073, revised): the light accent was darkened from
    // the bright cyan (L=0.72) to a more ink-like L=0.66. As a FOREGROUND its
    // contrast improves (~2:1 → ~2.7:1) but still does not clear the 3:1 UI
    // floor, so --cinder-accent-text remains the foreground token; --cinder-accent
    // is a FILL (it carries the dark-ink label at ~7.2:1). Dark accent stays
    // L=0.78. The 0.65 floor still passes at 0.66; pre-fix darken-direction
    // values (L≈0.42-0.45) still fail it, so the accent cannot silently collapse
    // back toward a dark-teal.
    expect(accent.L).toBeGreaterThanOrEqual(0.65);
  });

  test('accent chroma stays at the design vividness floor', () => {
    // Design vividness floor (ticket 89d25073) -- light accent C=0.16, an
    // ink-like cyan. THIS task lowered the floor from 0.18 to 0.16: that was a
    // deliberate vividness floor, NOT a contrast guarantee, and the neon-pop
    // reduction (cyan no longer vibrates against the page) is intentional.
    // Pre-fix nominal C=0.14 still fails.
    expect(accent.C).toBeGreaterThanOrEqual(0.16);
  });

  test('accent hue is preserved (cyan, hue 195)', () => {
    expect(accent.H).toBe(195);
  });

  test('the light accent flips its on-accent text to dark for readability', () => {
    // The ink-like L=0.66 fill cannot carry white text at AA, so the light arm of
    // --cinder-accent-contrast must be a dark ink. Guard the pairing so a future
    // accent edit can't silently leave white-on-cyan (a contrast failure).
    expect(accentContrast.L).toBeLessThanOrEqual(0.3);
  });
});
