/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { hasAlpha, parseColor, pickContrastColor, relativeLuminance } from './color-luminance.ts';

describe('parseColor', () => {
  describe('hex formats', () => {
    test('#rgb expands to full RGB', () => {
      expect(parseColor('#f00')).toEqual({ r: 255, g: 0, b: 0, a: 1 });
      expect(parseColor('#fff')).toEqual({ r: 255, g: 255, b: 255, a: 1 });
      expect(parseColor('#000')).toEqual({ r: 0, g: 0, b: 0, a: 1 });
    });

    test('#rgba expands to full RGBA', () => {
      const result = parseColor('#f00f');
      expect(result).not.toBeNull();
      expect(result?.r).toBe(255);
      expect(result?.g).toBe(0);
      expect(result?.b).toBe(0);
      expect(result?.a).toBeCloseTo(1, 1);
    });

    test('#rgba with partial alpha', () => {
      const result = parseColor('#ff00008');
      expect(result).toBeNull(); // 7 hex digits — invalid
    });

    test('#rrggbb parses correctly', () => {
      expect(parseColor('#ff0000')).toEqual({ r: 255, g: 0, b: 0, a: 1 });
      expect(parseColor('#ffffff')).toEqual({ r: 255, g: 255, b: 255, a: 1 });
      expect(parseColor('#000000')).toEqual({ r: 0, g: 0, b: 0, a: 1 });
      expect(parseColor('#336699')).toEqual({ r: 51, g: 102, b: 153, a: 1 });
    });

    test('#rrggbbaa with ff alpha is opaque', () => {
      const result = parseColor('#ff0000ff');
      expect(result).not.toBeNull();
      expect(result?.a).toBe(1);
    });

    test('#rrggbbaa with partial alpha', () => {
      const result = parseColor('#ff000080');
      expect(result).not.toBeNull();
      expect(result?.r).toBe(255);
      expect(result?.g).toBe(0);
      expect(result?.b).toBe(0);
      expect(result?.a).toBeCloseTo(0.502, 2);
    });

    test('case insensitive', () => {
      expect(parseColor('#FF0000')).toEqual({ r: 255, g: 0, b: 0, a: 1 });
      expect(parseColor('#FF0000FF')).toEqual(parseColor('#ff0000ff'));
    });
  });

  describe('rgb/rgba', () => {
    test('rgb with integer channels', () => {
      expect(parseColor('rgb(255, 0, 0)')).toEqual({ r: 255, g: 0, b: 0, a: 1 });
      expect(parseColor('rgb(0, 0, 0)')).toEqual({ r: 0, g: 0, b: 0, a: 1 });
    });

    test('rgba with alpha 0–1', () => {
      const result = parseColor('rgba(255, 0, 0, 0.5)');
      expect(result?.r).toBe(255);
      expect(result?.a).toBe(0.5);
    });

    test('rgba with alpha 0 is fully transparent', () => {
      const result = parseColor('rgba(255, 0, 0, 0)');
      expect(result?.a).toBe(0);
    });

    test('rgba with alpha = 1 is opaque', () => {
      const result = parseColor('rgba(255, 0, 0, 1)');
      expect(result?.a).toBe(1);
    });

    test('rgba with percentage alpha', () => {
      const result = parseColor('rgba(255, 0, 0, 50%)');
      expect(result?.a).toBe(0.5);
    });

    test('rgb with percentage channels', () => {
      const result = parseColor('rgb(100%, 0%, 0%)');
      expect(result?.r).toBeCloseTo(255, 0);
      expect(result?.g).toBe(0);
    });

    test('percentage channel near breakpoint (0.04045 linearization)', () => {
      // ~10.42 out of 255 = 4.09% which is just above 0.04045 breakpoint
      const result = parseColor('rgb(10.53%, 0%, 0%)');
      expect(result).not.toBeNull();
      expect(result!.r).toBeCloseTo(26.85, 0);
    });

    test('whitespace is tolerated', () => {
      expect(parseColor('rgb( 255 , 0 , 0 )')).toEqual({ r: 255, g: 0, b: 0, a: 1 });
    });
  });

  describe('hsl/hsla', () => {
    test('pure red hsl(0, 100%, 50%)', () => {
      const result = parseColor('hsl(0, 100%, 50%)');
      expect(result?.r).toBe(255);
      expect(result?.g).toBe(0);
      expect(result?.b).toBe(0);
      expect(result?.a).toBe(1);
    });

    test('hsl hue sectors map to expected primary and secondary colors', () => {
      expect(parseColor('hsl(60, 100%, 50%)')).toMatchObject({ r: 255, g: 255, b: 0 });
      expect(parseColor('hsl(120, 100%, 50%)')).toMatchObject({ r: 0, g: 255, b: 0 });
      expect(parseColor('hsl(180, 100%, 50%)')).toMatchObject({ r: 0, g: 255, b: 255 });
      expect(parseColor('hsl(240, 100%, 50%)')).toMatchObject({ r: 0, g: 0, b: 255 });
      expect(parseColor('hsl(300, 100%, 50%)')).toMatchObject({ r: 255, g: 0, b: 255 });
    });

    test('pure white hsl(0, 0%, 100%)', () => {
      const result = parseColor('hsl(0, 0%, 100%)');
      expect(result?.r).toBe(255);
      expect(result?.g).toBe(255);
      expect(result?.b).toBe(255);
    });

    test('pure black hsl(0, 0%, 0%)', () => {
      const result = parseColor('hsl(0, 0%, 0%)');
      expect(result?.r).toBe(0);
      expect(result?.g).toBe(0);
      expect(result?.b).toBe(0);
    });

    test('mid grey hsl(0, 0%, 50%)', () => {
      const result = parseColor('hsl(0, 0%, 50%)');
      expect(result?.r).toBeCloseTo(128, 0);
      expect(result?.g).toBeCloseTo(128, 0);
      expect(result?.b).toBeCloseTo(128, 0);
    });

    test('hue wrap hsl(720, 100%, 50%) is red', () => {
      const result = parseColor('hsl(720, 100%, 50%)');
      expect(result?.r).toBe(255);
      expect(result?.g).toBe(0);
      expect(result?.b).toBe(0);
    });

    test('hsla with alpha', () => {
      const result = parseColor('hsla(0, 100%, 50%, 0.5)');
      expect(result?.a).toBe(0.5);
    });
  });

  describe('unsupported formats', () => {
    test('returns null for named colors', () => {
      expect(parseColor('red')).toBeNull();
      expect(parseColor('white')).toBeNull();
    });

    test('returns null for oklch', () => {
      expect(parseColor('oklch(50% 0.2 120)')).toBeNull();
    });

    test('returns null for modern space-separated rgb', () => {
      expect(parseColor('rgb(255 0 0)')).toBeNull();
    });

    test('returns null for empty string', () => {
      expect(parseColor('')).toBeNull();
    });
  });
});

describe('hasAlpha', () => {
  test('opaque #rrggbb → false', () => {
    expect(hasAlpha('#ff0000')).toBe(false);
  });

  test('opaque #rrggbbff → false', () => {
    expect(hasAlpha('#ff0000ff')).toBe(false);
  });

  test('alpha #rrggbbaa → true', () => {
    expect(hasAlpha('#ff000080')).toBe(true);
  });

  test('opaque #rgb → false', () => {
    expect(hasAlpha('#f00')).toBe(false);
  });

  test('full-alpha #rgba → false', () => {
    expect(hasAlpha('#f00f')).toBe(false);
  });

  test('partial-alpha #rgba → true', () => {
    expect(hasAlpha('#f008')).toBe(true);
  });

  test('opaque rgb() → false', () => {
    expect(hasAlpha('rgb(255, 0, 0)')).toBe(false);
  });

  test('opaque rgba(255,0,0,1) → false', () => {
    expect(hasAlpha('rgba(255, 0, 0, 1)')).toBe(false);
  });

  test('semi-transparent rgba → true', () => {
    expect(hasAlpha('rgba(255, 0, 0, 0.5)')).toBe(true);
  });

  test('fully transparent rgba → true', () => {
    expect(hasAlpha('rgba(255, 0, 0, 0)')).toBe(true);
  });

  test('opaque hsl → false', () => {
    expect(hasAlpha('hsl(0, 100%, 50%)')).toBe(false);
  });

  test('semi-transparent hsla → true', () => {
    expect(hasAlpha('hsla(0, 100%, 50%, 0.5)')).toBe(true);
  });

  test('unsupported format → false (opaque fallback)', () => {
    expect(hasAlpha('red')).toBe(false);
    expect(hasAlpha('oklch(50% 0.2 120)')).toBe(false);
  });
});

describe('relativeLuminance', () => {
  test('black = 0', () => {
    expect(relativeLuminance({ r: 0, g: 0, b: 0 })).toBe(0);
  });

  test('white = 1', () => {
    expect(relativeLuminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1, 4);
  });

  test('mid-grey is between 0 and 1', () => {
    const L = relativeLuminance({ r: 128, g: 128, b: 128 });
    expect(L).toBeGreaterThan(0);
    expect(L).toBeLessThan(1);
  });

  test('pure red luminance matches WCAG formula', () => {
    // red channel only: 0.2126 * linearize(255)
    const L = relativeLuminance({ r: 255, g: 0, b: 0 });
    expect(L).toBeCloseTo(0.2126, 4);
  });
});

describe('pickContrastColor', () => {
  test('white swatch → black indicator', () => {
    expect(pickContrastColor('#ffffff')).toBe('black');
  });

  test('black swatch → white indicator', () => {
    expect(pickContrastColor('#000000')).toBe('white');
  });

  test('mid-grey (#808080) → black indicator (L ≈ 0.216, above crossover)', () => {
    expect(pickContrastColor('#808080')).toBe('black');
  });

  test('dark grey (#333333) → white indicator (L below crossover)', () => {
    expect(pickContrastColor('#333333')).toBe('white');
  });

  test('near-crossover light value → black', () => {
    // L ≈ 0.179 is the crossover; slightly above should pick black
    // #777777 has L ≈ 0.184
    expect(pickContrastColor('#777777')).toBe('black');
  });

  test('near-crossover dark value → white', () => {
    // #666666 has L ≈ 0.133, well below the 0.179 crossover
    expect(pickContrastColor('#666666')).toBe('white');
  });

  test('pure red → black (L=0.2126, above crossover 0.179)', () => {
    // Pure red: L = 0.2126 * 1.0 = 0.2126 which is above 0.179 crossover
    expect(pickContrastColor('#ff0000')).toBe('black');
  });

  test('yellow → black (high luminance)', () => {
    expect(pickContrastColor('#ffff00')).toBe('black');
  });

  test('unsupported format falls back to white', () => {
    expect(pickContrastColor('red')).toBe('white');
    expect(pickContrastColor('oklch(50% 0.2 120)')).toBe('white');
  });

  test('rgb() format works', () => {
    expect(pickContrastColor('rgb(255, 255, 255)')).toBe('black');
    expect(pickContrastColor('rgb(0, 0, 0)')).toBe('white');
  });

  test('hsl() format works', () => {
    expect(pickContrastColor('hsl(0, 0%, 100%)')).toBe('black');
    expect(pickContrastColor('hsl(0, 0%, 0%)')).toBe('white');
  });
});
