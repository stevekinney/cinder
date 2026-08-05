/**
 * Parity floor for the light-mode surface ladder.
 *
 * The original tune (ticket 89d25073) lifted the light theme off a white-on-white
 * wash but left the whole elevation ramp inside a 6-lightness-point band, against
 * the dark arm's 17. Four elevation tiers in a band narrower than one dark-mode
 * step meant fills could not separate regions at all, so every component fell back
 * on a 1px border to draw a boundary — the root cause behind nine separate "why is
 * everything so drab" reports. Decision 1 (2026-08-05) widened the light arm to
 * 11.5 points, which is where its end-to-end WCAG contrast matches dark mode's.
 *
 * This test pins the NOMINAL authored OKLCH ladder — the values we directly control
 * in tokens-base.css — plus the RELATIONSHIPS between the resting tiers and the
 * `color-mix()` interaction states derived from them, which is where the previous
 * tune's real defects lived (see the second describe block). The companion
 * Playwright spec (`theme-parity-light-ladder.playwright.ts`) proves the PAINTED-BACK
 * behavior after Chromium's gamut clipping; this unit test guards the
 * source-of-truth token authoring without needing a server.
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
    // raised 1.000 − bg 0.921 = 0.079.
    expect(raised.L - bg.L).toBeGreaterThanOrEqual(0.03);
  });

  test('surface sits above surface-inset', () => {
    // surface 0.962 − inset 0.885 = 0.077.
    expect(surface.L - inset.L).toBeGreaterThanOrEqual(0.025);
  });

  test('the ramp spans enough lightness to separate tiers without a border', () => {
    // Decision 1 (2026-08-05). The light arm used to span 0.06 against the dark arm's
    // 0.17, so fills could not separate regions and every component fell back on a
    // 1px border to draw a boundary. 0.10 is the floor; the shipped span is 0.115
    // (inset 0.885 → raised 1.000), which is where light mode's end-to-end WCAG
    // contrast (1.410:1) matches dark mode's (1.406:1). Equal contrast — not equal
    // ΔL — is what makes an unbordered edge visible near white.
    expect(raised.L - inset.L).toBeGreaterThanOrEqual(0.1);
  });

  test('every step in the ramp is a real step, not a gesture', () => {
    // The pre-decision ramp had a 0.010 step between inset and bg, which is invisible.
    // The shipped steps are 0.036 / 0.041 / 0.038.
    expect(bg.L - inset.L).toBeGreaterThanOrEqual(0.025);
    expect(surface.L - bg.L).toBeGreaterThanOrEqual(0.025);
    expect(raised.L - surface.L).toBeGreaterThanOrEqual(0.025);
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

  test('raised interaction states derive from the raised surface', () => {
    expect(tokensCss).toMatch(
      /--cinder-surface-raised-hover:\s*color-mix\([\s\S]*?var\(--cinder-surface-raised\)/,
    );
    expect(tokensCss).toMatch(
      /--cinder-surface-raised-pressed:\s*color-mix\([\s\S]*?var\(--cinder-surface-raised\)/,
    );
  });
});

/**
 * The hover/pressed tokens are PROPORTIONAL `color-mix()` derivations, so their
 * resolved lightness scales with whatever the ramp happens to be. That coupling is
 * how the pre-decision tokens ended up with `--cinder-surface-hover` resolving to
 * L 0.9506 against a `--cinder-bg` of 0.95 — hovering a card body painted it exactly
 * the page background — and, in the dark arm, `--cinder-surface-pressed` at 0.2732
 * against `--cinder-surface-raised` at 0.28. Neither was visible to any existing
 * test, because each token was individually reasonable and only the RELATIONSHIP
 * between them was broken.
 *
 * This block resolves the mixes for both arms and asserts that no interaction state
 * lands on a resting tier, so re-tuning either the ramp or the mix percentages
 * cannot silently reintroduce the collision.
 */
describe('interaction states never resolve onto a resting tier', () => {
  /** Read the trailing `<n>%` from a `color-mix(...)` token declaration. */
  function mixPercent(tokenName: string): number {
    const declaration = tokensCss.match(
      new RegExp(`${tokenName}:\\s*color-mix\\(([\\s\\S]*?)\\);`, 'm'),
    );
    if (!declaration?.[1]) throw new Error(`Could not read color-mix() for ${tokenName}`);

    const percent = declaration[1].match(/([\d.]+)%\s*$/);
    if (!percent?.[1]) throw new Error(`No mix percentage in ${tokenName}: ${declaration[1]}`);

    return Number.parseFloat(percent[1]);
  }

  /** Both arms of a `light-dark(oklch(...), oklch(...))` token, lightness only. */
  function bothArms(tokenName: string): { light: number; dark: number } {
    const match = tokensCss.match(
      new RegExp(
        `${tokenName}\\s*:\\s*light-dark\\(\\s*oklch\\(([^)]+)\\),\\s*oklch\\(([^)]+)\\)`,
        'm',
      ),
    );
    if (!match?.[1] || !match[2]) throw new Error(`Could not read both arms of ${tokenName}`);

    const lightnessOf = (components: string): number => {
      const raw = components.trim().split(/\s+/)[0] as string;
      return raw.endsWith('%') ? Number.parseFloat(raw) / 100 : Number.parseFloat(raw);
    };

    return { light: lightnessOf(match[1]), dark: lightnessOf(match[2]) };
  }

  const hoverPercent = mixPercent('--cinder-surface-hover');
  const pressedPercent = mixPercent('--cinder-surface-pressed');

  // `color-mix(in oklch, <base>, black|white <p>%)` interpolates linearly, so the
  // resolved lightness is base·(1−p) in light mode (the mix target is L=0) and
  // base·(1−p) + p in dark mode (the mix target is L=1).
  function resolveMix(base: number, percent: number, arm: 'light' | 'dark'): number {
    const fraction = percent / 100;
    return arm === 'light' ? base * (1 - fraction) : base * (1 - fraction) + fraction;
  }

  // Below this, two fills read as the same color when placed side by side.
  const MIN_SEPARATION = 0.012;

  for (const arm of ['light', 'dark'] as const) {
    const tiers = {
      inset: bothArms('--cinder-surface-inset')[arm],
      bg: bothArms('--cinder-bg')[arm],
      surface: bothArms('--cinder-surface')[arm],
      raised: bothArms('--cinder-surface-raised')[arm],
    };
    const states = {
      'surface-hover': resolveMix(tiers.surface, hoverPercent, arm),
      'surface-pressed': resolveMix(tiers.surface, pressedPercent, arm),
      'surface-raised-hover': resolveMix(tiers.raised, hoverPercent, arm),
      'surface-raised-pressed': resolveMix(tiers.raised, pressedPercent, arm),
    };

    for (const [stateName, stateLightness] of Object.entries(states)) {
      for (const [tierName, tierLightness] of Object.entries(tiers)) {
        test(`${arm}: ${stateName} is distinguishable from ${tierName}`, () => {
          expect(Math.abs(stateLightness - tierLightness)).toBeGreaterThanOrEqual(MIN_SEPARATION);
        });
      }
    }

    test(`${arm}: pressed is distinguishable from hover`, () => {
      expect(Math.abs(states['surface-pressed'] - states['surface-hover'])).toBeGreaterThanOrEqual(
        MIN_SEPARATION,
      );
      expect(
        Math.abs(states['surface-raised-pressed'] - states['surface-raised-hover']),
      ).toBeGreaterThanOrEqual(MIN_SEPARATION);
    });
  }
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

describe('light-mode indigo accent design floor', () => {
  const accent = lightArmOklch('--cinder-accent');
  const accentContrast = lightArmOklch('--cinder-accent-contrast');

  test('accent is a deep indigo fill — dark enough to carry white labels at AA', () => {
    // Design decision: the brand is an indigo whose light arm sits at L=0.50,
    // dark enough that WHITE clears WCAG AA on it (6.45:1) so primary buttons /
    // accent fills carry white text. Guard the upper bound so the accent can't
    // drift bright again (a bright fill would fail white-on-accent). The exact
    // contrast pairing is verified comprehensively in check-token-contrast.test.ts.
    expect(accent.L).toBeLessThanOrEqual(0.55);
    expect(accent.L).toBeGreaterThanOrEqual(0.42);
  });

  test('accent stays vivid (chroma at the design floor)', () => {
    // Indigo at hue 270 supports c≈0.22 in sRGB at L=0.50; keep a vividness floor
    // so the brand can't wash out to a muddy grey-purple.
    expect(accent.C).toBeGreaterThanOrEqual(0.18);
  });

  test('accent hue is indigo (hue 270)', () => {
    expect(accent.H).toBe(270);
  });

  test('the light accent flips its on-accent label to WHITE', () => {
    // The deep indigo fill (L=0.50) is dark enough for white text, so the light
    // arm of --cinder-accent-contrast must be white (L≈1.0). Guard the pairing so
    // a future accent edit can't silently leave dark-on-indigo (a contrast failure).
    expect(accentContrast.L).toBeGreaterThanOrEqual(0.95);
  });
});
