import { describe, expect, it } from 'bun:test';
import type { OklchColor } from './color-contrast-utilities.ts';
import type { TranslucentColor } from './token-contrast-test-readers.ts';

import * as values from './check-token-contrast-test-values.ts';

const {
  AA_TEXT,
  NON_TEXT,
  accent,
  bg,
  border,
  borderFaint,
  borderInk,
  borderMuted,
  borderStrong,
  contrastRatio,
  css,
  polarityInk,
  readAllTokenValues,
  readOklchToken,
  surface,
  surfaceInset,
  surfaceRaised,
  translucentContrastOn,
  wcagLuminance,
} = values;
describe('focus ring contrast (WCAG 1.4.11)', () => {
  // --cinder-ring-color light arm = oklch(from accent 0.55 0.16 h); dark arm = 0.7 0.14 h.
  it('ring clears 3:1 against the page background (both arms)', () => {
    const ringLight: OklchColor = { l: 0.55, c: 0.16, h: accent.light.h };
    const ringDark: OklchColor = { l: 0.7, c: 0.14, h: accent.dark.h };
    expect(contrastRatio(wcagLuminance(ringLight), wcagLuminance(bg.light))).toBeGreaterThanOrEqual(
      NON_TEXT,
    );
    expect(contrastRatio(wcagLuminance(ringDark), wcagLuminance(bg.dark))).toBeGreaterThanOrEqual(
      NON_TEXT,
    );
  });
});

describe('border-on-surface contrast', () => {
  // Faint borders are decorative hairlines rather than controls, but must stay
  // distinguishable from the surfaces they divide.
  const FAINT_BORDER = 1.1;
  // A muted border is decorative, but still has to remain perceptible. The 1.4:1
  // floor rejects the formerly invisible 1.07:1 dark raised-surface pairing
  // without pretending a divider has the same semantic job as a control outline.
  const DECORATIVE_BORDER = 1.4;
  const surfaces = { inset: surfaceInset, bg, surface, raised: surfaceRaised } as const;

  for (const arm of ['light', 'dark'] as const) {
    for (const [surfaceName, surfaceToken] of Object.entries(surfaces)) {
      it(`${arm}: faint border remains distinguishable on ${surfaceName}`, () => {
        expect(
          contrastRatio(wcagLuminance(borderFaint[arm]), wcagLuminance(surfaceToken[arm])),
        ).toBeGreaterThanOrEqual(FAINT_BORDER);
      });

      it(`${arm}: muted border is perceptible on ${surfaceName}`, () => {
        expect(translucentContrastOn(borderMuted[arm], surfaceToken[arm])).toBeGreaterThanOrEqual(
          DECORATIVE_BORDER,
        );
      });

      it(`${arm}: functional border clears WCAG 1.4.11 on ${surfaceName}`, () => {
        expect(translucentContrastOn(border[arm], surfaceToken[arm])).toBeGreaterThanOrEqual(
          NON_TEXT,
        );
      });

      it(`${arm}: strong control border clears WCAG 1.4.11 on ${surfaceName}`, () => {
        expect(translucentContrastOn(borderStrong[arm], surfaceToken[arm])).toBeGreaterThanOrEqual(
          NON_TEXT,
        );
      });
    }
  }

  // -------------------------------------------------------------------------
  // CIN-245: the three structural tiers are alpha steps over ONE ink.
  //
  // The point of composing them that way is not economy, it is UNIFORMITY: an
  // alpha border tracks the surface underneath it, so one tier reads the same
  // weight everywhere it is used. The opaque values these replaced could not
  // do that -- the dark arm's surface ramp spans L 0.11..0.28, so a single
  // opaque border was 4.80:1 on `inset` and 3.42:1 on `raised`, a 29% spread,
  // and every retune had to re-chase it by eye.
  // -------------------------------------------------------------------------
  const structuralTiers = {
    'border.muted': borderMuted,
    'border.control': border,
    'border.strong': borderStrong,
  } as const;

  // Deliberately a proportion of the larger ratio rather than an absolute
  // spread: the tiers sit at very different ratios (1.5:1 vs 4.9:1), so a
  // fixed delta would be near-free for one and unreachable for another.
  const MAX_SPREAD = 0.15;

  for (const arm of ['light', 'dark'] as const) {
    for (const [tierName, tier] of Object.entries(structuralTiers)) {
      it(`${arm}: ${tierName} reads within ${MAX_SPREAD * 100}% across every legal surface`, () => {
        const ratios = Object.entries(surfaces).map(
          ([surfaceName, surfaceToken]) =>
            [surfaceName, translucentContrastOn(tier[arm], surfaceToken[arm])] as const,
        );
        const ratioValues = ratios.map(([, ratio]) => ratio);
        const spread =
          (Math.max(...ratioValues) - Math.min(...ratioValues)) / Math.max(...ratioValues);
        expect(
          spread,
          ratios.map(([name, ratio]) => `${name}=${ratio.toFixed(3)}`).join(' '),
        ).toBeLessThanOrEqual(MAX_SPREAD);
      });
    }

    it(`${arm}: the tiers stay ordered on every surface`, () => {
      for (const [surfaceName, surfaceToken] of Object.entries(surfaces)) {
        const on = (tier: TranslucentColor) => translucentContrastOn(tier, surfaceToken[arm]);
        expect(on(borderStrong[arm]), `strong > control on ${surfaceName}`).toBeGreaterThan(
          on(border[arm]),
        );
        expect(on(border[arm]), `control > muted on ${surfaceName}`).toBeGreaterThan(
          on(borderMuted[arm]),
        );
      }
    });

    it(`${arm}: every structural tier is the SAME ink, differing only in alpha`, () => {
      // AC #1 as a tested property rather than an authoring convention: the
      // corpus repeats the ink's components on each tier (matching how
      // `accent.border` is authored), so nothing but this stops one tier from
      // being nudged off the shared ink and quietly becoming a second source.
      for (const [tierName, tier] of Object.entries(structuralTiers)) {
        expect(
          { l: tier[arm].l, c: tier[arm].c, h: tier[arm].h },
          `${tierName} (${arm}) must resolve to border.ink`,
        ).toEqual(borderInk[arm]);
        expect(tier[arm].alpha, `${tierName} (${arm}) must be translucent`).toBeLessThan(1);
      }
    });
  }

  it('the emitted color-mix percentage agrees with the resolved alpha', () => {
    // The CSS comes from `cssRecipe` and the resolved artifacts come from
    // `$value`; the generator does not relate them. A recipe that says 52% and
    // a `$value` that says 0.48 would ship a border the gate above never
    // measured -- so the two are pinned to each other here.
    const tierProperties = {
      '--cinder-border-muted': borderMuted,
      '--cinder-border': border,
      '--cinder-border-strong': borderStrong,
    } as const;
    for (const [property, tier] of Object.entries(tierProperties)) {
      const expected = `color-mix(in oklch, var(--cinder-border-ink), transparent ${Math.round((1 - tier.light.alpha) * 100)}%)`;
      // EVERY block, not just `:root`. The theme blocks redeclare each tier
      // with their own recipe, and a percentage that drifted there would ship a
      // border no gate had measured -- the contrast assertions read the
      // resolved artifacts, which come from `$value`, not from the recipe.
      const declarations = readAllTokenValues(css, property);
      expect(
        declarations.length,
        `${property} should be declared at :root and in both [data-theme] blocks`,
      ).toBe(3);
      for (const declaration of declarations) {
        expect(
          declaration,
          `${property} recipe must agree with its resolved alpha in every block`,
        ).toBe(expected);
      }
      expect(tier.dark.alpha, `${property} shares one alpha ladder across arms`).toBe(
        tier.light.alpha,
      );
    }
  });

  it('the polarity ink actually contrasts with the surfaces of its own arm', () => {
    // `--cinder-polarity-ink` promises one thing in its name: it is the ink
    // that opposes whatever the theme paints underneath it. Nothing gated that
    // promise -- the browser test proves only that its value PARSES -- so an
    // arm authored backwards, or nudged toward its own surfaces, would ship.
    //
    // The floor is AA text contrast rather than a non-text floor: the ink is
    // the basis for washes at arbitrary alpha, and a basis that only just
    // clears 3:1 leaves nothing to dilute.
    for (const arm of ['light', 'dark'] as const) {
      for (const [surfaceName, surfaceToken] of Object.entries(surfaces)) {
        expect(
          contrastRatio(wcagLuminance(polarityInk[arm]), wcagLuminance(surfaceToken[arm])),
          `polarity ink on ${surfaceName} (${arm})`,
        ).toBeGreaterThanOrEqual(AA_TEXT);
      }
    }
    // And it opposes the surface rather than matching it: the light arm is the
    // darker of the two, the dark arm the lighter. A swapped `light-dark()`
    // would still clear the ratios above, so polarity is asserted on its own.
    expect(polarityInk.light.l, 'light arm must be the dark ink').toBeLessThan(surface.light.l);
    expect(polarityInk.dark.l, 'dark arm must be the light ink').toBeGreaterThan(surface.dark.l);
  });

  it('semantic and status borders stay opaque', () => {
    // The hybrid model CIN-245 ratified: alpha-composed neutral STRUCTURE,
    // opaque semantics. A translucent status border would take its hue from
    // whatever it happened to sit on, which is the opposite of what a status
    // color is for. `readOklchToken` throws on any alpha channel, so simply
    // reading these through it is the assertion.
    for (const status of ['info', 'success', 'warning', 'danger'] as const) {
      expect(() => readOklchToken(`--cinder-status-${status}-border`)).not.toThrow();
    }
    expect(() => readOklchToken('--cinder-border-faint')).not.toThrow();
  });
});
