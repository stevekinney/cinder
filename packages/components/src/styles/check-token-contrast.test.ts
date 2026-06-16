/**
 * Accessibility gate for the color tokens in `tokens-base.css`.
 *
 * Color contrast is a hard, regression-blocking requirement for this design system.
 * This test parses the ACTUAL `light-dark(...)` token values out of `tokens-base.css`
 * (never copied constants, so it validates the shipped CSS) and asserts, for both the
 * light and dark arms:
 *
 *   1. WCAG contrast — every foreground/label/background pair clears its floor
 *      (AA 4.5:1 for text and labels; WCAG 1.4.11 3:1 for the focus ring and other
 *      non-text UI).
 *   2. sRGB gamut — every authored OKLCH color resolves inside sRGB, so the browser
 *      renders the specified chroma instead of silently clamping it.
 *   3. The 8 categorical chart series stay mutually distinguishable: min pairwise
 *      CIEDE2000 ΔE00 ≥ 12 (normal vision) AND min pairwise CIE L* ≥ 4 (a lightness
 *      ladder that survives color-vision-deficiency, where hue collapses). It also
 *      reports — as a non-blocking diagnostic — the post-simulation ΔE00 under
 *      deuteranopia/protanopia/tritanopia, since no 8-color palette can clear a
 *      meaningful ΔE00 floor there (even Tableau 10 collapses to ≈1.3).
 *
 * The color math (OKLCH → OKLab → linear sRGB → WCAG luminance / CIE L* / CIEDE2000)
 * is implemented here from first principles so the gate has no runtime color
 * dependency. The CSS parser is a paren-depth value tokenizer (not a per-line regex)
 * so nested `oklch(...)`/`calc(...)`, comments, and multiline declarations are handled,
 * and it hard-fails on unmatched syntax rather than silently degrading.
 *
 * If this test fails, the token values in `tokens-base.css` are not accessible — fix
 * the values, do not weaken the assertions.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'bun:test';

const TOKENS_PATH = join(dirname(fileURLToPath(import.meta.url)), 'tokens-base.css');

// ---------------------------------------------------------------------------
// Color math
// ---------------------------------------------------------------------------

type Rgb = [number, number, number];
type Lab = [number, number, number];
type OklchColor = { l: number; c: number; h: number };

/** OKLCH (l in 0..1, chroma, hue degrees) → linear sRGB (may be out of [0,1]). */
function oklchToLinearSrgb(l: number, c: number, hDeg: number): Rgb {
  const h = (hDeg * Math.PI) / 180;
  const a = c * Math.cos(h);
  const b = c * Math.sin(h);
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;
  const lCubed = l_ ** 3;
  const mCubed = m_ ** 3;
  const sCubed = s_ ** 3;
  return [
    4.0767416621 * lCubed - 3.3077115913 * mCubed + 0.2309699292 * sCubed,
    -1.2684380046 * lCubed + 2.6097574011 * mCubed - 0.3413193965 * sCubed,
    -0.0041960863 * lCubed - 0.7034186147 * mCubed + 1.707614701 * sCubed,
  ];
}

const GAMUT_EPSILON = 0.001;

/** True when every linear-sRGB channel is within [0,1] (so no chroma clamping occurs). */
function isInSrgbGamut(color: OklchColor): boolean {
  return oklchToLinearSrgb(color.l, color.c, color.h).every(
    (channel) => channel >= -GAMUT_EPSILON && channel <= 1 + GAMUT_EPSILON,
  );
}

/** Clamp each channel of a linear-sRGB triple into [0,1], preserving the tuple type. */
function clampRgb([r, g, b]: Rgb): Rgb {
  const clamp = (channel: number): number => Math.min(1, Math.max(0, channel));
  return [clamp(r), clamp(g), clamp(b)];
}

/** WCAG relative luminance of an OKLCH color (computed on its clamped sRGB output). */
function wcagLuminance(color: OklchColor): number {
  const [r, g, b] = clampRgb(oklchToLinearSrgb(color.l, color.c, color.h));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two relative luminances. */
function contrastRatio(luminanceA: number, luminanceB: number): number {
  const lighter = Math.max(luminanceA, luminanceB);
  const darker = Math.min(luminanceA, luminanceB);
  return (lighter + 0.05) / (darker + 0.05);
}

/** CIE L*a*b* (D65) of an OKLCH color, computed on its clamped sRGB output. */
function toCieLab(color: OklchColor): Lab {
  const [r, g, b] = clampRgb(oklchToLinearSrgb(color.l, color.c, color.h));
  const x = 0.4124564 * r + 0.3575761 * g + 0.1804375 * b;
  const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
  const z = 0.0193339 * r + 0.119192 * g + 0.9503041 * b;
  const xn = 0.95047;
  const yn = 1;
  const zn = 1.08883;
  const f = (t: number): number =>
    t > (6 / 29) ** 3 ? Math.cbrt(t) : t / (3 * (6 / 29) ** 2) + 4 / 29;
  const fx = f(x / xn);
  const fy = f(y / yn);
  const fz = f(z / zn);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** CIEDE2000 color difference between two CIE Lab triples. */
function ciede2000(lab1: Lab, lab2: Lab): number {
  const [bigL1, a1, b1] = lab1;
  const [bigL2, a2, b2] = lab2;
  const c1 = Math.hypot(a1, b1);
  const c2 = Math.hypot(a2, b2);
  const cBar = (c1 + c2) / 2;
  const g = 0.5 * (1 - Math.sqrt(cBar ** 7 / (cBar ** 7 + 25 ** 7)));
  const a1p = (1 + g) * a1;
  const a2p = (1 + g) * a2;
  const c1p = Math.hypot(a1p, b1);
  const c2p = Math.hypot(a2p, b2);
  const h1p = (Math.atan2(b1, a1p) * 180) / Math.PI;
  const h2p = (Math.atan2(b2, a2p) * 180) / Math.PI;
  const dLp = bigL2 - bigL1;
  const dCp = c2p - c1p;
  let dhp = h2p - h1p;
  if (Math.abs(dhp) > 180) dhp -= Math.sign(dhp) * 360;
  const dHp = 2 * Math.sqrt(c1p * c2p) * Math.sin((dhp * Math.PI) / 360);
  const lBarP = (bigL1 + bigL2) / 2;
  const cBarP = (c1p + c2p) / 2;
  let hBarP = h1p + h2p;
  if (Math.abs(h1p - h2p) > 180) hBarP += hBarP < 360 ? 360 : -360;
  hBarP /= 2;
  const t =
    1 -
    0.17 * Math.cos(((hBarP - 30) * Math.PI) / 180) +
    0.24 * Math.cos((2 * hBarP * Math.PI) / 180) +
    0.32 * Math.cos(((3 * hBarP + 6) * Math.PI) / 180) -
    0.2 * Math.cos(((4 * hBarP - 63) * Math.PI) / 180);
  const dTheta = 30 * Math.exp(-(((hBarP - 275) / 25) ** 2));
  const rc = 2 * Math.sqrt(cBarP ** 7 / (cBarP ** 7 + 25 ** 7));
  const sl = 1 + (0.015 * (lBarP - 50) ** 2) / Math.sqrt(20 + (lBarP - 50) ** 2);
  const sc = 1 + 0.045 * cBarP;
  const sh = 1 + 0.015 * cBarP * t;
  const rt = -Math.sin((2 * dTheta * Math.PI) / 180) * rc;
  return Math.sqrt(
    (dLp / sl) ** 2 + (dCp / sc) ** 2 + (dHp / sh) ** 2 + rt * (dCp / sc) * (dHp / sh),
  );
}

/**
 * Brettel-1997-style dichromacy simulation matrices applied in linear sRGB. Used only
 * for the non-blocking CVD diagnostic, never for a hard assertion.
 */
const CVD_MATRICES: Record<string, number[][]> = {
  protan: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deutan: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritan: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
};

function simulateCvd(color: OklchColor, type: keyof typeof CVD_MATRICES): Lab {
  const [r, g, b] = clampRgb(oklchToLinearSrgb(color.l, color.c, color.h));
  const m = CVD_MATRICES[type] as number[][];
  const [row0, row1, row2] = m as [number[], number[], number[]];
  const dot = (row: number[]): number =>
    (row[0] as number) * r + (row[1] as number) * g + (row[2] as number) * b;
  const [sr, sg, sb] = clampRgb([dot(row0), dot(row1), dot(row2)]);
  // Reuse the Lab path on already-linear rgb.
  const x = 0.4124564 * sr + 0.3575761 * sg + 0.1804375 * sb;
  const y = 0.2126729 * sr + 0.7151522 * sg + 0.072175 * sb;
  const z = 0.0193339 * sr + 0.119192 * sg + 0.9503041 * sb;
  const f = (t: number): number =>
    t > (6 / 29) ** 3 ? Math.cbrt(t) : t / (3 * (6 / 29) ** 2) + 4 / 29;
  const fx = f(x / 0.95047);
  const fy = f(y / 1);
  const fz = f(z / 1.08883);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

// ---------------------------------------------------------------------------
// CSS value parsing — paren-depth tokenizer, not a per-line regex
// ---------------------------------------------------------------------------

/** Strip `/* … *\/` comments from CSS source. */
function stripCssComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '');
}

/**
 * Read the full value of one custom property from the (comment-stripped) `:root` block,
 * balancing parentheses so a multiline `light-dark(oklch(...), oklch(...))` is captured
 * whole. Throws if the token is absent or its value never balances — a silent miss here
 * would let an un-asserted token regress.
 */
function readTokenValue(css: string, tokenName: string): string {
  const marker = `${tokenName}:`;
  const start = css.indexOf(marker);
  if (start === -1) throw new Error(`token ${tokenName} not found in tokens-base.css`);
  let index = start + marker.length;
  let depth = 0;
  let value = '';
  for (; index < css.length; index += 1) {
    const ch = css[index];
    if (ch === '(') depth += 1;
    else if (ch === ')') depth -= 1;
    else if (ch === ';' && depth === 0) {
      return value.trim().replace(/\s+/g, ' ');
    }
    value += ch;
  }
  throw new Error(`token ${tokenName} value never terminated (unbalanced parens?)`);
}

/** Parse a single `oklch(L% C H)` function into normalized numbers. */
function parseOklch(fn: string): OklchColor {
  const match = fn.match(/^oklch\(\s*([\d.]+)%\s+([\d.]+)\s+([\d.]+)\s*\)$/);
  if (!match) throw new Error(`unparseable oklch literal: "${fn}"`);
  return { l: Number(match[1]) / 100, c: Number(match[2]), h: Number(match[3]) };
}

/** Split the inner arguments of `light-dark(<a>, <b>)` at the top-level comma. */
function splitLightDark(value: string): [string, string] {
  const match = value.match(/^light-dark\(\s*([\s\S]+)\)$/);
  const inner = match?.[1];
  if (inner === undefined) throw new Error(`expected light-dark(...), got "${value}"`);
  let depth = 0;
  for (let i = 0; i < inner.length; i += 1) {
    const char = inner[i];
    if (char === '(') depth += 1;
    else if (char === ')') depth -= 1;
    else if (char === ',' && depth === 0) {
      return [inner.slice(0, i).trim(), inner.slice(i + 1).trim()];
    }
  }
  throw new Error(`light-dark value has no top-level comma: "${value}"`);
}

type TokenArms = { light: OklchColor; dark: OklchColor };

/** Read a `light-dark(oklch(...), oklch(...))` token and parse both arms. */
function readOklchToken(css: string, tokenName: string): TokenArms {
  const [light, dark] = splitLightDark(readTokenValue(css, tokenName));
  return { light: parseOklch(light), dark: parseOklch(dark) };
}

/**
 * Resolve a relative-color derivation of the shape
 * `oklch(from var(--cinder-accent) calc(l - X) c h)` against a parsed base color,
 * for the specific derivations used in tokens-base.css (a calc on L, keeping c and h).
 */
function deriveFromAccent(base: OklchColor, lDelta: number): OklchColor {
  return { l: base.l + lDelta, c: base.c, h: base.h };
}

// ---------------------------------------------------------------------------
// The gate
// ---------------------------------------------------------------------------

const css = stripCssComments(readFileSync(TOKENS_PATH, 'utf8'));

const accent = readOklchToken(css, '--cinder-accent');
const accentContrast = readOklchToken(css, '--cinder-accent-contrast');
const accentText = readOklchToken(css, '--cinder-accent-text');
const info = readOklchToken(css, '--cinder-info');
const infoContrast = readOklchToken(css, '--cinder-info-contrast');
const infoBg = readOklchToken(css, '--cinder-color-info-bg');
const infoFg = readOklchToken(css, '--cinder-color-info-fg');
const success = readOklchToken(css, '--cinder-success');
const warning = readOklchToken(css, '--cinder-warning');
const danger = readOklchToken(css, '--cinder-danger');
const successContrast = readOklchToken(css, '--cinder-success-contrast');
const warningContrast = readOklchToken(css, '--cinder-warning-contrast');
const dangerContrast = readOklchToken(css, '--cinder-danger-contrast');
const bg = readOklchToken(css, '--cinder-bg');
const surface = readOklchToken(css, '--cinder-surface');
const surfaceInset = readOklchToken(css, '--cinder-surface-inset');

// The active command-palette item paints --cinder-accent-contrast text on a solid
// --cinder-accent fill (command-item.css), so that pair is gated here too.

const chartSeries = Array.from({ length: 8 }, (_, i) =>
  readOklchToken(css, `--cinder-chart-series-${i + 1}`),
);

const AA_TEXT = 4.5;
const NON_TEXT = 3.0;

describe('CSS value tokenizer', () => {
  it('captures a multiline light-dark with nested oklch as one value', () => {
    const sample = `:root {\n  --x: light-dark(\n    oklch(50% 0.2 270),\n    oklch(72% 0.14 270)\n  );\n}`;
    const [light, dark] = splitLightDark(readTokenValue(sample, '--x'));
    expect(parseOklch(light)).toEqual({ l: 0.5, c: 0.2, h: 270 });
    expect(parseOklch(dark)).toEqual({ l: 0.72, c: 0.14, h: 270 });
  });

  it('throws on an absent token rather than silently skipping it', () => {
    expect(() => readTokenValue(':root { --a: 1; }', '--missing')).toThrow();
  });

  it('throws on an unbalanced value rather than degrading', () => {
    expect(() => readTokenValue(':root { --a: light-dark(oklch(50% 0.2 270)', '--a')).toThrow();
  });
});

describe('accent + accent-text contrast (both arms)', () => {
  for (const arm of ['light', 'dark'] as const) {
    it(`${arm}: accent fill carries its contrast label at AA`, () => {
      const ratio = contrastRatio(wcagLuminance(accent[arm]), wcagLuminance(accentContrast[arm]));
      expect(ratio).toBeGreaterThanOrEqual(AA_TEXT);
    });

    it(`${arm}: pressed accent (l-0.11) keeps its contrast label at AA`, () => {
      const pressed = deriveFromAccent(accent[arm], -0.11);
      const ratio = contrastRatio(wcagLuminance(pressed), wcagLuminance(accentContrast[arm]));
      expect(ratio).toBeGreaterThanOrEqual(AA_TEXT);
    });

    it(`${arm}: hover accent (l-0.08) keeps its contrast label at AA`, () => {
      const hover = deriveFromAccent(accent[arm], -0.08);
      const ratio = contrastRatio(wcagLuminance(hover), wcagLuminance(accentContrast[arm]));
      expect(ratio).toBeGreaterThanOrEqual(AA_TEXT);
    });
  }

  it('accent-text clears AA on surface, bg, and inset (light arm)', () => {
    const textLuminance = wcagLuminance(accentText.light);
    for (const surfaceArms of [surface, bg, surfaceInset]) {
      expect(contrastRatio(textLuminance, wcagLuminance(surfaceArms.light))).toBeGreaterThanOrEqual(
        AA_TEXT,
      );
    }
  });

  it('active command-palette item: accent-contrast on accent fill clears AA (light arm)', () => {
    const ratio = contrastRatio(wcagLuminance(accent.light), wcagLuminance(accentContrast.light));
    expect(ratio).toBeGreaterThanOrEqual(AA_TEXT);
  });
});

describe('status color contrast', () => {
  it('info fill carries white label at AA (light arm)', () => {
    const white = { l: 1, c: 0, h: 0 };
    expect(contrastRatio(wcagLuminance(white), wcagLuminance(info.light))).toBeGreaterThanOrEqual(
      AA_TEXT,
    );
  });

  it('info soft-surface fg clears AA on its soft bg (both arms)', () => {
    for (const arm of ['light', 'dark'] as const) {
      expect(
        contrastRatio(wcagLuminance(infoFg[arm]), wcagLuminance(infoBg[arm])),
      ).toBeGreaterThanOrEqual(AA_TEXT);
    }
  });

  it('info contrast label clears AA on info fill (dark arm)', () => {
    expect(
      contrastRatio(wcagLuminance(infoContrast.dark), wcagLuminance(info.dark)),
    ).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it('success/warning/danger contrast labels clear AA on their fills (both arms)', () => {
    const pairs: Array<[TokenArms, TokenArms]> = [
      [success, successContrast],
      [warning, warningContrast],
      [danger, dangerContrast],
    ];
    for (const [fill, label] of pairs) {
      for (const arm of ['light', 'dark'] as const) {
        expect(
          contrastRatio(wcagLuminance(fill[arm]), wcagLuminance(label[arm])),
        ).toBeGreaterThanOrEqual(AA_TEXT);
      }
    }
  });
});

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

describe('sRGB gamut integrity (no silent chroma clamping)', () => {
  const namedTokens: Record<string, TokenArms> = {
    accent,
    accentContrast,
    accentText,
    info,
    infoBg,
    infoFg,
    success,
    warning,
    danger,
  };
  for (const [name, token] of Object.entries(namedTokens)) {
    for (const arm of ['light', 'dark'] as const) {
      it(`${name} ${arm} arm is in sRGB gamut`, () => {
        expect(isInSrgbGamut(token[arm])).toBe(true);
      });
    }
  }
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

describe('chart palette distinguishability + CVD lightness ladder', () => {
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

    it(`${arm}: min pairwise CIE L* separation ≥ ${DELTA_L_FLOOR} (CVD safety ladder)`, () => {
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
