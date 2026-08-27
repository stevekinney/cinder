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
 *   2. sRGB gamut — the brand/status/chart tokens this color contract governs (and the
 *      interactive/contrast tokens derived from them) resolve inside sRGB, so the browser
 *      renders the specified chroma instead of silently clamping it. This is a TARGETED
 *      gate over the governed palette, not a universal "every oklch() property" sweep —
 *      the parser handles only the literal oklch subset these tokens use (no alpha-slash,
 *      hex, or var()-fallback forms that neutral/surface tokens use). See the gamut
 *      describe block for the exact scope and why a universal sweep is out of scope.
 *   3. The 8 categorical chart series stay mutually distinguishable: min pairwise
 *      CIEDE2000 ΔE00 ≥ 12 (normal vision) AND a min pairwise CIE L* separation ≥ 4 per
 *      arm. The L* floor is a SECONDARY distinguishing cue — lightness stays a usable
 *      channel for color-vision-deficient viewers when hue contrast degrades — not a
 *      standalone CVD-safety proof and not an ordered ladder. It also reports, as a
 *      non-blocking diagnostic, the post-simulation ΔE00 under deuteranopia/protanopia/
 *      tritanopia, since no 8-color palette can clear a meaningful ΔE00 floor there
 *      (even Tableau 10 collapses to ≈1.3).
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

const TOKENS_DIRECTORY = join(dirname(fileURLToPath(import.meta.url)), '..', 'tokens');

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

function mixOklch(base: OklchColor, target: OklchColor, targetPercent: number): OklchColor {
  const weight = targetPercent / 100;
  const baseHue = base.c === 0 ? target.h : base.h;
  const targetHue = target.c === 0 ? base.h : target.h;
  let hueDelta = targetHue - baseHue;
  if (hueDelta > 180) hueDelta -= 360;
  if (hueDelta < -180) hueDelta += 360;
  return {
    l: base.l + (target.l - base.l) * weight,
    c: base.c + (target.c - base.c) * weight,
    h: baseHue + hueDelta * weight,
  };
}

function deriveStatusTier(base: OklchColor, target: OklchColor): OklchColor {
  const mixed = mixOklch(base, target, 36);
  return { ...mixed, c: Math.min(mixed.c, 0.05) };
}

function compositeOver(foreground: Rgb, background: Rgb, opacity: number): Rgb {
  return foreground.map(
    (channel, index) => channel * opacity + background[index]! * (1 - opacity),
  ) as Rgb;
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
  // Reference (Sharma et al.) normalizes hue angles to [0, 360); atan2 returns (-180, 180].
  const h1p = c1p === 0 ? 0 : ((Math.atan2(b1, a1p) * 180) / Math.PI + 360) % 360;
  const h2p = c2p === 0 ? 0 : ((Math.atan2(b2, a2p) * 180) / Math.PI + 360) % 360;
  const dLp = bigL2 - bigL1;
  const dCp = c2p - c1p;
  // Zero-chroma branch (CIEDE2000 reference): when either adjusted chroma is zero, hue is
  // undefined — set the hue delta to 0 and skip the ±360 wrap. Without this, atan2(0, 0)
  // is treated as a real angle and produces a nonstandard ΔE00 for grayscale pairs.
  const chromaProduct = c1p * c2p;
  let dhp = 0;
  if (chromaProduct !== 0) {
    dhp = h2p - h1p;
    if (dhp > 180) dhp -= 360;
    else if (dhp < -180) dhp += 360;
  }
  const dHp = 2 * Math.sqrt(c1p * c2p) * Math.sin((dhp * Math.PI) / 360);
  const lBarP = (bigL1 + bigL2) / 2;
  const cBarP = (c1p + c2p) / 2;
  // Mean hue: again undefined at zero chroma — the reference sets it to the sum (one of the
  // two angles is 0), with no ±360 wrap and no halving when the product is zero.
  let hBarP: number;
  if (chromaProduct === 0) {
    hBarP = h1p + h2p;
  } else if (Math.abs(h1p - h2p) <= 180) {
    hBarP = (h1p + h2p) / 2;
  } else {
    hBarP = (h1p + h2p + (h1p + h2p < 360 ? 360 : -360)) / 2;
  }
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

/**
 * The registry and the two resolved contexts this gate reads.
 *
 * Everything below used to be CSS parsing: read `tokens-base.css`, strip
 * comments, walk paren depth to capture a multiline value, split
 * `light-dark(a, b)` at its top-level comma, parse each `oklch(L% C H)`
 * literal, and re-implement `oklch(from … calc(l - X) c h)` in TypeScript so
 * derived tokens had a value at all.
 *
 * None of that is needed now. Each resolved context already holds one literal
 * typed value per token, per theme, with derivations resolved -- `accent.text`
 * arrives as `0.45` rather than as an expression this file has to evaluate. So
 * the gate reads the same values the package publishes instead of
 * re-deriving them from the CSS those values generated, and a token that
 * adopts richer CSS syntax can no longer drift past a hand-written parser.
 */
/**
 * Parse a generated JSON artifact into a plain record. `JSON.parse` is typed
 * `any`, so the result is narrowed through `unknown` rather than asserted
 * straight into a shape -- an artifact that is not an object should fail here
 * naming the file, not later as a confusing property access.
 */
function readJsonRecord(...pathSegments: readonly string[]): Record<string, unknown> {
  const filePath = join(...pathSegments);
  const parsed: unknown = JSON.parse(readFileSync(filePath, 'utf8'));
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`${filePath} is not a JSON object`);
  }
  return parsed as Record<string, unknown>;
}

/** The registry's `cssProperty -> corpus path` map, validated at load. */
function readCssPropertyToPath(): Record<string, string> {
  const map = readJsonRecord(TOKENS_DIRECTORY, 'registry.generated.json')['cssPropertyToPath'];
  if (typeof map !== 'object' || map === null || Array.isArray(map)) {
    throw new Error('registry.generated.json has no cssPropertyToPath object');
  }
  return map as Record<string, string>;
}

const cssPropertyToPath = readCssPropertyToPath();

const resolvedContexts = {
  light: readJsonRecord(TOKENS_DIRECTORY, 'resolved', 'light.json'),
  dark: readJsonRecord(TOKENS_DIRECTORY, 'resolved', 'dark.json'),
};

/**
 * One token's `$value` from a resolved context, or `undefined` when the context
 * does not carry that path.
 */
function readResolvedValue(arm: 'light' | 'dark', path: string): unknown {
  const token = resolvedContexts[arm][path];
  if (token === undefined) return undefined;
  if (typeof token !== 'object' || token === null) {
    throw new Error(`resolved ${arm} entry for ${path} is not an object`);
  }
  return (token as { $value?: unknown }).$value;
}

/**
 * The DTCG color subset these tokens are authored in: `oklch` with three
 * numeric components. Hard-fails on anything else -- a token that grows an
 * alpha channel, a `none` component, or a different color space trips the gate
 * loudly rather than being silently mis-read, which is the same contract the
 * old literal parser held.
 */
function parseResolvedColor(value: unknown, tokenName: string, arm: string): OklchColor {
  if (typeof value !== 'object' || value === null) {
    throw new Error(`${tokenName} (${arm}) has no object $value`);
  }
  const color = value as { colorSpace?: unknown; components?: unknown; alpha?: unknown };
  if (color.colorSpace !== 'oklch') {
    throw new Error(`${tokenName} (${arm}) is not oklch: ${JSON.stringify(color.colorSpace)}`);
  }
  if (color.alpha !== undefined) {
    throw new Error(`${tokenName} (${arm}) carries an alpha channel this gate does not model`);
  }
  const components = color.components;
  if (!Array.isArray(components) || components.length !== 3) {
    throw new Error(`${tokenName} (${arm}) does not have three oklch components`);
  }
  const [l, c, h] = components;
  if (typeof l !== 'number' || typeof c !== 'number' || typeof h !== 'number') {
    throw new Error(`${tokenName} (${arm}) has a non-numeric oklch component`);
  }
  return { l, c, h };
}

type TokenArms = { light: OklchColor; dark: OklchColor };

/**
 * Both theme arms of one token, by its CSS custom-property name. Throws when a
 * property has no corpus token or is absent from a resolved context, so a
 * renamed or deleted token fails here instead of quietly dropping an assertion.
 */
function readOklchToken(tokenName: string): TokenArms {
  const path = cssPropertyToPath[tokenName];
  if (path === undefined) {
    throw new Error(`${tokenName} has no corpus token in the generated registry`);
  }
  const read = (arm: 'light' | 'dark'): OklchColor => {
    const value = readResolvedValue(arm, path);
    if (value === undefined) {
      throw new Error(`${tokenName} (${path}) is absent from the resolved ${arm} context`);
    }
    return parseResolvedColor(value, tokenName, arm);
  };
  return { light: read('light'), dark: read('dark') };
}

/**
 * A number token's resolved value, e.g. `--cinder-opacity-disabled` -> 0.55.
 * Opacities participate in the contrast math (a muted foreground is composited
 * against its background), so they come from resolved output like the colors.
 */
function readNumberToken(tokenName: string): number {
  const path = cssPropertyToPath[tokenName];
  if (path === undefined) {
    throw new Error(`${tokenName} has no corpus token in the generated registry`);
  }
  const value = readResolvedValue('light', path);
  if (typeof value !== 'number') {
    throw new Error(`${tokenName} is not a number token: ${JSON.stringify(value)}`);
  }
  return value;
}

/**
 * The generated stylesheet, read ONLY for the handful of assertions that are
 * about CSS shape rather than about a color value: that one token is emitted as
 * a literal `var(--other)` alias rather than a duplicated value, and that
 * `--cinder-type-tab-size` is declared at all.
 *
 * Those cannot move to resolved output, and should not: resolution follows an
 * alias to the value it points at, which is exactly what these assertions exist
 * to distinguish. Every assertion about a color VALUE reads resolved output;
 * only assertions about the emitted CSS text read the CSS.
 */
const css = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'tokens-base.css'),
  'utf8',
).replace(/\/\*[\s\S]*?\*\//g, '');

/**
 * The full value of one custom property from the comment-stripped stylesheet,
 * balancing parentheses so a multiline value is captured whole. Throws when the
 * token is absent -- a silent miss would drop an assertion.
 */
function readTokenValue(source: string, tokenName: string): string {
  const marker = `${tokenName}:`;
  const start = source.indexOf(marker);
  if (start === -1) throw new Error(`token ${tokenName} not found in tokens-base.css`);
  let depth = 0;
  let value = '';
  for (let index = start + marker.length; index < source.length; index += 1) {
    const character = source[index];
    if (character === '(') depth += 1;
    else if (character === ')') depth -= 1;
    else if (character === ';' && depth === 0) return value.trim().replace(/\s+/g, ' ');
    value += character;
  }
  throw new Error(`token ${tokenName} value never terminated (unbalanced parens?)`);
}

/**
 * Resolve a relative-color derivation of the shape
 * `oklch(from var(--cinder-accent) calc(l - X) c h)` against a parsed base color.
 * Retained because several assertions derive a value that has no token of its
 * own -- a hover state computed in a component rule rather than declared in the
 * corpus. Tokens that DO exist are read directly.
 */
function deriveFromAccent(base: OklchColor, lDelta: number): OklchColor {
  return { l: base.l + lDelta, c: base.c, h: base.h };
}

// ---------------------------------------------------------------------------
// The gate
// ---------------------------------------------------------------------------

const accent = readOklchToken('--cinder-accent');
const accentContrast = readOklchToken('--cinder-accent-contrast');
const accentText = readOklchToken('--cinder-accent-text');
const info = readOklchToken('--cinder-info');
const infoContrast = readOklchToken('--cinder-info-contrast');
const neutralBg = readOklchToken('--cinder-color-neutral-bg');
const infoBg = readOklchToken('--cinder-color-info-bg');
const infoFg = readOklchToken('--cinder-color-info-fg');
const successBg = readOklchToken('--cinder-color-success-bg');
const successFg = readOklchToken('--cinder-color-success-fg');
const warningBg = readOklchToken('--cinder-color-warning-bg');
const warningFg = readOklchToken('--cinder-color-warning-fg');
const dangerBg = readOklchToken('--cinder-color-danger-bg');
const dangerFg = readOklchToken('--cinder-color-danger-fg');
const success = readOklchToken('--cinder-success');
const warning = readOklchToken('--cinder-warning');
const danger = readOklchToken('--cinder-danger');
const successContrast = readOklchToken('--cinder-success-contrast');
const warningContrast = readOklchToken('--cinder-warning-contrast');
const dangerContrast = readOklchToken('--cinder-danger-contrast');
const infoBorder = readOklchToken('--cinder-color-info-border');
const successBorder = readOklchToken('--cinder-color-success-border');
const warningBorder = readOklchToken('--cinder-color-warning-border');
const dangerBorder = readOklchToken('--cinder-color-danger-border');
// Authored (not relative-derived) so the gamut gate can parse them directly — red (h 25)
// clamps at low lightness, so these are pinned to their in-gamut chroma maxima.
const dangerHover = readOklchToken('--cinder-danger-hover');
const dangerActive = readOklchToken('--cinder-danger-active');
const infoHover = readOklchToken('--cinder-info-hover');
const infoActive = readOklchToken('--cinder-info-active');
const successHover = readOklchToken('--cinder-success-hover');
const successActive = readOklchToken('--cinder-success-active');
const warningHover = readOklchToken('--cinder-warning-hover');
const warningActive = readOklchToken('--cinder-warning-active');
const bg = readOklchToken('--cinder-bg');
const surface = readOklchToken('--cinder-surface');
const surfaceInset = readOklchToken('--cinder-surface-inset');
const surfaceRaised = readOklchToken('--cinder-surface-raised');
const text = readOklchToken('--cinder-text');
const borderFaint = readOklchToken('--cinder-border-faint');
const borderMuted = readOklchToken('--cinder-border-muted');
const border = readOklchToken('--cinder-border');
const borderStrong = readOklchToken('--cinder-border-strong');
const opacityDisabled = readNumberToken('--cinder-opacity-disabled');
const opacityMuted = readNumberToken('--cinder-opacity-muted');
const opacityFaint = readNumberToken('--cinder-opacity-faint');

// The active command-palette item paints --cinder-accent-contrast text on a solid
// --cinder-accent fill (command-item.css), so that pair is gated here too.

const chartSeries = Array.from({ length: 8 }, (_, i) =>
  readOklchToken(`--cinder-chart-series-${i + 1}`),
);

const AA_TEXT = 4.5;
const NON_TEXT = 3.0;

describe('ciede2000 reference correctness (zero-chroma branch)', () => {
  // Canonical pairs from Sharma, Wu & Dalal (2005), Table 1 — the dataset used to validate
  // CIEDE2000 implementations. These three exercise the zero-chroma branches: each pair has at
  // least one term on the neutral axis (a*=b*=0, so adjusted chroma is 0), which is exactly the
  // case the implementation must special-case (dhp=0, hBarP=h1p+h2p) rather than feeding
  // atan2(0,0) through the hue math. Tolerance 1e-3 matches the table's reported precision.
  const cases: ReadonlyArray<{ a: Lab; b: Lab; expected: number }> = [
    // Zero-chroma branch: a neutral term (a*=b*=0) makes adjusted chroma 0.
    { a: [50, 0, 0], b: [50, -1, 2], expected: 2.3669 }, // Sharma pair (neutral first term)
    { a: [50, 0, 0], b: [50, 0, 0], expected: 0 }, // both neutral → identical → 0
    { a: [50, 2.5, 0], b: [50, 0, 0], expected: 3.4582 }, // one neutral term (verified independently)
    // Chromatic hue-wrap pairs from Sharma et al. Table 1 — guard the non-neutral path too,
    // so the zero-chroma special-casing can't accidentally break the general formula.
    { a: [50, 2.6772, -79.7751], b: [50, 0, -82.7485], expected: 2.0425 },
    { a: [50, 2.5, 0], b: [50, 3.2972, 0], expected: 1.0 },
    { a: [50, 2.5, 0], b: [73, 25, -18], expected: 27.1492 },
  ];

  for (const { a, b, expected } of cases) {
    it(`ΔE00([${a.join(', ')}], [${b.join(', ')}]) ≈ ${expected}`, () => {
      expect(ciede2000(a, b)).toBeCloseTo(expected, 3);
    });
  }

  it('is symmetric for a neutral/chromatic pair', () => {
    const a: Lab = [50, 0, 0];
    const b: Lab = [55, 3, -4];
    expect(ciede2000(a, b)).toBeCloseTo(ciede2000(b, a), 10);
  });
});

describe('shipped CSS agrees with the resolved values these assertions use', () => {
  // Moving the contrast math onto resolved output made every assertion below
  // read the SOURCE OF TRUTH rather than the artifact browsers consume. That is
  // the right source for the math -- but on its own it would leave the emitted
  // stylesheet unvalidated: a generator bug that swapped a `light-dark()` arm or
  // mangled a value would regenerate deterministically, satisfy
  // `tokens:generate -- --check`, and never fail a contrast assertion.
  //
  // This closes that hole from the other side. Every token emitted as a literal
  // two-arm `light-dark(oklch(...), oklch(...))` must match the two resolved
  // values, so the contrast results stay anchored to what actually ships
  // without re-deriving colors from CSS. Aliases and recipe-driven values are
  // skipped here and covered by the CSS-shape assertions instead.
  // No `/` inside either arm: an alpha channel is deliberately outside what
  // `parseResolvedColor` models, so those tokens belong to the CSS-shape
  // assertions rather than to this numeric comparison.
  const LITERAL_TWO_ARM = /^light-dark\(\s*oklch\([^()/]*\)\s*,\s*oklch\([^()/]*\)\s*\)$/;

  const comparable = Object.keys(cssPropertyToPath)
    .filter((property) => css.includes(`${property}:`))
    .filter((property) => {
      try {
        return LITERAL_TWO_ARM.test(readTokenValue(css, property));
      } catch {
        return false;
      }
    })
    .sort();

  it('compares a meaningful number of tokens rather than silently matching none', () => {
    // Guards the filters above: a regex or naming change that stopped matching
    // would otherwise turn this whole block into a vacuous pass.
    expect(comparable.length).toBeGreaterThan(20);
  });

  for (const property of comparable) {
    it(`${property} emits the resolved light and dark values`, () => {
      const arms = readOklchToken(property);
      const numbers = [...readTokenValue(css, property).matchAll(/[\d.]+/g)].map((match) =>
        Number(match[0]),
      );
      expect(numbers).toHaveLength(6);

      const [lightL, lightC, lightH, darkL, darkC, darkH] = numbers as [
        number,
        number,
        number,
        number,
        number,
        number,
      ];
      expect(lightL / 100).toBeCloseTo(arms.light.l, 4);
      expect(lightC).toBeCloseTo(arms.light.c, 4);
      expect(lightH).toBeCloseTo(arms.light.h, 3);
      expect(darkL / 100).toBeCloseTo(arms.dark.l, 4);
      expect(darkC).toBeCloseTo(arms.dark.c, 4);
      expect(darkH).toBeCloseTo(arms.dark.h, 3);
    });
  }
});

describe('resolved-value reader', () => {
  it('reads both theme arms of a real token from resolved output', () => {
    const accentArms = readOklchToken('--cinder-accent');
    // Sourced from the published resolved contexts, not re-derived from CSS.
    expect(accentArms.light).toEqual({ l: 0.5, c: 0.22, h: 270 });
    expect(accentArms.dark).toEqual({ l: 0.72, c: 0.14, h: 270 });
  });

  // `accent.text` is authored as a relative-color derivation of `accent`. The
  // old reader had to re-implement `calc(l - 0.05)` in TypeScript to know its
  // value; resolution has already applied it.
  it('reads a derived token as a literal value, without re-deriving it', () => {
    expect(readOklchToken('--cinder-accent-text').light.l).toBeCloseTo(0.45, 5);
  });

  it('throws on a token with no corpus entry rather than skipping the assertion', () => {
    expect(() => readOklchToken('--cinder-not-a-real-token')).toThrow(
      /no corpus token in the generated registry/,
    );
  });

  it('rejects a color space this gate does not model', () => {
    expect(() =>
      parseResolvedColor({ colorSpace: 'srgb', components: [1, 1, 1] }, '--x', 'light'),
    ).toThrow(/is not oklch/);
  });

  // Compositing a translucent foreground is not modelled here, so a token that
  // grows an alpha channel must fail loudly rather than be read as opaque.
  it('rejects an alpha channel rather than silently ignoring it', () => {
    expect(() =>
      parseResolvedColor(
        { colorSpace: 'oklch', components: [0.5, 0.2, 270], alpha: 0.5 },
        '--x',
        'light',
      ),
    ).toThrow(/alpha channel/);
  });

  it('rejects a malformed component list', () => {
    expect(() =>
      parseResolvedColor({ colorSpace: 'oklch', components: [0.5, 0.2] }, '--x', 'light'),
    ).toThrow(/three oklch components/);
  });

  it('reads a number token from resolved output', () => {
    expect(readNumberToken('--cinder-opacity-disabled')).toBeCloseTo(0.55, 5);
  });
});

describe('CSS shape reader', () => {
  // Retained for the assertions that are about the emitted CSS text rather than
  // a color value -- an alias must stay an alias, which resolution erases.
  it('throws on an absent token rather than silently skipping it', () => {
    expect(() => readTokenValue(':root { --a: 1; }', '--missing')).toThrow();
  });

  it('throws on an unbalanced value rather than degrading', () => {
    expect(() => readTokenValue(':root { --a: light-dark(oklch(50% 0.2 270)', '--a')).toThrow();
  });

  it('captures a multiline value as one string', () => {
    const sample =
      ':root {\n  --x: light-dark(\n    oklch(50% 0.2 270),\n    oklch(72% 0.14 270)\n  );\n}';
    expect(readTokenValue(sample, '--x')).toBe(
      'light-dark( oklch(50% 0.2 270), oklch(72% 0.14 270) )',
    );
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

  // The active command-palette item paints accent-contrast text AND (since #461)
  // an accent-contrast keyboard-cursor ring on the accent fill. The text needs
  // AA (4.5:1); the ring needs only the WCAG 1.4.11 non-text floor (3:1). Both
  // arms must hold — the existing per-arm AA loop above already covers the text
  // pair in both arms, which is the stronger bound, so it transitively guarantees
  // the ring's 3:1 too. We therefore do NOT repeat a weaker 3:1 assertion here.
  //
  // This file gates the *token contrast*; it does not read command-item.css. The
  // CSS-source test (command-item.css.test.ts) is what pins the ring to
  // `--cinder-accent-contrast` so a swap back to a low-contrast token like
  // `--cinder-ring-color` (~1.1:1 on the accent fill) is caught there.
});

describe('status color contrast', () => {
  const DECORATIVE_BORDER = 1.4;

  it('keeps the opacity scale bounded and ordered by visual weight', () => {
    for (const [name, value] of Object.entries({ opacityDisabled, opacityMuted, opacityFaint })) {
      expect(value, name).toBeGreaterThanOrEqual(0);
      expect(value, name).toBeLessThanOrEqual(1);
    }
    expect(opacityFaint).toBeLessThan(opacityDisabled);
    expect(opacityDisabled).toBeLessThan(opacityMuted);
  });

  it('info fill carries white label at AA (light arm)', () => {
    const white = { l: 1, c: 0, h: 0 };
    expect(contrastRatio(wcagLuminance(white), wcagLuminance(info.light))).toBeGreaterThanOrEqual(
      AA_TEXT,
    );
  });

  it('every soft status tier provides readable foreground and perceptible border contrast', () => {
    const statuses: Array<[string, TokenArms, TokenArms, TokenArms]> = [
      ['neutral', neutralBg, text, border],
      ['info', infoBg, infoFg, infoBorder],
      ['success', successBg, successFg, successBorder],
      ['warning', warningBg, warningFg, warningBorder],
      ['danger', dangerBg, dangerFg, dangerBorder],
    ];
    expect(readTokenValue(css, '--cinder-color-neutral-fg')).toBe('var(--cinder-text)');
    expect(readTokenValue(css, '--cinder-color-neutral-border')).toBe('var(--cinder-border)');
    for (const [name, background, foreground, border] of statuses) {
      for (const arm of ['light', 'dark'] as const) {
        expect(
          contrastRatio(wcagLuminance(foreground[arm]), wcagLuminance(background[arm])),
          `${name} foreground ${arm}`,
        ).toBeGreaterThanOrEqual(AA_TEXT);
        expect(
          contrastRatio(wcagLuminance(border[arm]), wcagLuminance(background[arm])),
          `${name} border ${arm}`,
        ).toBeGreaterThanOrEqual(DECORATIVE_BORDER);
      }
    }
  });

  it('accent status triple clears its foreground and border floors in both theme arms', () => {
    expect(readTokenValue(css, '--cinder-color-accent-bg')).toBe(
      'color-mix(in oklch, var(--cinder-accent), var(--cinder-surface) 88%)',
    );
    expect(readTokenValue(css, '--cinder-color-accent-fg')).toBe('var(--cinder-accent-text)');
    expect(readTokenValue(css, '--cinder-color-accent-border')).toBe(
      'color-mix(in oklch, var(--cinder-accent), transparent 60%)',
    );
    for (const arm of ['light', 'dark'] as const) {
      const background = mixOklch(accent[arm], surface[arm], 88);
      const backgroundRgb = oklchToLinearSrgb(background.l, background.c, background.h);
      const borderRgb = compositeOver(
        oklchToLinearSrgb(accent[arm].l, accent[arm].c, accent[arm].h),
        backgroundRgb,
        0.4,
      );
      expect(
        contrastRatio(wcagLuminance(accentText[arm]), wcagLuminance(background)),
        `accent foreground ${arm}`,
      ).toBeGreaterThanOrEqual(AA_TEXT);
      expect(
        contrastRatio(
          0.2126 * borderRgb[0] + 0.7152 * borderRgb[1] + 0.0722 * borderRgb[2],
          0.2126 * backgroundRgb[0] + 0.7152 * backgroundRgb[1] + 0.0722 * backgroundRgb[2],
        ),
        `accent border ${arm}`,
      ).toBeGreaterThanOrEqual(DECORATIVE_BORDER);
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

  it('every solid status interaction state keeps its contrast label at AA', () => {
    const pairs: Array<[string, TokenArms, TokenArms]> = [
      ['info hover', infoHover, infoContrast],
      ['info active', infoActive, infoContrast],
      ['success hover', successHover, successContrast],
      ['success active', successActive, successContrast],
      ['warning hover', warningHover, warningContrast],
      ['warning active', warningActive, warningContrast],
      ['danger hover', dangerHover, dangerContrast],
      ['danger active', dangerActive, dangerContrast],
    ];
    for (const [name, fill, label] of pairs) {
      for (const arm of ['light', 'dark'] as const) {
        expect(
          contrastRatio(wcagLuminance(fill[arm]), wcagLuminance(label[arm])),
          `${name} ${arm}`,
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
        expect(
          contrastRatio(wcagLuminance(borderMuted[arm]), wcagLuminance(surfaceToken[arm])),
        ).toBeGreaterThanOrEqual(DECORATIVE_BORDER);
      });

      it(`${arm}: functional border clears WCAG 1.4.11 on ${surfaceName}`, () => {
        expect(
          contrastRatio(wcagLuminance(border[arm]), wcagLuminance(surfaceToken[arm])),
        ).toBeGreaterThanOrEqual(NON_TEXT);
      });

      it(`${arm}: strong control border clears WCAG 1.4.11 on ${surfaceName}`, () => {
        expect(
          contrastRatio(wcagLuminance(borderStrong[arm]), wcagLuminance(surfaceToken[arm])),
        ).toBeGreaterThanOrEqual(NON_TEXT);
      });
    }
  }
});

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
    const declarations = [
      ...css.matchAll(
        /--cinder-color-(?:info|success|warning|danger)-(?:muted|subtle):\s*oklch\(\s*from color-mix\(in oklch, var\(--cinder-(?:info|success|warning|danger)\), var\(--cinder-(?:surface|text)\) 36%\) l min\(c, 0\.05\) h\s*\);/g,
      ),
    ];

    expect(declarations).toHaveLength(24);
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
// --cinder-type-tab-size: not a color token, so it has no contrast ratio to
// check — this block instead covers declaration, value, and usage, mirroring
// the per-token coverage this file is the checked-in home for.
// ---------------------------------------------------------------------------

describe('--cinder-type-tab-size (declaration, value, usage)', () => {
  it('is declared in tokens-base.css', () => {
    expect(() => readTokenValue(css, '--cinder-type-tab-size')).not.toThrow();
  });

  it('resolves to a positive integer', () => {
    const value = readTokenValue(css, '--cinder-type-tab-size');
    expect(value).toMatch(/^\d+$/);
    expect(Number.parseInt(value, 10)).toBeGreaterThan(0);
  });

  it('is consumed by every surface it documents itself as backing', () => {
    const consumers = [
      '../components/input/input.css',
      '../components/textarea/textarea.css',
      '../components/code-block/code-block.css',
    ];
    for (const relativePath of consumers) {
      const consumerCss = readFileSync(
        join(dirname(fileURLToPath(import.meta.url)), relativePath),
        'utf8',
      );
      expect(consumerCss).toContain('var(--cinder-type-tab-size)');
    }
  });
});
