import { describe, expect, test } from 'bun:test';
import { converter, parse } from 'culori';

import { formatColor, formatHex, parseOklch, type RgbaComponents } from './color-format.ts';
import { parseColor } from './color-luminance.ts';

const FORMATS = ['hex', 'rgb', 'hsl', 'hwb', 'oklch'] as const;
const toRgb = converter('rgb');

// Reparse via culori's own CSS parser (which understands the modern
// space-separated syntax `formatColor` emits), not the legacy comma-syntax
// `parseColor` used by the component's *input* pipeline.
function reparse(format: (typeof FORMATS)[number], text: string): RgbaComponents {
  if (format === 'hex') {
    const parsed = parseColor(text);
    expect(parsed).not.toBeNull();
    return parsed!;
  }
  if (format === 'oklch') {
    const parsed = parseOklch(text);
    expect(parsed).not.toBeNull();
    return parsed!;
  }
  const parsed = parse(text);
  expect(parsed).not.toBeUndefined();
  const rgb = toRgb(parsed!);
  return {
    r: Math.round(Math.max(0, Math.min(1, rgb.r ?? 0)) * 255),
    g: Math.round(Math.max(0, Math.min(1, rgb.g ?? 0)) * 255),
    b: Math.round(Math.max(0, Math.min(1, rgb.b ?? 0)) * 255),
    a: parsed!.alpha ?? 1,
  };
}

describe('formatHex', () => {
  test('emits plain #rrggbb when alpha is exactly 1', () => {
    expect(formatHex({ r: 255, g: 0, b: 0, a: 1 })).toBe('#ff0000');
  });

  test('emits #rrggbbaa when alpha < 1, never dropping it', () => {
    expect(formatHex({ r: 255, g: 0, b: 0, a: 0.5 })).toBe('#ff000080');
  });
});

describe('formatColor alpha policy for non-hex formats', () => {
  const opaque: RgbaComponents = { r: 51, g: 102, b: 204, a: 1 };
  const translucent: RgbaComponents = { r: 51, g: 102, b: 204, a: 0.4 };

  for (const format of ['rgb', 'hsl', 'hwb', 'oklch'] as const) {
    test(`${format}: omits the / a segment entirely when alpha === 1`, () => {
      expect(formatColor(opaque, format)).not.toContain('/');
    });

    test(`${format}: includes a slash alpha segment when alpha < 1`, () => {
      expect(formatColor(translucent, format)).toMatch(/\/\s*0\.4/);
    });
  }
});

describe('gamut mapping preserves hue within 2 degrees', () => {
  test('a saturated out-of-gamut oklch input maps into sRGB without rotating hue', () => {
    // High chroma at a mid lightness is out of sRGB gamut for most hues.
    const input = 'oklch(70% 0.4 30)';
    const mapped = parseOklch(input);
    expect(mapped).not.toBeNull();

    const remapped = formatColor(mapped!, 'oklch');
    const hueMatch = remapped.match(/oklch\([^)]*?\s+[^\s]+\s+([+-]?[\d.]+)/);
    expect(hueMatch).not.toBeNull();
    const outputHue = parseFloat(hueMatch![1]!);

    const hueDelta = Math.abs(((outputHue - 30 + 540) % 360) - 180);
    expect(hueDelta).toBeLessThanOrEqual(2);
  });
});

describe('round-trip stability', () => {
  for (const format of FORMATS) {
    test(`${format}: parsing then re-emitting is idempotent`, () => {
      const seed: RgbaComponents = { r: 51, g: 187, b: 102, a: 1 };
      const once = format === 'hex' ? formatHex(seed) : formatColor(seed, format);
      const parsedOnce = reparse(format, once);
      const twice = format === 'hex' ? formatHex(parsedOnce) : formatColor(parsedOnce, format);
      const parsedTwice = reparse(format, twice);
      const thrice = format === 'hex' ? formatHex(parsedTwice) : formatColor(parsedTwice, format);

      expect(twice).toBe(thrice);
    });

    test(`${format}: idempotent with partial alpha too`, () => {
      const seed: RgbaComponents = { r: 200, g: 20, b: 90, a: 0.6 };
      const once = format === 'hex' ? formatHex(seed) : formatColor(seed, format);
      const parsedOnce = reparse(format, once);
      const twice = format === 'hex' ? formatHex(parsedOnce) : formatColor(parsedOnce, format);
      const parsedTwice = reparse(format, twice);
      const thrice = format === 'hex' ? formatHex(parsedTwice) : formatColor(parsedTwice, format);

      expect(twice).toBe(thrice);
    });
  }
});
