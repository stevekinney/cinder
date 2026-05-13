/**
 * Color parsing and luminance utilities for swatch contrast computation.
 *
 * Supported input formats: `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`,
 * `rgb(r, g, b)`, `rgba(r, g, b, a)`, `hsl(h, s%, l%)`, `hsla(h, s%, l%, a)`.
 * All other CSS color syntaxes are treated as opaque with best-effort `'white'` contrast.
 */

type RgbaComponents = { r: number; g: number; b: number; a: number };

/** Parse a hex, rgb(a), or hsl(a) color string into RGBA components (0–255, alpha 0–1). */
export function parseColor(input: string): RgbaComponents | null {
  const trimmed = input.trim().toLowerCase();

  // Hex formats
  const hexMatch = trimmed.match(/^#([0-9a-f]{3,8})$/);
  if (hexMatch) {
    return parseHex(hexMatch[1]!);
  }

  // rgb / rgba
  const rgbMatch = trimmed.match(/^rgba?\(\s*([^)]+)\)$/);
  if (rgbMatch) {
    return parseRgb(rgbMatch[1]!);
  }

  // hsl / hsla
  const hslMatch = trimmed.match(/^hsla?\(\s*([^)]+)\)$/);
  if (hslMatch) {
    return parseHsl(hslMatch[1]!);
  }

  return null;
}

function parseHex(hex: string): RgbaComponents | null {
  let r: number, g: number, b: number, a: number;

  if (hex.length === 3) {
    r = parseInt((hex[0] ?? '') + (hex[0] ?? ''), 16);
    g = parseInt((hex[1] ?? '') + (hex[1] ?? ''), 16);
    b = parseInt((hex[2] ?? '') + (hex[2] ?? ''), 16);
    a = 1;
  } else if (hex.length === 4) {
    r = parseInt((hex[0] ?? '') + (hex[0] ?? ''), 16);
    g = parseInt((hex[1] ?? '') + (hex[1] ?? ''), 16);
    b = parseInt((hex[2] ?? '') + (hex[2] ?? ''), 16);
    a = parseInt((hex[3] ?? '') + (hex[3] ?? ''), 16) / 255;
  } else if (hex.length === 6) {
    r = parseInt(hex.slice(0, 2), 16);
    g = parseInt(hex.slice(2, 4), 16);
    b = parseInt(hex.slice(4, 6), 16);
    a = 1;
  } else if (hex.length === 8) {
    r = parseInt(hex.slice(0, 2), 16);
    g = parseInt(hex.slice(2, 4), 16);
    b = parseInt(hex.slice(4, 6), 16);
    a = parseInt(hex.slice(6, 8), 16) / 255;
  } else {
    return null;
  }

  return { r, g, b, a };
}

function parseChannelValue(raw: string): number {
  const trimmed = raw.trim();
  if (trimmed.endsWith('%')) {
    return (parseFloat(trimmed) / 100) * 255;
  }
  return parseFloat(trimmed);
}

function parseAlphaValue(raw: string): number {
  const trimmed = raw.trim();
  if (trimmed.endsWith('%')) {
    return parseFloat(trimmed) / 100;
  }
  return parseFloat(trimmed);
}

function parseRgb(inner: string): RgbaComponents | null {
  const parts = inner.split(',').map((p) => p.trim());
  if (parts.length < 3 || parts.length > 4) return null;

  const p0 = parts[0] ?? '';
  const p1 = parts[1] ?? '';
  const p2 = parts[2] ?? '';
  const r = parseChannelValue(p0);
  const g = parseChannelValue(p1);
  const b = parseChannelValue(p2);
  const a = parts.length === 4 ? parseAlphaValue(parts[3] ?? '') : 1;

  if ([r, g, b, a].some(isNaN)) return null;
  return { r, g, b, a };
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  // Wrap hue to [0, 360)
  h = ((h % 360) + 360) % 360;
  // Clamp s and l to [0, 1]
  s = Math.max(0, Math.min(1, s));
  l = Math.max(0, Math.min(1, l));

  if (s === 0) {
    const v = Math.round(l * 255);
    return { r: v, g: v, b: v };
  }

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  let rp = 0,
    gp = 0,
    bp = 0;
  if (h < 60) {
    rp = c;
    gp = x;
    bp = 0;
  } else if (h < 120) {
    rp = x;
    gp = c;
    bp = 0;
  } else if (h < 180) {
    rp = 0;
    gp = c;
    bp = x;
  } else if (h < 240) {
    rp = 0;
    gp = x;
    bp = c;
  } else if (h < 300) {
    rp = x;
    gp = 0;
    bp = c;
  } else {
    rp = c;
    gp = 0;
    bp = x;
  }

  return {
    r: Math.round((rp + m) * 255),
    g: Math.round((gp + m) * 255),
    b: Math.round((bp + m) * 255),
  };
}

function parseHsl(inner: string): RgbaComponents | null {
  const parts = inner.split(',').map((p) => p.trim());
  if (parts.length < 3 || parts.length > 4) return null;

  const p0 = parts[0] ?? '';
  const p1 = parts[1] ?? '';
  const p2 = parts[2] ?? '';
  const h = parseFloat(p0); // unitless degrees
  const sPct = p1.endsWith('%') ? parseFloat(p1) : NaN;
  const lPct = p2.endsWith('%') ? parseFloat(p2) : NaN;
  const a = parts.length === 4 ? parseAlphaValue(parts[3] ?? '') : 1;

  if ([h, sPct, lPct, a].some(isNaN)) return null;

  const { r, g, b } = hslToRgb(h, sPct / 100, lPct / 100);
  return { r, g, b, a };
}

/**
 * Return true when the color has a non-opaque alpha channel.
 * Supports: `#rgba`, `#rrggbbaa`, `rgba(...)`, `hsla(...)`.
 * Any unsupported format returns false (treated as opaque).
 */
export function hasAlpha(input: string): boolean {
  const parsed = parseColor(input);
  if (!parsed) return false;
  return parsed.a < 1;
}

/** Linearize a single sRGB channel (0–255) per WCAG 2.x. */
function linearize(channel: number): number {
  const cs = channel / 255;
  return cs <= 0.04045 ? cs / 12.92 : ((cs + 0.055) / 1.055) ** 2.4;
}

/**
 * Compute WCAG 2.x relative luminance from an RGB triple (channels 0–255).
 * https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 */
export function relativeLuminance({ r, g, b }: { r: number; g: number; b: number }): number {
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

/**
 * Return `'black'` or `'white'` — whichever has higher WCAG contrast ratio against
 * the given color. Falls back to `'white'` when the color cannot be parsed.
 *
 * Alpha is ignored: the indicator color is chosen against the swatch's intended
 * solid color, not its composite with whatever surface sits behind it.
 */
export function pickContrastColor(input: string): 'black' | 'white' {
  const parsed = parseColor(input);
  if (!parsed) return 'white';

  const L = relativeLuminance(parsed);
  // WCAG contrast ratio against black (L2=0) and white (L2=1)
  const contrastBlack = (L + 0.05) / 0.05;
  const contrastWhite = 1.05 / (L + 0.05);
  return contrastBlack >= contrastWhite ? 'black' : 'white';
}
