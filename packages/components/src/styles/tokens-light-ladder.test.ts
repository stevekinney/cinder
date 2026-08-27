/**
 * Parity floor for the light-mode surface ladder.
 *
 * HISTORY, because this file has now encoded two opposite designs and the reason
 * for the reversal matters more than either set of numbers.
 *
 * The 2026-08-05 tune read "light mode is drab" as "the tiers do not separate
 * enough" and widened the light arm DOWNWARD — bg 0.95 → 0.921, inset 0.94 → 0.885 —
 * so that fills alone could draw a region boundary across 11.5 lightness points,
 * matching dark mode's end-to-end WCAG contrast ratio. The contrast math was right
 * and the goal was wrong. The page canvas and inset regions are the DOMINANT areas
 * of a light screen; pushing them to 0.921 and 0.885 turned chat transcripts, code
 * headers, nav strips and settings panels into blue-grey plates, and left white
 * surviving only inside small raised cards. Dark mode earns a wide fill-carried
 * ramp by building UP from near-black. The light-mode mirror of that is not
 * building DOWN from white.
 *
 * The light arm is now anchored at white and compressed — inset 0.960 → bg 0.984 →
 * surface 0.994 → raised 1.000 — with separation carried by border and shadow, the
 * model GitHub, Stripe, Linear and Vercel all use. This file gates THAT, and it
 * gates the properties that make it correct rather than the specific numbers:
 * the canvas reads as white, the well stays a well and not a plate, the neutrals
 * stay neutral, and no interaction state collides with a resting tier.
 *
 * The previous version of this file measured separation as ΔL only. That metric
 * cannot see the current design at all: light-mode hover/pressed now wash toward
 * the ACCENT, so a state and a tier can share a lightness and still be obviously
 * different colors. Separation is therefore measured as OKLab ΔE across L, a and b.
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

/** Parse the three components out of the inside of an `oklch(...)`. */
function parseOklchComponents(components: string, label: string): Oklch {
  const [lRaw, cRaw, hRaw] = components.trim().split(/\s+/);
  if (lRaw === undefined || cRaw === undefined || hRaw === undefined) {
    throw new Error(`Malformed oklch() for ${label}: "${components}"`);
  }
  // Lightness may be authored as a percentage (`98.4%`) or a 0..1 number.
  const L = lRaw.endsWith('%') ? Number.parseFloat(lRaw) / 100 : Number.parseFloat(lRaw);
  return { L, C: Number.parseFloat(cRaw), H: Number.parseFloat(hRaw) };
}

/** Both arms of a `light-dark(oklch(...), oklch(...))` resting-tier token. */
function bothArms(tokenName: string): { light: Oklch; dark: Oklch } {
  const match = tokensCss.match(
    new RegExp(
      `${tokenName}\\s*:\\s*light-dark\\(\\s*oklch\\(([^)]+)\\),\\s*oklch\\(([^)]+)\\)`,
      'm',
    ),
  );
  if (!match?.[1] || !match[2]) throw new Error(`Could not read both arms of ${tokenName}`);
  return {
    light: parseOklchComponents(match[1], `${tokenName} (light)`),
    dark: parseOklchComponents(match[2], `${tokenName} (dark)`),
  };
}

/**
 * An interaction-state token is authored as two complete `color-mix()`
 * expressions wrapped in `light-dark()`, because the light and dark arms use
 * different mix TARGETS and different percentages:
 *
 *   --cinder-surface-hover: light-dark(
 *     color-mix(in oklch, var(--cinder-surface), var(--cinder-accent-solid) 6%),
 *     color-mix(in oklch, var(--cinder-surface), oklch(100% 0 0) 2.5%)
 *   );
 *
 * Returns the base token, the mix target, and the percentage for one arm.
 */
function mixSpec(
  tokenName: string,
  arm: 'light' | 'dark',
): { base: string; target: string; percent: number } {
  // LOCATE tolerantly, then PARSE structurally. Finding the declaration with an
  // exact `${tokenName}: light-dark(` substring would make this throw on a
  // formatting-only change — Prettier wrapping after the colon, or any extra
  // whitespace — which is a confusing failure for something that is not a token
  // change at all. Matching the boundary with `\s*` costs nothing and removes that
  // class of false failure.
  //
  // The BODY still needs a paren-depth scan rather than a regex: both arms are
  // `color-mix(...)` calls carrying their own nested parens, so any non-recursive
  // pattern either stops at the first `)` or swallows both arms.
  const declaration = new RegExp(`${tokenName}\\s*:\\s*light-dark\\s*\\(`).exec(tokensCss);
  if (!declaration) throw new Error(`Could not read light-dark() for ${tokenName}`);

  // The matched text ends AT the opening paren, so its last index is that paren.
  const open = declaration.index + declaration[0].length - 1;
  let depth = 0;
  let end = -1;
  for (let index = open; index < tokensCss.length; index += 1) {
    const character = tokensCss[index];
    if (character === '(') depth += 1;
    else if (character === ')') {
      depth -= 1;
      if (depth === 0) {
        end = index;
        break;
      }
    }
  }
  if (end === -1) throw new Error(`Unbalanced light-dark() for ${tokenName}`);

  // Split the light-dark() body on its TOP-LEVEL comma only.
  const body = tokensCss.slice(open + 1, end);
  depth = 0;
  let split = -1;
  for (let index = 0; index < body.length; index += 1) {
    const character = body[index];
    if (character === '(') depth += 1;
    else if (character === ')') depth -= 1;
    else if (character === ',' && depth === 0) {
      split = index;
      break;
    }
  }
  if (split === -1) throw new Error(`Expected two arms in light-dark() for ${tokenName}`);

  const mix = (arm === 'light' ? body.slice(0, split) : body.slice(split + 1)).trim();
  const parts = mix.match(
    /color-mix\(\s*in oklch,\s*var\((--[\w-]+)\),\s*(var\(--[\w-]+\)|oklch\([^)]+\))\s*([\d.]+)%/,
  );
  if (!parts?.[1] || !parts[2] || !parts[3]) {
    throw new Error(`Could not parse ${arm} color-mix() for ${tokenName}: ${mix}`);
  }

  return { base: parts[1], target: parts[2], percent: Number.parseFloat(parts[3]) };
}

/** Resolve a mix target — either a literal `oklch(...)` or another token. */
function resolveTarget(target: string, arm: 'light' | 'dark'): Oklch {
  const literal = target.match(/^oklch\(([^)]+)\)$/);
  if (literal?.[1]) return parseOklchComponents(literal[1], target);

  const tokenName = target.match(/^var\((--[\w-]+)\)$/)?.[1];
  if (!tokenName) throw new Error(`Unrecognised mix target: ${target}`);
  return bothArms(tokenName)[arm];
}

/**
 * `color-mix(in oklch, A, B p%)`, following CSS Color 4 rather than a naive
 * component lerp. Two rules matter here and both change the answer:
 *
 * 1. POWERLESS HUE. An achromatic endpoint (C = 0) has no meaningful hue, so its
 *    hue is treated as missing and carried from the other endpoint instead of
 *    interpolated. This is not academic: the dark arm mixes toward
 *    `oklch(100% 0 0)`, and lerping 245 → 0 rotates the result ~15° at C ≈ 0.039,
 *    an OKLab a/b error of ~0.010 — the same size as the separation threshold this
 *    file gates on. The light arm hits it too, since `--cinder-surface-raised` is
 *    authored `oklch(100% 0 255)` with C = 0.
 * 2. SHORTEST ARC. Hue interpolates the short way round, per the default `hue`
 *    interpolation method. Every pair here is well under 180° apart, so this is
 *    currently a no-op — it is written out so a future hue change cannot silently
 *    make the helper wrong in the other direction.
 */
function mixOklch(base: Oklch, target: Oklch, percent: number): Oklch {
  const t = percent / 100;

  // Carry the hue of whichever endpoint actually has one.
  const baseHue = base.C === 0 ? target.H : base.H;
  const targetHue = target.C === 0 ? base.H : target.H;

  let hueDelta = targetHue - baseHue;
  if (hueDelta > 180) hueDelta -= 360;
  if (hueDelta < -180) hueDelta += 360;

  return {
    L: base.L + (target.L - base.L) * t,
    C: base.C + (target.C - base.C) * t,
    // Both endpoints achromatic → the result is achromatic and hue is irrelevant.
    H: baseHue + hueDelta * t,
  };
}

/** OKLCH → OKLab rectangular coordinates, so chroma and hue enter the distance. */
function toOklab(color: Oklch): { L: number; a: number; b: number } {
  const radians = (color.H * Math.PI) / 180;
  return {
    L: color.L,
    a: color.C * Math.cos(radians),
    b: color.C * Math.sin(radians),
  };
}

/** Euclidean distance in OKLab — the whole point is that it is not ΔL. */
function deltaE(first: Oklch, second: Oklch): number {
  const a = toOklab(first);
  const b = toOklab(second);
  return Math.hypot(a.L - b.L, a.a - b.a, a.b - b.b);
}

function resolveState(tokenName: string, arm: 'light' | 'dark'): Oklch {
  const spec = mixSpec(tokenName, arm);
  return mixOklch(bothArms(spec.base)[arm], resolveTarget(spec.target, arm), spec.percent);
}

const STATE_TOKENS = [
  '--cinder-surface-hover',
  '--cinder-surface-pressed',
  '--cinder-surface-raised-hover',
  '--cinder-surface-raised-pressed',
] as const;

const TIER_TOKENS = {
  inset: '--cinder-surface-inset',
  bg: '--cinder-surface-canvas',
  surface: '--cinder-surface',
  raised: '--cinder-surface-raised',
} as const;

describe('light mode anchors at white', () => {
  const tiers = {
    inset: bothArms(TIER_TOKENS.inset).light,
    bg: bothArms(TIER_TOKENS.bg).light,
    surface: bothArms(TIER_TOKENS.surface).light,
    raised: bothArms(TIER_TOKENS.raised).light,
  };

  test('the page canvas reads as white', () => {
    // The regression this file exists to prevent. `--cinder-surface-canvas` is the single
    // largest painted area in any light-mode screen; at 0.921 it read as a pale
    // slate plate. Anything below ~0.97 stops reading as "white page".
    expect(tiers.bg.L).toBeGreaterThanOrEqual(0.97);
  });

  test('surface-inset is a gentle well, not a grey plate', () => {
    // At 0.885 this token turned chat transcripts, code-block headers and settings
    // panels into slabs. A well should recede from white, not replace it.
    expect(tiers.inset.L).toBeGreaterThanOrEqual(0.94);
  });

  test('the neutral surfaces stay neutral', () => {
    // Chroma on the large light surfaces is most of what "drab" and "sad" actually
    // described: a 0.014-chroma canvas is not a neutral, it is a pale slate. Keep
    // the cast present but well under the threshold where it reads as a blue theme.
    for (const tier of Object.values(tiers)) {
      expect(tier.C).toBeLessThanOrEqual(0.008);
    }
  });

  test('surface-raised stays the pure-white anchor', () => {
    expect(tiers.raised.L).toBe(1);
    expect(tiers.raised.C).toBe(0);
  });

  test('the four surfaces are strictly ordered inset < bg < surface < raised', () => {
    expect(tiers.inset.L).toBeLessThan(tiers.bg.L);
    expect(tiers.bg.L).toBeLessThan(tiers.surface.L);
    expect(tiers.surface.L).toBeLessThan(tiers.raised.L);
  });

  test('the well is the one tier that separates by fill alone', () => {
    // bg/surface/raised sit within 0.016 of each other on purpose — they are
    // separated by border and shadow. `inset` is the exception: a sunken region has
    // no shadow to fall back on, so its fill has to do the work unaided.
    expect(tiers.bg.L - tiers.inset.L).toBeGreaterThanOrEqual(0.015);
  });
});

describe('the dark arm is untouched by light-mode work', () => {
  // The dark arm builds UP from near-black across 17 lightness points, where a wide
  // fill-carried ramp is the right model. It was never the complaint. Pin it so a
  // future light-mode retune cannot drift it as a side effect.
  const expected = {
    '--cinder-surface-inset': 0.11,
    '--cinder-surface-canvas': 0.15,
    '--cinder-surface': 0.21,
    '--cinder-surface-raised': 0.28,
  } as const;

  for (const [token, lightness] of Object.entries(expected)) {
    test(`${token} dark arm stays at ${lightness}`, () => {
      expect(bothArms(token).dark.L).toBeCloseTo(lightness, 5);
    });
  }
});

describe('light interaction states wash toward the accent', () => {
  // Structural, not numeric. Near white a proportional mix toward BLACK moves a
  // surface further than the entire ramp it has to stay clear of (a 6% black mix is
  // 0.060; the ramp spans 0.040), so every state lands on some resting tier. Mixing
  // toward the accent separates by chroma and hue instead, which is what makes a
  // small lightness step legible — and is where light mode gets its vibrancy.
  for (const token of STATE_TOKENS) {
    test(`${token} mixes toward the accent in light mode`, () => {
      expect(mixSpec(token, 'light').target).toBe('var(--cinder-accent-solid)');
    });

    test(`${token} mixes toward white in dark mode`, () => {
      expect(mixSpec(token, 'dark').target).toMatch(/^oklch\(100%/);
    });
  }

  test('raised interaction states derive from the raised surface', () => {
    expect(mixSpec('--cinder-surface-raised-hover', 'light').base).toBe('--cinder-surface-raised');
    expect(mixSpec('--cinder-surface-raised-pressed', 'light').base).toBe(
      '--cinder-surface-raised',
    );
  });

  test('pressed is a deeper wash than hover', () => {
    expect(mixSpec('--cinder-surface-pressed', 'light').percent).toBeGreaterThan(
      mixSpec('--cinder-surface-hover', 'light').percent,
    );
  });
});

/**
 * The relationship gate. Each token is individually reasonable; the defects that
 * shipped in both previous tunes lived only in how they related to each other, and
 * were invisible to any per-token assertion.
 */
describe('interaction states never resolve onto a resting tier', () => {
  // Below this, two large fills read as the same color side by side. This is an
  // OKLab distance, so an accent-tinted state clears it on chroma even when its
  // lightness is close to a neutral tier — which is exactly the design.
  const MIN_SEPARATION = 0.01;

  for (const arm of ['light', 'dark'] as const) {
    const tiers = Object.fromEntries(
      Object.entries(TIER_TOKENS).map(([name, token]) => [name, bothArms(token)[arm]]),
    ) as Record<keyof typeof TIER_TOKENS, Oklch>;

    const states = Object.fromEntries(
      STATE_TOKENS.map((token) => [
        token.replace('--cinder-surface-', ''),
        resolveState(token, arm),
      ]),
    ) as Record<string, Oklch>;

    for (const [stateName, state] of Object.entries(states)) {
      for (const [tierName, tier] of Object.entries(tiers)) {
        test(`${arm}: ${stateName} is distinguishable from ${tierName}`, () => {
          expect(deltaE(state, tier)).toBeGreaterThanOrEqual(MIN_SEPARATION);
        });
      }
    }

    // Compared WITHIN an element family only. `surface-pressed` and
    // `raised-pressed` land close together (ΔE ≈ 0.006 in light mode), but they are
    // the pressed states of two different elements and never appear adjacent;
    // forcing them apart would push one onto a resting tier, which is the failure
    // that actually matters.
    test(`${arm}: surface pressed is distinguishable from surface hover`, () => {
      expect(deltaE(states['pressed'] as Oklch, states['hover'] as Oklch)).toBeGreaterThanOrEqual(
        MIN_SEPARATION,
      );
    });

    test(`${arm}: raised pressed is distinguishable from raised hover`, () => {
      expect(
        deltaE(states['raised-pressed'] as Oklch, states['raised-hover'] as Oklch),
      ).toBeGreaterThanOrEqual(MIN_SEPARATION);
    });
  }
});
