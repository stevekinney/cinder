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
 * chroma reduction (culori's `toGamut`), never hand-rolled chroma clamping.
 */
import type { Rgb } from 'culori';
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
 * Format a canonical RGBA value in the requested CSS Color 4 syntax.
 * `hex` is handled separately by {@link formatHex} for readability, but is
 * accepted here too so callers can dispatch on `format` uniformly.
 */
export function formatColor(parts: RgbaComponents, format: ColorOutputFormat): string {
  if (format === 'hex') return formatHex(parts);

  // Canonicalize alpha to the SAME precision (4 decimal places) used in the
  // emitted suffix BEFORE deciding whether to append it — not the raw
  // `parts.a`. An alpha like 0.99999 is < 1 raw, but rounds to exactly `1` at
  // four decimals; deciding on the raw value would emit `/ 1`, which
  // re-parses as alpha === 1 and drops the suffix on the very next
  // round-trip — the same byte-rounds-to-opaque canonicalization `formatHex`
  // does for hex, applied here at the decimal precision non-hex formats use.
  const canonicalAlpha = roundTo(parts.a, 4);
  const hasAlpha = canonicalAlpha < 1;
  const alphaSuffix = hasAlpha ? ` / ${canonicalAlpha}` : '';
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

  // oklch
  const oklch = toOklchConverter(rgbColor);
  const l = roundTo((oklch.l ?? 0) * 100, 2);
  const c = roundTo(oklch.c ?? 0, 4);
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
    const mapped = gamutMapOklchToRgb(parsed);
    const rgb = toRgbConverter(mapped);
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
