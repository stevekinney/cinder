import { describe, expect, it } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readCssPropertyToPath, readJsonRecord } from './token-contrast-test-readers.ts';

import * as values from './check-token-contrast-test-values.ts';
type Lab = values.Lab;

const {
  ciede2000,
  css,
  cssPropertyToPath,
  parseResolvedColor,
  readNumberToken,
  readOklchToken,
  readResolvedValue,
  readTokenValue,
} = values;
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

  /**
   * Every property this gate runs a contrast or gamut assertion against. These
   * must not be skipped for ANY reason: a malformed declaration for one of them
   * is precisely the failure this block exists to catch, so a filter that
   * quietly dropped it would restore the hole from the other side.
   */
  const CONTRAST_ASSERTED = Object.keys(cssPropertyToPath).filter((property) => {
    const path = cssPropertyToPath[property];
    if (path === undefined) return false;
    const light = readResolvedValue('light', path);
    return typeof light === 'object' && light !== null && 'colorSpace' in light;
  });

  const comparable = Object.keys(cssPropertyToPath)
    .filter((property) => css.includes(`${property}:`))
    .filter((property) => {
      try {
        return LITERAL_TWO_ARM.test(readTokenValue(css, property));
      } catch {
        return false;
      }
    })
    .toSorted();

  it('compares a meaningful number of tokens rather than silently matching none', () => {
    // Guards the filters above: a regex or naming change that stopped matching
    // would otherwise turn this whole block into a vacuous pass.
    expect(comparable.length).toBeGreaterThan(20);
  });

  // Every `var()` in the stylesheet must point at a property the stylesheet
  // itself declares.
  //
  // This is what closes the remaining hole in the allowlist below. That
  // allowlist recognizes an alias or recipe as a legitimate SHAPE, which means
  // a corrupted alias -- `light-dark(var(--wrong), oklch(...))` -- would be
  // accepted as legitimately-shaped and excluded from the numeric comparison,
  // while the contrast assertions kept reading the still-correct resolved JSON.
  //
  // Enumerating an expected shape per aliased token would also catch it, but at
  // the cost of a hand-maintained list of every non-literal token -- precisely
  // the kind of parallel inventory this stage exists to delete. A referential
  // integrity check needs no list, cannot go stale, and catches a bad reference
  // in ANY declaration rather than only in the ones someone remembered to
  // enumerate.
  it('every var() reference resolves to a property this stylesheet declares', () => {
    const declared = new Set(
      [...css.matchAll(/^\s*(--[a-zA-Z0-9_-]+)\s*:/gm)].map((match) => match[1]),
    );
    const referenced = [...css.matchAll(/var\(\s*(--[a-zA-Z0-9_-]+)/g)].map((match) => match[1]);

    // Guards against the regexes silently matching nothing.
    expect(declared.size).toBeGreaterThan(100);
    expect(referenced.length).toBeGreaterThan(10);

    const dangling = [...new Set(referenced)]
      .filter((name) => !declared.has(name))
      .toSorted((a, b) => String(a).localeCompare(String(b)));
    expect(dangling).toEqual([]);
  });

  // The skip-versus-fail distinction, pinned. A color token declared in the
  // stylesheet must be readable and structurally sound; if generation emitted
  // `var(...)`, dropped an arm, or left the value unterminated, the filter above
  // would silently exclude it and the coarse count would still pass.
  it('every declared color token has a well-formed value, none silently skipped', () => {
    const malformed: string[] = [];
    for (const property of CONTRAST_ASSERTED) {
      if (!css.includes(`${property}:`)) continue;
      let value: string;
      try {
        value = readTokenValue(css, property);
      } catch (error) {
        malformed.push(`${property}: unreadable (${String(error)})`);
        continue;
      }
      // An alias or a recipe is a legitimate shape; a light-dark() that does not
      // parse as two literal arms is not.
      if (value.startsWith('light-dark(') && !LITERAL_TWO_ARM.test(value)) {
        // Legitimate shapes this numeric comparison does not cover: an alias, a
        // recipe, an alpha channel, or a hex arm -- `color.checker.base` keeps a
        // historical `#fff` in its light arm on purpose. Anything else that
        // claims to be `light-dark()` and is not two parseable arms is malformed.
        const legitimate = /var\(|color-mix\(|oklch\(from|\/|#[0-9a-fA-F]{3,8}\b/.test(value);
        if (legitimate) continue;
        malformed.push(`${property}: ${value}`);
      }
    }
    expect(malformed).toEqual([]);
  });

  for (const property of comparable) {
    it(`${property} emits the resolved light and dark values`, () => {
      const arms = readOklchToken(property);
      const numbers = [...readTokenValue(css, property).matchAll(/[\d.]+/g)].map((match) =>
        Number(match[0]),
      );
      expect(numbers).toHaveLength(6);

      const lightL = numbers[0]!;
      const lightC = numbers[1]!;
      const lightH = numbers[2]!;
      const darkL = numbers[3]!;
      const darkC = numbers[4]!;
      const darkH = numbers[5]!;
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
    const accentArms = readOklchToken('--cinder-accent-solid');
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

describe('JSON token input boundaries', () => {
  function withJsonFixture(source: string, verify: (path: string) => void): void {
    const directory = mkdtempSync(join(tmpdir(), 'cinder-token-reader-'));
    try {
      const path = join(directory, 'registry.json');
      writeFileSync(path, source);
      verify(path);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  }

  it('rejects non-object JSON and malformed JSON', () => {
    for (const source of ['null', '[]', '42', 'true', '"token"']) {
      withJsonFixture(source, (path) => {
        expect(() => readJsonRecord(path)).toThrow('is not a JSON object');
      });
    }
    withJsonFixture('{', (path) => {
      expect(() => readJsonRecord(path)).toThrow(SyntaxError);
    });
  });

  it('rejects a missing or non-object property map', () => {
    for (const source of [
      '{}',
      '{"cssPropertyToPath":null}',
      '{"cssPropertyToPath":[]}',
      '{"cssPropertyToPath":false}',
    ]) {
      withJsonFixture(source, (path) => {
        expect(() => readCssPropertyToPath(path)).toThrow('has no cssPropertyToPath object');
      });
    }
  });

  it('rejects every non-string registry path', () => {
    for (const invalid of [null, 42, true, [], {}]) {
      withJsonFixture(
        JSON.stringify({ cssPropertyToPath: { '--valid': 'color.valid', '--invalid': invalid } }),
        (path) => {
          expect(() => readCssPropertyToPath(path)).toThrow('has a non-string path for --invalid');
        },
      );
    }
  });

  it('preserves valid paths and own special keys without changing the result prototype', () => {
    withJsonFixture(
      '{"cssPropertyToPath":{"--token":"color.token","__proto__":"color.special"}}',
      (path) => {
        const result = readCssPropertyToPath(path);
        expect(result['--token']).toBe('color.token');
        expect(Object.hasOwn(result, '__proto__')).toBe(true);
        expect(result['__proto__']).toBe('color.special');
        expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
      },
    );
    withJsonFixture('{"cssPropertyToPath":{}}', (path) => {
      expect(readCssPropertyToPath(path)).toEqual({});
    });
  });
});
