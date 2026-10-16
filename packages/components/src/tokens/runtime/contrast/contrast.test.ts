import { describe, expect, it } from 'bun:test';

import { evaluateCssColor } from './css-color.ts';
import { measurePairing } from './measure.ts';
import type { ContrastPairing } from './pairings.ts';
import {
  AA_TEXT,
  NON_TEXT,
  classifyText,
  isLargeText,
  meetsContrast,
  requiredContrast,
} from './thresholds.ts';

const pairing = (overrides: Partial<ContrastPairing> = {}): ContrastPairing => ({
  id: 'test',
  group: 'text',
  classification: 'text',
  scope: 'wcag',
  criterion: '1.4.3',
  foreground: '--fg',
  background: '--bg',
  description: 'test',
  ...overrides,
});
const light = { theme: 'light' } as const;

describe('thresholds are compared unrounded', () => {
  it('fails 4.499 against 4.5 and passes 4.5', () => {
    expect(meetsContrast(4.499, AA_TEXT)).toBe(false);
    expect(meetsContrast(4.4999999, AA_TEXT)).toBe(false);
    expect(meetsContrast(4.5, AA_TEXT)).toBe(true);
  });

  it('fails 2.999 against 3 and passes 3', () => {
    expect(meetsContrast(2.999, NON_TEXT)).toBe(false);
    expect(meetsContrast(3, NON_TEXT)).toBe(true);
  });

  it('maps classifications to the normative floor and exempts decorative and disabled', () => {
    expect(requiredContrast('text')).toBe(4.5);
    expect(requiredContrast('large-text')).toBe(3);
    expect(requiredContrast('non-text-indicator')).toBe(3);
    expect(requiredContrast('decorative-separator')).toBeNull();
    expect(requiredContrast('disabled')).toBeNull();
  });

  it('moves the large-text boundary at 24px, and at 18.6667px only when bold', () => {
    expect(isLargeText({ fontSizePx: 23.99, fontWeight: 400 })).toBe(false);
    expect(isLargeText({ fontSizePx: 24, fontWeight: 400 })).toBe(true);
    expect(isLargeText({ fontSizePx: 18.6667, fontWeight: 700 })).toBe(true);
    expect(isLargeText({ fontSizePx: 18.6666, fontWeight: 700 })).toBe(false);
    expect(isLargeText({ fontSizePx: 18.6667, fontWeight: 699 })).toBe(false);
    expect(isLargeText({ fontSizePx: 20, fontWeight: 400 })).toBe(false);
    expect(classifyText(undefined)).toBe('text');
    expect(classifyText({ fontSizePx: Number.NaN, fontWeight: 700 })).toBe('text');
  });
});

describe('CSS color evaluation', () => {
  const properties = {
    '--ink': 'oklch(20% 0.1 250)',
    '--paper': 'oklch(98% 0 0)',
    '--alias': 'var(--ink)',
    '--mix': 'color-mix(in oklch, var(--ink), transparent 52%)',
    '--relative': 'oklch(from var(--ink) calc(l - 0.1) min(c, 0.05) h)',
    '--pair': 'light-dark(oklch(10% 0 0), oklch(90% 0 0))',
  };

  it('follows var() aliases and keeps the literal value', () => {
    const result = evaluateCssColor('var(--alias)', properties, light);
    expect(result.ok && result.color.l).toBeCloseTo(0.2, 6);
  });

  it('reads a transparent mix as the ink at the remaining alpha', () => {
    const result = evaluateCssColor('var(--mix)', properties, light);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.color.alpha).toBeCloseTo(0.48, 6);
      expect(result.color.l).toBeCloseTo(0.2, 6);
    }
  });

  it('evaluates relative colors and light-dark()', () => {
    const relative = evaluateCssColor('var(--relative)', properties, light);
    expect(relative.ok && relative.color.l).toBeCloseTo(0.1, 6);
    expect(relative.ok && relative.color.c).toBeCloseTo(0.05, 6);
    const dark = evaluateCssColor('var(--pair)', properties, { theme: 'dark' });
    expect(dark.ok && dark.color.l).toBeCloseTo(0.9, 6);
  });

  it('refuses what it cannot evaluate instead of guessing', () => {
    const code = (value: string) => {
      const result = evaluateCssColor(value, properties, light);
      return result.ok ? 'ok' : result.code;
    };
    expect(code('linear-gradient(red, blue)')).toBe('gradient-or-image');
    expect(code('url(a.png)')).toBe('gradient-or-image');
    expect(code('var(--missing)')).toBe('missing-property');
    expect(code('color-mix(in srgb, red, blue)')).toBe('unsupported-syntax');
    expect(code('oklch(from var(--ink) l c h / banana)')).toBe('unsupported-syntax');
    expect(code('not a color')).toBe('unsupported-syntax');
    expect(evaluateCssColor('var(--a)', { '--a': 'var(--a)' }, light)).toMatchObject({
      ok: false,
      code: 'reference-cycle',
    });
  });
});

describe('pairing measurement', () => {
  it('measures black on white at 21:1', () => {
    const result = measurePairing(pairing(), { '--fg': '#000', '--bg': '#fff' }, light);
    expect(result.status === 'measured' && result.ratio).toBeCloseTo(21, 6);
  });

  it('composites a translucent foreground over the background in gamma space', () => {
    const solid = measurePairing(pairing(), { '--fg': '#000', '--bg': '#fff' }, light);
    const half = measurePairing(
      pairing(),
      { '--fg': 'oklch(0% 0 0 / 0.5)', '--bg': '#fff' },
      light,
    );
    expect(solid.status === 'measured' && half.status === 'measured').toBe(true);
    if (solid.status === 'measured' && half.status === 'measured') {
      // 50% black over white is sRGB 0.5 (not linear 0.5): about 3.95:1.
      expect(half.ratio).toBeLessThan(solid.ratio);
      expect(half.ratio).toBeCloseTo(3.95, 1);
    }
  });

  it('stacks a transparent foreground to ratio 1 and a translucent background over its backdrop', () => {
    const invisible = measurePairing(pairing(), { '--fg': 'transparent', '--bg': '#fff' }, light);
    expect(invisible.status === 'measured' && invisible.ratio).toBeCloseTo(1, 6);
    const stacked = measurePairing(
      pairing({ backdrop: '--base' }),
      { '--fg': '#000', '--bg': 'oklch(100% 0 0 / 0.5)', '--base': '#000' },
      light,
    );
    // White at 50% over black is mid grey, so black text on it is far below 21:1.
    expect(stacked.status === 'measured' && stacked.ratio).toBeLessThan(6);
  });

  it('reports Needs review, never a ratio, for unknown backgrounds and unsupported values', () => {
    const noBackdrop = measurePairing(
      pairing(),
      { '--fg': '#000', '--bg': 'oklch(100% 0 0 / 0.5)' },
      light,
    );
    expect(noBackdrop).toMatchObject({ status: 'needs-review', code: 'unknown-background' });
    const gradient = measurePairing(
      pairing(),
      { '--fg': '#000', '--bg': 'linear-gradient(white, black)' },
      light,
    );
    expect(gradient).toMatchObject({ status: 'needs-review', code: 'gradient-or-image' });
    const missing = measurePairing(pairing(), { '--fg': '#000' }, light);
    expect(missing).toMatchObject({ status: 'needs-review', code: 'missing-property' });
    const badOpacity = measurePairing(
      pairing({ opacity: '--o' }),
      { '--fg': '#000', '--bg': '#fff', '--o': 'wide' },
      light,
    );
    expect(badOpacity).toMatchObject({ status: 'needs-review', code: 'invalid-opacity' });
  });
});

describe('CSS color evaluation edge cases', () => {
  const properties = { '--ink': 'oklch(20% 0.1 250)' };
  const evaluateRelative = (channels: string) =>
    evaluateCssColor(`oklch(from var(--ink) ${channels})`, properties, light);
  const code = (value: string) => {
    const result = evaluateCssColor(value, properties, light);
    return result.ok ? 'ok' : result.code;
  };

  it('evaluates unary minus, multiplication and division in channel expressions', () => {
    const negated = evaluateRelative('calc(0.5 + -l) c h');
    expect(negated.ok && negated.color.l).toBeCloseTo(0.3, 6);
    const scaled = evaluateRelative('calc(l * 2) calc(c / 2) h');
    expect(scaled.ok && scaled.color.l).toBeCloseTo(0.4, 6);
    expect(scaled.ok && scaled.color.c).toBeCloseTo(0.05, 6);
  });

  it('rejects channel expressions with a dangling operand or a unary minus with no operand', () => {
    expect(code('oklch(from var(--ink) calc(l * banana) c h)')).toBe('unsupported-syntax');
    expect(code('oklch(from var(--ink) calc(-) c h)')).toBe('unsupported-syntax');
  });

  it('reads percentages as lightness and chroma fractions but not as a hue', () => {
    const percent = evaluateRelative('50% 50% h');
    expect(percent.ok && percent.color.l).toBeCloseTo(0.5, 6);
    expect(percent.ok && percent.color.c).toBeCloseTo(0.2, 6);
    expect(code('oklch(from var(--ink) l c 50%)')).toBe('unsupported-syntax');
  });

  it('refuses relative colors without exactly three channels', () => {
    expect(code('oklch(from var(--ink) l c)')).toBe('unsupported-syntax');
  });

  it('refuses a light-dark() that does not take exactly two colors', () => {
    expect(code('light-dark(red)')).toBe('unsupported-syntax');
  });

  it('refuses a color-mix() whose percentage sits between its words', () => {
    expect(code('color-mix(in oklch, red 10% blue, blue)')).toBe('unsupported-syntax');
  });

  it('mixes two colors evenly when neither names a percentage', () => {
    const result = evaluateCssColor(
      'color-mix(in oklch, oklch(20% 0 0), oklch(60% 0 0))',
      properties,
      light,
    );
    expect(result.ok && result.color.l).toBeCloseTo(0.4, 6);
  });

  it('refuses unsupported syntax that is not a whole var(), calc() or color-mix() call', () => {
    expect(code('1px var(--ink)')).toBe('unsupported-syntax');
    expect(code('rgb(from red r g b)')).toBe('unsupported-syntax');
  });
});

describe('pairing measurement edge cases', () => {
  it('reports Needs review when the backdrop is itself translucent or unresolved', () => {
    const translucent = measurePairing(
      pairing({ backdrop: '--base' }),
      { '--fg': '#000', '--bg': 'oklch(100% 0 0 / 0.5)', '--base': 'oklch(0% 0 0 / 0.5)' },
      light,
    );
    expect(translucent).toMatchObject({ status: 'needs-review', code: 'unknown-background' });
    const missing = measurePairing(
      pairing({ backdrop: '--base' }),
      { '--fg': '#000', '--bg': 'oklch(100% 0 0 / 0.5)' },
      light,
    );
    expect(missing).toMatchObject({ status: 'needs-review', code: 'missing-property' });
  });

  it('reports Needs review when the named opacity property is absent', () => {
    const result = measurePairing(
      pairing({ opacity: '--o' }),
      { '--fg': '#000', '--bg': '#fff' },
      light,
    );
    expect(result).toMatchObject({ status: 'needs-review', code: 'unknown-opacity' });
  });
});
