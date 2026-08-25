import { describe, expect, test } from 'bun:test';
import { converter, parse } from 'culori';

import {
  canonicalAlpha,
  formatColor,
  formatHex,
  isCanonicallyOpaque,
  parseCssColor,
  parseOklch,
  type RgbaComponents,
} from './color-format.ts';
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

  // Review thread #2 (PR #1420): alpha 0.999 rounds to the 0xff byte, which
  // must canonicalize to plain #rrggbb — otherwise it re-parses as alpha
  // === 1 and the very next round-trip flips syntax (translucent in, opaque
  // out, on the SAME logical value).
  test('rounds a byte-for-byte-opaque alpha (0.999) down to plain #rrggbb', () => {
    expect(formatHex({ r: 255, g: 0, b: 0, a: 0.999 })).toBe('#ff0000');
  });

  test('does not canonicalize an alpha that genuinely rounds below 0xff', () => {
    expect(formatHex({ r: 255, g: 0, b: 0, a: 0.997 })).toBe('#ff0000fe');
  });

  test('boundary is idempotent: re-parsing the canonicalized hex re-emits the same string', () => {
    const once = formatHex({ r: 255, g: 0, b: 0, a: 0.999 });
    const reparsed = parseCssColor(once);
    expect(reparsed).not.toBeNull();
    expect(formatHex(reparsed!)).toBe(once);
  });
});

// Review thread (PR #1420): "Preserve fractional alpha in copy payloads".
// canonicalAlpha/isCanonicallyOpaque are the single shared boundary every
// caller (formatColor's own suffix decision, and ColorPicker's copy-panel
// strings) must use — a caller that rounds to a different precision or
// gates on the raw alpha can disagree with formatColor about whether the
// SAME value is translucent.
describe('canonicalAlpha / isCanonicallyOpaque (the shared 0.9995–1 boundary)', () => {
  test('0.9996 canonicalizes to itself and is NOT opaque', () => {
    expect(canonicalAlpha(0.9996)).toBe(0.9996);
    expect(isCanonicallyOpaque(0.9996)).toBe(false);
  });

  test('0.99999 canonicalizes to 1 and IS opaque', () => {
    expect(canonicalAlpha(0.99999)).toBe(1);
    expect(isCanonicallyOpaque(0.99999)).toBe(true);
  });

  test('a sweep across the 0.9995–1 band matches formatColor’s own opacity decision', () => {
    for (const a of [0.9994, 0.9995, 0.9996, 0.9997, 0.9998, 0.9999, 0.99994, 0.99996, 1]) {
      const seed: RgbaComponents = { r: 10, g: 20, b: 30, a };
      const emittedHasSlash = formatColor(seed, 'rgb').includes('/');
      expect(emittedHasSlash).toBe(!isCanonicallyOpaque(a));
    }
  });
});

describe('parseCssColor syntax allowlist (review thread #5)', () => {
  // culori's own `parse()` resolves CSS named colors and keywords to mode
  // 'rgb', which would silently bypass the documented
  // hex/rgb()/hsl()/hwb()/oklch() function-call allowlist if we only
  // checked the resulting mode. The pre-change legacy parser (`parseColor`
  // in color-luminance.ts) never recognized named colors either — it only
  // matched `#`-prefixed hex and the four function-call prefixes — so
  // rejecting them here matches prior behavior, not a new restriction.
  test('rejects CSS named colors', () => {
    expect(parseCssColor('red')).toBeNull();
    expect(parseCssColor('rebeccapurple')).toBeNull();
    expect(parseCssColor('transparent')).toBeNull();
  });

  test('rejects other culori-parseable but non-allowlisted syntax', () => {
    expect(parseCssColor('lab(50% 40 59.5)')).toBeNull();
    expect(parseCssColor('lch(50% 40 59.5)')).toBeNull();
    expect(parseCssColor('color(srgb 1 0 0)')).toBeNull();
  });

  test('still accepts every documented function-call syntax', () => {
    expect(parseCssColor('#ff0000')).not.toBeNull();
    expect(parseCssColor('rgb(255, 0, 0)')).not.toBeNull();
    expect(parseCssColor('rgb(255 0 0)')).not.toBeNull();
    expect(parseCssColor('hsl(0, 100%, 50%)')).not.toBeNull();
    expect(parseCssColor('hwb(0 0% 0%)')).not.toBeNull();
    expect(parseCssColor('oklch(62.8% 0.258 29.23)')).not.toBeNull();
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

    // Review thread (PR #1420, PRRT_kwDOSKrFTs6b3k23): an alpha close enough
    // to 1 to round to `1` at four decimals (0.99999) still had `hasAlpha`
    // computed from the RAW alpha, so it appended `/ 1` — which re-parses as
    // alpha exactly 1 and drops the suffix on the very next round-trip,
    // breaking documented idempotence. Alpha must be canonicalized to the
    // same precision BEFORE deciding whether to append the suffix.
    test(`${format}: canonicalizes an alpha that rounds to 1 at four decimals to plain opaque syntax`, () => {
      const nearlyOpaque: RgbaComponents = { ...opaque, a: 0.99999 };
      expect(formatColor(nearlyOpaque, format)).not.toContain('/');
    });

    test(`${format}: does not canonicalize an alpha that genuinely rounds below 1`, () => {
      const genuinelyTranslucent: RgbaComponents = { ...opaque, a: 0.9994 };
      expect(formatColor(genuinelyTranslucent, format)).toMatch(/\/\s*0\.9994/);
    });

    test(`${format}: the 0.99999 boundary is idempotent across a full round-trip`, () => {
      const nearlyOpaque: RgbaComponents = { ...opaque, a: 0.99999 };
      const once = formatColor(nearlyOpaque, format);
      const parsedOnce = parseCssColor(once);
      expect(parsedOnce).not.toBeNull();
      const twice = formatColor(parsedOnce!, format);
      expect(twice).toBe(once);
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

describe('oklch emission precision preserves byte-exact round-trips', () => {
  // Review thread (PR #1420, PRRT_kwDOSKrFTs6b4Ull): oklch(l% c h) at 2
  // decimals of lightness / 4 decimals of chroma wasn't enough precision to
  // round-trip every sRGB byte value. #00b8c1 (0, 184, 193) emitted
  // oklch(71.19% 0.121 201.02); parsing that back produced RGB (1, 184,
  // 193) — one byte off — which then re-emitted a DIFFERENT chroma
  // (0.1209), rewriting a persisted value with no user interaction and
  // violating the documented parse -> emit idempotence guarantee.
  test('#00b8c1 (the cited byte-boundary case) parses back to the exact same RGB byte triple', () => {
    const seed: RgbaComponents = { r: 0, g: 184, b: 193, a: 1 };
    const emitted = formatColor(seed, 'oklch');
    const parsed = parseCssColor(emitted);
    expect(parsed).not.toBeNull();
    expect(parsed).toEqual(seed);
    // And re-emitting from the reparsed value is byte-for-byte identical —
    // no drift on a second round-trip.
    expect(formatColor(parsed!, 'oklch')).toBe(emitted);
  });

  test('a sweep of sRGB byte triples all round-trip to the exact same bytes', () => {
    let failures = 0;
    for (let r = 0; r <= 255; r += 5) {
      for (let g = 0; g <= 255; g += 17) {
        for (let b = 0; b <= 255; b += 29) {
          const seed: RgbaComponents = { r, g, b, a: 1 };
          const emitted = formatColor(seed, 'oklch');
          const parsed = parseCssColor(emitted);
          if (parsed === null || parsed.r !== r || parsed.g !== g || parsed.b !== b) {
            failures++;
          }
        }
      }
    }
    expect(failures).toBe(0);
  });
});
