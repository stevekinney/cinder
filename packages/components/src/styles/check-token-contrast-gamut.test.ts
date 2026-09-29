import { describe, expect, it } from 'bun:test';

import * as values from './check-token-contrast-test-values.ts';
import type { TokenArms } from './token-contrast-test-readers.ts';

const {
  AA_TEXT,
  NON_TEXT,
  accent,
  accentContrast,
  accentText,
  borderInk,
  chartSeries,
  ciede2000,
  contrastRatio,
  css,
  danger,
  dangerActive,
  dangerBg,
  dangerBorder,
  dangerContrast,
  dangerFg,
  dangerHover,
  deriveFromAccent,
  deriveStatusTier,
  info,
  infoActive,
  infoBg,
  infoBorder,
  infoContrast,
  infoFg,
  infoHover,
  isInSrgbGamut,
  readOklchToken,
  readTokenValue,
  simulateCvd,
  success,
  successActive,
  successBg,
  successBorder,
  successContrast,
  successFg,
  successHover,
  surface,
  text,
  toCieLab,
  warning,
  warningActive,
  warningBg,
  warningBorder,
  warningContrast,
  warningFg,
  warningHover,
  wcagLuminance,
} = values;
describe('sRGB gamut integrity (no silent chroma clamping)', () => {
  // SCOPE: this is a TARGETED gamut gate over the palette tokens this design system's
  // color contract governs — the literal `light-dark(oklch(...))` brand/status/chart
  // tokens below, PLUS the derived interactive/contrast tokens that resolve from them
  // (computed here from their real basis). It is deliberately NOT a universal "every
  // oklch() custom property" sweep: the parser handles only the literal oklch subset
  // these tokens use, not the alpha-slash (`oklch(... / a)`), hex, or `var()`-fallback
  // forms that neutral/surface/scrollbar tokens use. A universal gate would need a real
  // CSS Color 4 resolver; that is intentionally out of scope (see parseOklch's contract).
  const namedTokens: Record<string, TokenArms> = {
    accent,
    accentContrast,
    accentText,
    info,
    infoBg,
    infoFg,
    successBg,
    successFg,
    warningBg,
    warningFg,
    dangerBg,
    dangerFg,
    success,
    warning,
    danger,
    // Contrast labels (dark arms carry chroma; light arms are pure white).
    infoContrast,
    successContrast,
    warningContrast,
    dangerContrast,
    // Soft-surface info border (success/warning/danger borders parse the same way; info
    // is the one this PR re-hued, so it anchors the border family here).
    infoBorder,
    successBorder,
    warningBorder,
    dangerBorder,
    // Authored danger hover/active — pinned to their in-gamut chroma maxima on the light
    // arm because red (h 25) clamps at low lightness; this gate is what enforces that.
    dangerHover,
    dangerActive,
    infoHover,
    infoActive,
    successHover,
    successActive,
    warningHover,
    warningActive,
    // The border ink's dark arm sits close to its chroma ceiling on purpose:
    // it is what keeps the composed tiers' blue tint at low alpha, and the
    // first candidate for it (`oklch(88% 0.08 250)`) turned out to be OUTSIDE
    // sRGB, where the browser gamut-maps and the tiers quietly stop matching
    // what this file computes. Whoever retunes the ink next needs that caught.
    borderInk,
  };
  for (const [name, token] of Object.entries(namedTokens)) {
    for (const arm of ['light', 'dark'] as const) {
      it(`${name} ${arm} arm is in sRGB gamut`, () => {
        expect(isInSrgbGamut(token[arm])).toBe(true);
      });
    }
  }

  // Derived-from-accent interactive states resolve via relative-color syntax. Indigo
  // (h 270) has ample gamut headroom at lower lightness, but assert it rather than
  // assume it — these are the tokens that paint hover/pressed accent fills and the ring.
  const derivedFromAccent: Record<string, TokenArms> = {
    accentHover: {
      light: deriveFromAccent(accent.light, -0.08),
      dark: deriveFromAccent(accent.dark, -0.08),
    },
    accentActive: {
      light: deriveFromAccent(accent.light, -0.15),
      dark: deriveFromAccent(accent.dark, -0.15),
    },
    accentActiveOnFill: {
      light: deriveFromAccent(accent.light, -0.11),
      dark: deriveFromAccent(accent.dark, -0.11),
    },
    accentTextHover: {
      light: deriveFromAccent(accentText.light, -0.08),
      dark: deriveFromAccent(accentText.dark, -0.08),
    },
    // --cinder-ring-color: oklch(from accent <L> <C> h) — fixed L/C, accent hue only.
    ringColor: {
      light: { l: 0.55, c: 0.16, h: accent.light.h },
      dark: { l: 0.7, c: 0.14, h: accent.dark.h },
    },
  };
  for (const [name, token] of Object.entries(derivedFromAccent)) {
    for (const arm of ['light', 'dark'] as const) {
      it(`${name} ${arm} arm is in sRGB gamut`, () => {
        expect(isInSrgbGamut(token[arm])).toBe(true);
      });
    }
  }

  // The status tiers first mix with their semantic target then reduce chroma to
  // 0.05. This reproduces the relative-color formula and keeps every resolved
  // light/dark result inside the sRGB gamut instead of relying on browser mapping.
  const derivedStatusTiers: Record<string, TokenArms> = {};
  for (const [name, status] of Object.entries({ info, success, warning, danger })) {
    derivedStatusTiers[`${name}Muted`] = {
      light: deriveStatusTier(status.light, surface.light),
      dark: deriveStatusTier(status.dark, surface.dark),
    };
    derivedStatusTiers[`${name}Subtle`] = {
      light: deriveStatusTier(status.light, text.light),
      dark: deriveStatusTier(status.dark, text.dark),
    };
  }
  for (const [name, token] of Object.entries(derivedStatusTiers)) {
    for (const arm of ['light', 'dark'] as const) {
      it(`${name} ${arm} arm is in sRGB gamut`, () => {
        expect(isInSrgbGamut(token[arm])).toBe(true);
      });
    }
  }

  it('applies the status-tier chroma clamp in every theme declaration', () => {
    const statusTierDeclarations = [
      ...css.matchAll(
        /--cinder-status-(?:info|success|warning|danger)-(?:muted|subtle):\s*[^;]+;/g,
      ),
    ];
    const declarations = [
      ...css.matchAll(
        /--cinder-status-(?:info|success|warning|danger)-(?:muted|subtle):\s*oklch\(\s*from\s+color-mix\(\s*in oklch,\s*var\(--cinder-status-(?:info|success|warning|danger)-solid\),\s*var\(--cinder-(?:surface|text-default)\)\s+36%\s*\)\s*l\s*min\(c,\s*0\.05\)\s*h\s*\);/g,
      ),
    ];

    expect(statusTierDeclarations.length).toBeGreaterThan(0);
    expect(declarations).toHaveLength(statusTierDeclarations.length);
  });

  chartSeries.forEach((series, index) => {
    for (const arm of ['light', 'dark'] as const) {
      it(`chart-series-${index + 1} ${arm} arm is in sRGB gamut`, () => {
        expect(isInSrgbGamut(series[arm])).toBe(true);
      });
    }
  });
});

/** Minimum value of `metric` over every unordered pair of items. */
function minPairwise<T>(items: readonly T[], metric: (a: T, b: T) => number): number {
  let min = Infinity;
  for (let i = 0; i < items.length; i += 1) {
    const a = items[i];
    if (a === undefined) continue;
    for (let j = i + 1; j < items.length; j += 1) {
      const b = items[j];
      if (b === undefined) continue;
      min = Math.min(min, metric(a, b));
    }
  }
  return min;
}

describe('chart palette distinguishability + secondary CVD lightness cue', () => {
  const CHART_BG_LIGHT = { l: 0.97, c: 0, h: 0 }; // near-white chart canvas
  const CHART_BG_DARK = { l: 0.2, c: 0, h: 0 }; // dark chart canvas
  const DELTA_E_FLOOR = 12;
  const DELTA_L_FLOOR = 4;

  for (const arm of ['light', 'dark'] as const) {
    const labs = chartSeries.map((s) => toCieLab(s[arm]));

    it(`${arm}: every series is ≥3:1 against the chart background`, () => {
      const bgLum = wcagLuminance(arm === 'light' ? CHART_BG_LIGHT : CHART_BG_DARK);
      for (const series of chartSeries) {
        expect(contrastRatio(wcagLuminance(series[arm]), bgLum)).toBeGreaterThanOrEqual(NON_TEXT);
      }
    });

    it(`${arm}: every series has chroma ≥ 0.06`, () => {
      for (const series of chartSeries) {
        expect(series[arm].c).toBeGreaterThanOrEqual(0.06);
      }
    });

    it(`${arm}: min pairwise CIEDE2000 ΔE00 ≥ ${DELTA_E_FLOOR}`, () => {
      expect(minPairwise(labs, ciede2000)).toBeGreaterThanOrEqual(DELTA_E_FLOOR);
    });

    it(`${arm}: min pairwise CIE L* separation ≥ ${DELTA_L_FLOOR} (secondary lightness cue for CVD viewers — supports ΔE00, not a standalone CVD-safety proof)`, () => {
      const minDeltaL = minPairwise(labs, (a, b) => Math.abs(a[0] - b[0]));
      expect(minDeltaL).toBeGreaterThanOrEqual(DELTA_L_FLOOR);
    });
  }

  it('reports post-CVD ΔE00 as a diagnostic (no hard floor — even Tableau 10 ≈ 1.3)', () => {
    for (const type of ['protan', 'deutan', 'tritan'] as const) {
      const labs = chartSeries.map((s) => simulateCvd(s.light, type));
      const minDeltaE = minPairwise(labs, ciede2000);
      // Diagnostic only — assert it is a finite number so the computation can't silently break.
      expect(Number.isFinite(minDeltaE)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------

describe('terminal ANSI foreground ramp', () => {
  const names = [
    'black',
    'red',
    'green',
    'yellow',
    'blue',
    'magenta',
    'cyan',
    'white',
    'bright-black',
    'bright-red',
    'bright-green',
    'bright-yellow',
    'bright-blue',
    'bright-magenta',
    'bright-cyan',
    'bright-white',
  ];
  it('declares all 16 theme-aware foreground slots', () => {
    for (const name of names) {
      const value = readTokenValue(css, `--cinder-terminal-ansi-${name}`);
      expect(value).toContain('light-dark');
    }
  });

  it('keeps every ANSI foreground readable against the terminal surface in both arms', () => {
    const insetSurface = readOklchToken('--cinder-surface-inset');
    for (const name of names) {
      const foreground = readOklchToken(`--cinder-terminal-ansi-${name}`);
      for (const arm of ['light', 'dark'] as const) {
        expect(
          contrastRatio(wcagLuminance(foreground[arm]), wcagLuminance(insetSurface[arm])),
        ).toBeGreaterThanOrEqual(AA_TEXT);
      }
    }
  });

  it('keeps critical severity foreground readable against its background in both arms', () => {
    const foreground = readOklchToken('--cinder-severity-critical');
    const background = readOklchToken('--cinder-severity-critical-background');
    for (const arm of ['light', 'dark'] as const) {
      expect(
        contrastRatio(wcagLuminance(foreground[arm]), wcagLuminance(background[arm])),
      ).toBeGreaterThanOrEqual(AA_TEXT);
    }
  });
});
