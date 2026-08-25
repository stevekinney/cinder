/**
 * Shared color parsing and output formatting for ColorField and ColorPicker.
 *
 * Both components parse *every* accepted input format — including the
 * modern space-separated syntax `formatColor` itself emits — through
 * `parseCssColor`, which is backed by `culori`'s own CSS color parser rather
 * than a hand-rolled, legacy-comma-only regex parser. That's what makes
 * round-tripping an emitted `rgb(...)`/`hsl(...)`/`oklch(...)` string back
 * into the field or picker actually work: the legacy `parseColor` in
 * `color-luminance.ts` only understands comma-separated legacy syntax and
 * has no notion of `oklch()` at all, so it cannot parse the field's own
 * output once `format` is anything other than `'hex'`.
 *
 * `parseCssColor` turns any accepted input string into the canonical RGBA
 * representation (sRGB channels 0-255, alpha 0-1); `formatColor` turns that
 * canonical representation into a CSS color string in one of five output
 * formats (`hex`, `rgb`, `hsl`, `hwb`, `oklch`) per the CIN-104 ruling
 * recorded in `docs/decisions/color-value-format.md`.
 *
 * Alpha policy:
 *   - hex: `#rrggbbaa` when alpha < 1, plain `#rrggbb` when alpha === 1.
 *     Alpha is never silently dropped.
 *   - non-hex: modern space-separated CSS Color 4 syntax with slash alpha
 *     (e.g. `oklch(l c h / a)`), omitting the `/ a` segment entirely when
 *     alpha === 1.
 *
 * Gamut policy: out-of-sRGB values (currently only reachable by parsing an
 * `oklch()` input string directly) are mapped into sRGB via CSS Color 4
 * chroma reduction (culori's `toGamut`), never hand-rolled chroma clamping —
 * except for the one narrow case where the excursion is reproducible from a
 * real sRGB byte color at our own emission precision (see
 * `isRoundTripArtifact`), which is indistinguishable from our own
 * round-trip noise and is trusted/clamped directly so parse -> emit stays a
 * fixed point. A genuinely out-of-gamut input, even one with a comparably
 * small excursion, still goes through the real chroma-reduction bisection.
 */
import type { Oklch, Rgb } from 'culori';
import { converter, parse, toGamut } from 'culori';

/** Canonical parsed color: sRGB channels 0-255, alpha 0-1. */
export type RgbaComponents = { r: number; g: number; b: number; a: number };

/** Output formats ColorField / ColorPicker can emit. `lab` is deliberately excluded. */
export type ColorOutputFormat = 'hex' | 'rgb' | 'hsl' | 'hwb' | 'oklch';

const toOklchConverter = converter('oklch');
const toHslConverter = converter('hsl');
const toHwbConverter = converter('hwb');
const toRgbConverter = converter('rgb');
const gamutMapOklchToRgb = toGamut('rgb', 'oklch');

/**
 * A direct (non-gamut-mapped) oklch->rgb conversion that lands slightly
 * outside [0, 1] is ambiguous by magnitude alone: it could be a
 * floating-point/decimal-rounding artifact of an already-in-gamut color
 * (specifically, OUR OWN 3/5/2-decimal oklch emission precision — see
 * `formatColor` below — perturbing an in-gamut byte color just past the
 * boundary on reparse), or it could be a genuinely out-of-gamut color a
 * consumer typed in directly, which the CIN-104 policy requires to go
 * through real chroma-reduction, never a hand-rolled clamp — and a
 * deliberately saturated color CAN have an excursion as small as our own
 * rounding noise (see the review thread's `oklch(7.819% 0.04576 306.42)`
 * example), so no fixed epsilon on the excursion's magnitude can tell the
 * two apart.
 *
 * What DOES tell them apart: whether this exact oklch value is reproducible
 * from a real sRGB byte color at our own emission precision. Round the
 * direct conversion to the nearest byte, re-derive the oklch a real color at
 * that byte would emit, and compare at the SAME 3/5/2-decimal precision
 * `formatColor` uses. A match means this is indistinguishable from our own
 * round-trip of an in-gamut byte value — trust the direct/clamped
 * conversion (this is what makes the emit/reparse round-trip a fixed point,
 * verified by the sweep in color-format.test.ts). No match means it's not
 * reproducible from any real sRGB byte at this precision — genuinely
 * out-of-gamut, so it still goes through `toGamut`'s real chroma reduction.
 */
function isRoundTripArtifact(parsed: Oklch, direct: Rgb): boolean {
  const byteR = Math.round(Math.max(0, Math.min(1, direct.r ?? 0)) * 255);
  const byteG = Math.round(Math.max(0, Math.min(1, direct.g ?? 0)) * 255);
  const byteB = Math.round(Math.max(0, Math.min(1, direct.b ?? 0)) * 255);
  const reOklch = toOklchConverter({ mode: 'rgb', r: byteR / 255, g: byteG / 255, b: byteB / 255 });
  return (
    roundTo((parsed.l ?? 0) * 100, 3) === roundTo((reOklch.l ?? 0) * 100, 3) &&
    roundTo(parsed.c ?? 0, 5) === roundTo(reOklch.c ?? 0, 5) &&
    roundTo(parsed.h ?? 0, 2) === roundTo(reOklch.h ?? 0, 2)
  );
}

function toHex2(value: number): string {
  return Math.max(0, Math.min(255, Math.round(value)))
    .toString(16)
    .padStart(2, '0');
}

/** Format a canonical RGBA value as hex, with the fixed alpha policy above. */
export function formatHex(parts: RgbaComponents): string {
  const base = `#${toHex2(parts.r)}${toHex2(parts.g)}${toHex2(parts.b)}`;
  if (parts.a >= 1) return base;
  // An alpha like 0.999 is < 1 but rounds to the 0xff byte — canonicalize to
  // plain #rrggbb rather than emitting a byte-for-byte-opaque #rrggbbff,
  // which would otherwise re-parse as alpha === 1 and flip syntax on the
  // very next round-trip (0.999 in, but exactly 1 out).
  const alphaByte = toHex2(parts.a * 255);
  return alphaByte === 'ff' ? base : base + alphaByte;
}

function rgbaToRgbColor(parts: RgbaComponents): Rgb {
  return {
    mode: 'rgb',
    r: parts.r / 255,
    g: parts.g / 255,
    b: parts.b / 255,
    alpha: parts.a,
  };
}

/** Round to `digits` decimal places, trimming trailing zeros (no `-0`). */
function roundTo(value: number, digits: number): number {
  const rounded = Number(value.toFixed(digits));
  return rounded === 0 ? 0 : rounded;
}

/**
 * Canonicalize alpha to the same 4-decimal precision `formatColor` uses for
 * its `/ a` suffix, BEFORE deciding whether a color counts as opaque. An
 * alpha like 0.9996 is < 1 raw, but anything in the ~0.9995–1 band that
 * rounds to exactly `1` at four decimals must be treated as opaque
 * everywhere a color is displayed or copied — not just in the emitted
 * `value`. Any caller that independently decides "is this alpha opaque?"
 * (copy-panel strings, previews, …) must canonicalize through this exact
 * function rather than rounding to a different precision or gating on the
 * raw value — a mismatched boundary or precision here is what let the
 * ColorPicker copy panel show `rgba(r, g, b, 1)` for a value the emitted
 * `value` still correctly reported as `/ 0.9996`.
 */
export function canonicalAlpha(alpha: number): number {
  return roundTo(alpha, 4);
}

/** Whether `alpha`, canonicalized to `canonicalAlpha`'s precision, counts as opaque. */
export function isCanonicallyOpaque(alpha: number): boolean {
  return canonicalAlpha(alpha) >= 1;
}

/**
 * Whether `alpha` counts as opaque under the CONFIGURED format's own
 * quantization — not always the 4-decimal `canonicalAlpha` boundary.
 * `formatHex` quantizes alpha to a single byte (0-255): an alpha like
 * `0.9996` is < 1 raw AND < 1 at 4-decimal precision, yet
 * `Math.round(0.9996 * 255) === 255`, so `formatHex` emits the byte-opaque
 * `#rrggbb` (no alpha suffix at all) for it. If every OTHER alpha-dependent
 * surface (preview, checkerboard, RGB/HSL copy strings) instead asked
 * `isCanonicallyOpaque` (4-decimal), they'd disagree with the format="hex"
 * emitted value and show it as still translucent. Every caller that must
 * agree with the actual emitted `value` — not just the emitted string
 * itself — needs to ask THIS function with the currently configured
 * `format`, not a single fixed boundary.
 */
export function isOpaqueForFormat(alpha: number, format: ColorOutputFormat): boolean {
  if (format === 'hex') {
    const byte = Math.max(0, Math.min(255, Math.round(alpha * 255)));
    return byte >= 255;
  }
  return isCanonicallyOpaque(alpha);
}

/**
 * Format a canonical RGBA value in the requested CSS Color 4 syntax.
 * `hex` is handled separately by {@link formatHex} for readability, but is
 * accepted here too so callers can dispatch on `format` uniformly.
 */
export function formatColor(parts: RgbaComponents, format: ColorOutputFormat): string {
  if (format === 'hex') return formatHex(parts);

  // Canonicalize alpha BEFORE deciding whether to append the suffix — not
  // the raw `parts.a`. An alpha like 0.99999 is < 1 raw, but rounds to
  // exactly `1` at four decimals; deciding on the raw value would emit
  // `/ 1`, which re-parses as alpha === 1 and drops the suffix on the very
  // next round-trip — the same byte-rounds-to-opaque canonicalization
  // `formatHex` does for hex, applied here at the decimal precision non-hex
  // formats use. Every other caller that independently renders or copies
  // this alpha (e.g. ColorPicker's legacy-syntax copy panel) must go
  // through this same `canonicalAlpha`/`isCanonicallyOpaque` pair, not a
  // differently-rounded or differently-gated one.
  const hasAlpha = !isCanonicallyOpaque(parts.a);
  const alphaSuffix = hasAlpha ? ` / ${canonicalAlpha(parts.a)}` : '';
  const rgbColor = rgbaToRgbColor(parts);

  if (format === 'rgb') {
    const r = Math.round(parts.r);
    const g = Math.round(parts.g);
    const b = Math.round(parts.b);
    return `rgb(${r} ${g} ${b}${alphaSuffix})`;
  }

  if (format === 'hsl') {
    const hsl = toHslConverter(rgbColor);
    const h = roundTo(hsl.h ?? 0, 2);
    const s = roundTo((hsl.s ?? 0) * 100, 2);
    const l = roundTo((hsl.l ?? 0) * 100, 2);
    return `hsl(${h} ${s}% ${l}%${alphaSuffix})`;
  }

  if (format === 'hwb') {
    const hwb = toHwbConverter(rgbColor);
    const h = roundTo(hwb.h ?? 0, 2);
    const w = roundTo((hwb.w ?? 0) * 100, 2);
    const b = roundTo((hwb.b ?? 0) * 100, 2);
    return `hwb(${h} ${w}% ${b}%${alphaSuffix})`;
  }

  // oklch. Lightness at 2 decimals (percentage) / chroma at 4 decimals was
  // not enough precision to round-trip every sRGB byte value — e.g.
  // #00b8c1 emitted oklch(71.19% 0.121 201.02), which parses to a
  // one-byte-off RGB and then re-emits a DIFFERENT chroma (0.1209),
  // rewriting a persisted value with no user interaction. 3 decimals for
  // lightness and 5 for chroma is the precision verified (by an exhaustive
  // sweep over sRGB byte triples, plus the cited #00b8c1 case) to make
  // parse -> emit a fixed point for every sRGB byte value.
  const oklch = toOklchConverter(rgbColor);
  const l = roundTo((oklch.l ?? 0) * 100, 3);
  const c = roundTo(oklch.c ?? 0, 5);
  const h = roundTo(oklch.h ?? 0, 2);
  return `oklch(${l}% ${c} ${h}${alphaSuffix})`;
}

function rgbColorToRgba(rgb: Rgb, alpha: number): RgbaComponents {
  return {
    r: Math.round(Math.max(0, Math.min(1, rgb.r ?? 0)) * 255),
    g: Math.round(Math.max(0, Math.min(1, rgb.g ?? 0)) * 255),
    b: Math.round(Math.max(0, Math.min(1, rgb.b ?? 0)) * 255),
    a: alpha,
  };
}

/** CSS color modes ColorField / ColorPicker accept as *input*. `lab` and every other culori mode (`lch`, `p3`, named colors, …) are rejected. */
const ACCEPTED_PARSE_MODES = new Set(['rgb', 'hsl', 'hwb', 'oklch']);

// Gate on the *syntax* of the input before ever asking culori to resolve it
// to a color mode. culori's generic `parse()` also resolves CSS named colors
// (`red`, `transparent`, `rebeccapurple`, …) and other legacy keywords to
// mode `'rgb'` — checking `parsed.mode` alone would silently let those past
// the documented hex/rgb()/hsl()/hwb()/oklch() function-call allowlist. The
// legacy hand-rolled parser these components used before never recognized
// named colors either (it only matched `#`-prefixed hex and the four
// function-call prefixes below), so rejecting them here matches prior
// behavior rather than inventing a new restriction.
const HEX_SYNTAX_RE = /^#[0-9a-f]{3,8}$/i;
const RGB_SYNTAX_RE = /^rgba?\s*\(/i;
const HSL_SYNTAX_RE = /^hsla?\s*\(/i;
const HWB_SYNTAX_RE = /^hwb\s*\(/i;
const OKLCH_SYNTAX_RE = /^oklch\s*\(/i;

function matchesAcceptedSyntax(trimmed: string): boolean {
  return (
    HEX_SYNTAX_RE.test(trimmed) ||
    RGB_SYNTAX_RE.test(trimmed) ||
    HSL_SYNTAX_RE.test(trimmed) ||
    HWB_SYNTAX_RE.test(trimmed) ||
    OKLCH_SYNTAX_RE.test(trimmed)
  );
}

/**
 * Parse any accepted CSS color string — `hex`, `rgb()`/`rgba()`,
 * `hsl()`/`hsla()`, `hwb()`, or `oklch()`, in either legacy comma syntax or
 * modern space-separated syntax with slash alpha — into canonical sRGB RGBA.
 * Backed by `culori`'s own CSS color parser, so it round-trips whatever
 * `formatColor` emits in any of the five supported formats. Rejects anything
 * outside that syntax allowlist — including CSS named colors and keywords —
 * before ever resolving a color mode (see `matchesAcceptedSyntax`).
 * Out-of-sRGB `oklch()` input is gamut-mapped via CSS Color 4 chroma
 * reduction (hue is preserved by construction — the bisection in `culori`'s
 * `toGamut` only reduces chroma). Returns `null` for anything unparseable,
 * outside the accepted syntax, or outside the accepted modes.
 */
export function parseCssColor(input: string): RgbaComponents | null {
  const trimmed = input.trim();
  if (!matchesAcceptedSyntax(trimmed)) return null;

  const parsed = parse(trimmed);
  if (parsed === undefined || !ACCEPTED_PARSE_MODES.has(parsed.mode)) return null;

  if (parsed.mode === 'oklch') {
    const direct = toRgbConverter(parsed);
    const rgb = isRoundTripArtifact(parsed, direct)
      ? direct
      : toRgbConverter(gamutMapOklchToRgb(parsed));
    return rgbColorToRgba(rgb, parsed.alpha ?? 1);
  }

  const rgb = toRgbConverter(parsed);
  return rgbColorToRgba(rgb, parsed.alpha ?? 1);
}

/**
 * Parse a CSS Color 4 `oklch()` string specifically into canonical sRGB
 * RGBA. Thin wrapper around {@link parseCssColor} that additionally rejects
 * any non-oklch input, for call sites that only want to accept `oklch()`.
 */
export function parseOklch(input: string): RgbaComponents | null {
  const trimmed = input.trim();
  if (!/^oklch\s*\(/i.test(trimmed)) return null;
  return parseCssColor(trimmed);
}
