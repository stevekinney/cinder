/**
 * Shared color output formatting for ColorField and ColorPicker.
 *
 * Both components parse input into plain sRGB (0-255 channels, alpha 0-1)
 * using `parseColor` from `color-luminance.ts`. This module turns that
 * canonical RGBA representation into a CSS color string in one of five
 * output formats (`hex`, `rgb`, `hsl`, `hwb`, `oklch`) per the CIN-104
 * ruling recorded in `docs/decisions/color-value-format.md`.
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
  return parts.a < 1 ? base + toHex2(parts.a * 255) : base;
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

function alphaSuffix(alpha: number): string {
  return ` / ${roundTo(alpha, 4)}`;
}

/**
 * Format a canonical RGBA value in the requested CSS Color 4 syntax.
 * `hex` is handled separately by {@link formatHex} for readability, but is
 * accepted here too so callers can dispatch on `format` uniformly.
 */
export function formatColor(parts: RgbaComponents, format: ColorOutputFormat): string {
  if (format === 'hex') return formatHex(parts);

  const hasAlpha = parts.a < 1;
  const rgbColor = rgbaToRgbColor(parts);

  if (format === 'rgb') {
    const r = Math.round(parts.r);
    const g = Math.round(parts.g);
    const b = Math.round(parts.b);
    return `rgb(${r} ${g} ${b}${hasAlpha ? alphaSuffix(parts.a) : ''})`;
  }

  if (format === 'hsl') {
    const hsl = toHslConverter(rgbColor);
    const h = roundTo(hsl.h ?? 0, 2);
    const s = roundTo((hsl.s ?? 0) * 100, 2);
    const l = roundTo((hsl.l ?? 0) * 100, 2);
    return `hsl(${h} ${s}% ${l}%${hasAlpha ? alphaSuffix(parts.a) : ''})`;
  }

  if (format === 'hwb') {
    const hwb = toHwbConverter(rgbColor);
    const h = roundTo(hwb.h ?? 0, 2);
    const w = roundTo((hwb.w ?? 0) * 100, 2);
    const b = roundTo((hwb.b ?? 0) * 100, 2);
    return `hwb(${h} ${w}% ${b}%${hasAlpha ? alphaSuffix(parts.a) : ''})`;
  }

  // oklch
  const oklch = toOklchConverter(rgbColor);
  const l = roundTo((oklch.l ?? 0) * 100, 2);
  const c = roundTo(oklch.c ?? 0, 4);
  const h = roundTo(oklch.h ?? 0, 2);
  return `oklch(${l}% ${c} ${h}${hasAlpha ? alphaSuffix(parts.a) : ''})`;
}

/**
 * Parse a CSS Color 4 `oklch()` string into canonical sRGB RGBA, gamut-mapping
 * out-of-sRGB values via chroma reduction in OKLCH (hue is preserved by
 * construction — the bisection in `culori`'s `toGamut` only reduces chroma).
 * Returns `null` for anything that isn't a well-formed `oklch()` string.
 */
export function parseOklch(input: string): RgbaComponents | null {
  const parsed = parse(input.trim());
  if (parsed === undefined || parsed.mode !== 'oklch') return null;

  const mapped = gamutMapOklchToRgb(parsed);
  const rgb = toRgbConverter(mapped);
  return {
    r: Math.round(Math.max(0, Math.min(1, rgb.r ?? 0)) * 255),
    g: Math.round(Math.max(0, Math.min(1, rgb.g ?? 0)) * 255),
    b: Math.round(Math.max(0, Math.min(1, rgb.b ?? 0)) * 255),
    a: parsed.alpha ?? 1,
  };
}
