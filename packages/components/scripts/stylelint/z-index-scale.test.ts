import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'bun:test';
import stylelint from 'stylelint';

const ruleName = 'cinder/z-index-scale';
const pluginPath = fileURLToPath(new URL('./z-index-scale.mjs', import.meta.url));
const fallbackAnalysisPath = fileURLToPath(
  new URL('./z-index-fallback-analysis.mjs', import.meta.url),
);

async function lint(css: string) {
  return stylelint.lint({
    code: css,
    config: {
      plugins: [pluginPath],
      rules: { [ruleName]: true },
    },
  });
}

function warnings(result: Awaited<ReturnType<typeof stylelint.lint>>) {
  return result.results
    .flatMap((file) => file.warnings ?? [])
    .filter((warning) => {
      return warning.rule === ruleName;
    });
}

describe('cinder/z-index-scale', () => {
  test('keeps the fallback scanner compatible with the ES2022 runtime target', async () => {
    expect(await Bun.file(fallbackAnalysisPath).text()).not.toContain('.toReversed(');
  });

  test.each([
    'auto',
    'AUTO',
    'Auto',
    '0',
    '1',
    'var(--cinder-z-popover)',
    'var(--cinder-z-drag-preview)',
    'var(--cinder-z-focused-affordance)',
  ])('accepts %s', async (value) => {
    expect(warnings(await lint(`.fixture { z-index: ${value}; }`))).toEqual([]);
  });

  test.each([
    'var(--cinder-z-dropdown, 1100)',
    'var(--cinder-z-popover, 40)',
    'var(--cinder-z-tooltip, var(--fallback))',
    'VAR(--cinder-z-popover, 1100)',
  ])('rejects a layer token fallback: %s', async (value) => {
    const result = warnings(await lint(`.fixture { z-index: ${value}; }`));
    expect(result).toHaveLength(1);
    expect(result[0]?.text).toContain('must not have a fallback');
  });

  test('rejects a nested layer token fallback', async () => {
    const result = warnings(
      await lint('.fixture { z-index: calc(var(--cinder-z-popover, 1000) + 1); }'),
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.text).toContain('must not have a fallback');
  });

  test('rejects a layer token fallback hidden behind a CSS comment', async () => {
    const result = warnings(await lint('.fixture { z-index: var(--cinder-z-popover/**/, 1100); }'));
    expect(result).toHaveLength(1);
    expect(result[0]?.text).toContain('must not have a fallback');
  });

  test('rejects an undeclared token even with a local reason', async () => {
    for (const value of ['var(--cinder-z-popvoer)', 'VAR(--cinder-z-popvoer)']) {
      const result = warnings(
        await lint(`.fixture { /* cinder-z-index-local: local layer. */ z-index: ${value}; }`),
      );
      expect(result).toHaveLength(1);
    }
  });

  test.each(['2', '4', '9999', '-1', 'calc(1 + 1)', 'var(--other-layer)'])(
    'rejects an unclassified raw layer: %s',
    async (value) => {
      const result = warnings(await lint(`.fixture { z-index: ${value}; }`));
      expect(result).toHaveLength(1);
      expect(result[0]?.text).toContain('must be `auto`, `0`, `1`, or a `--cinder-z-*` token');
    },
  );

  test('accepts a higher local layer only with an adjacent reason', async () => {
    const result = await lint(`
      .fixture {
        /* cinder-z-index-local: marker must paint over the overlapping focus ring. */
        z-index: 2;
      }
    `);
    expect(warnings(result)).toEqual([]);
  });

  test('rejects a negative numeric layer even with a local reason', async () => {
    const result = await lint(`
      .fixture {
        /* cinder-z-index-local: this layer must stay behind its stacking context. */
        z-index: -1;
      }
    `);
    expect(warnings(result)).toHaveLength(1);
  });

  test('rejects a statically-negative calc() layer even with a local reason', async () => {
    // `Number('calc(-1)')` is `NaN`, not `-1` — a naive `Number(value) < 0`
    // check never sees this, so a negative value wrapped in `calc()` could
    // otherwise slip past the rule's prohibition on negative local layers.
    const result = await lint(`
      .fixture {
        /* cinder-z-index-local: this layer must stay behind its stacking context. */
        z-index: calc(-1);
      }
    `);
    expect(warnings(result)).toHaveLength(1);
  });

  test.each(['calc(0 - 1)', 'calc(-1 * 1)', 'calc(1 - 2)', 'calc((0 - 1) * 1)'])(
    'rejects the arithmetic negative layer %s even with a local reason',
    async (value) => {
      // Arithmetic like `0 - 1` is statically negative without being a bare
      // numeric literal `Number()` can parse directly either.
      const result = await lint(`
        .fixture {
          /* cinder-z-index-local: this layer must stay behind its stacking context. */
          z-index: ${value};
        }
      `);
      expect(warnings(result)).toHaveLength(1);
    },
  );

  test('rejects an arithmetic negative layer using tabs and newlines as whitespace', async () => {
    // The evaluator's `skipSpace()` previously only recognized U+0020, so an
    // operator separated by a tab or newline (both valid CSS whitespace)
    // made the arithmetic parse fail and return `null`, silently skipping
    // the negative-layer check entirely.
    const result = await lint(`
      .fixture {
        /* cinder-z-index-local: this layer must stay behind its stacking context. */
        z-index: calc(0\t-\n1);
      }
    `);
    expect(warnings(result)).toHaveLength(1);
  });

  test('accepts a reasoned component-local expression but never the historical 9999 escape hatch', async () => {
    const localExpression = await lint(`
      .fixture {
        /* cinder-z-index-local: focused item rises above siblings in this group. */
        z-index: calc(var(--item-index, 0) + 100);
      }
    `);
    expect(warnings(localExpression)).toEqual([]);

    const magicNumber = await lint(`
      .fixture {
        /* cinder-z-index-local: this is still not a scale. */
        z-index: 9999;
      }
    `);
    expect(warnings(magicNumber)).toHaveLength(1);
  });

  test.each([
    'var(--item-layer, 9999)',
    'var(--item-layer, calc(9999))',
    'var(--item-layer, calc(+9999))',
    'var(--item-layer, calc(+1e4 - 1))',
    'var(--item-layer, -webkit-calc(9999))',
    'calc(var(--item-layer, 10000 - 1) + 1)',
    'var(--item-layer, calc(0 - 1))',
    'var(--item-layer, calc(calc(10000 - 1)))',
    'v\\61r(--item-layer, -1)',
    'var(--item-layer, calc(calc(10000 - 1) + 0))',
    'var(--item-layer, calc(1e4 - 1))',
    'var(--item-layer, calc(9999.4))',
    'var(--item-layer, calc(9998.5))',
    'var(--item-layer, min(9999, 10000))',
    'var(--item-layer, max(-1, -2))',
    'var(--item-layer, clamp(-1, -2, 1))',
    'var(--item-layer, clamp(9999, 0, 1))',
    'var(--item-layer, abs(-9999))',
    'var(--item-layer, sign(-9999))',
    'var(--x\\\\, -1)',
    'env(cinder-missing, 9999)',
    'var(--item-layer, env(cinder-missing, 9999))',
    'var(--item-layer, calc(9999px / 1px))',
    'var(--item-layer, calc(9999s / 1000ms))',
    'var(--item-layer, calc(9999turn / 360deg))',
    'var(--item-layer, calc(9999khz / 1000hz))',
    'var(--item-layer, calc(9999dppx / 96dpi))',
    'var(--item-layer, calc(9999x / 1dppx))',
    'attr(data-layer type(<integer>), 9999)',
    'var(--item-layer, mod(9999, 10000))',
    'var(--item-layer, rem(9999, 10000))',
    'var(--item-layer, round(nearest, 9999.4, 1))',
    'var(--item-layer, round(9999.4))',
    'var(--item-layer, pow(9999, 1))',
    'var(--item-layer, sqrt(99980001))',
    'var(--item-layer, hypot(9999, 0))',
    'var(--item-layer, calc(9999 * sin(pi / 2)))',
    'var(--item-layer, exp(log(9999)))',
    'var(--item-layer, calc(9999 * progress(1, 0, 1)))',
    'var(--item-layer, calc(asin(1) / 90deg * 9999))',
    'var(--item-layer, calc(atan2(1, 0) / 90deg * 9999))',
  ])('rejects a banned value in a CSS substitution fallback: %s', async (value) => {
    const result = await lint(`
      .fixture {
        /* cinder-z-index-local: this relationship is intentionally local. */
        z-index: ${value};
      }
    `);
    expect(warnings(result)).toHaveLength(1);
    expect(result.results[0]?.warnings?.[0]?.text).toContain('fallback');
  });

  test('rejects a banned literal in a nested custom-property fallback chain', async () => {
    const result = await lint(`
      .fixture {
        /* cinder-z-index-local: this relationship is intentionally local. */
        z-index: var(--item-layer, var(--inner-layer, calc(10000 - 1)));
      }
    `);
    expect(warnings(result)).toHaveLength(1);
    expect(result.results[0]?.warnings?.[0]?.text).toContain('fallback');
  });

  test('rejects a banned enclosing expression after substituting nested fallbacks', async () => {
    for (const value of [
      'var(--item-layer, calc(9999 + var(--offset, 0)))',
      'calc(var(--item-layer, 9998) + 1)',
      'calc(env(cinder-missing, 0) - 1)',
      'calc(attr(data-layer type(<integer>), 9998) + 1)',
    ]) {
      const result = await lint(`
        .fixture {
          /* cinder-z-index-local: this relationship is intentionally local. */
          z-index: ${value};
        }
      `);
      expect(warnings(result)).toHaveLength(1);
      expect(result.results[0]?.warnings?.[0]?.text).toContain('fallback');
    }
  });

  test('evaluates nested fallbacks in their enclosing arithmetic context', async () => {
    const result = await lint(`
      .fixture {
        /* cinder-z-index-local: the enclosing fallback resolves to the local layer 1. */
        z-index: var(--outer, calc(var(--inner, -1) + 2));
      }
    `);

    expect(warnings(result)).toEqual([]);
  });

  test.each([
    'var(--inner, -1)',
    'env(cinder-missing, -1)',
    'attr(data-layer type(<integer>), -1)',
  ])('fails closed when an unresolved sibling masks a nested banned path: %s', async (value) => {
    const result = await lint(`
      .fixture {
        /* cinder-z-index-local: unresolved context must not mask a banned path. */
        z-index: var(--outer, calc(${value} + var(--dynamic)));
      }
    `);

    expect(warnings(result)).toHaveLength(1);
    expect(result.results[0]?.warnings?.[0]?.text).toContain('fallback');
  });

  test('anchors a fallback warning to the fallback occurrence', async () => {
    for (const css of [
      '.fixture { /* cinder-z-index-local: test. */ z-index: calc(9999 + var(--x, 9999)); }',
      '.fixture { /* cinder-z-index-local: test. */ z-index: calc(min(1, 9999) + var(--x, 9999)); }',
    ]) {
      const result = await lint(css);
      const [warning] = warnings(result);
      expect(warning?.column).toBe(css.lastIndexOf('9999') + 1);
      expect(warning?.endColumn).toBe(css.lastIndexOf('9999') + 5);
    }
  });

  test('does not treat whitespace-separated identifiers as substitution functions', async () => {
    for (const functionName of ['var', 'env', 'attr']) {
      for (const whitespace of [' ', '\u00a0']) {
        const result = await lint(`
          .fixture {
            /* cinder-z-index-local: this is not a CSS function token. */
            z-index: ${functionName}${whitespace}(--item-layer, 9999);
          }
        `);
        expect(warnings(result)).toEqual([]);
      }
    }
  });

  test('consumes a CRLF pair that terminates a hexadecimal function-name escape', async () => {
    const result = await lint(`
      .fixture {
        /* cinder-z-index-local: escaped function names still require inspection. */
        z-index: v\\61\r\nr(--item-layer, 9999);
      }
    `);
    expect(warnings(result)).toHaveLength(1);
  });

  test('scans deeply nested fallback chains without recursion or overflow', async () => {
    const depth = 12_000;
    for (const [leaf, warningCount] of [
      ['1', 0],
      ['9999', 1],
    ] as const) {
      const nestedFallback = `${'var(--item-layer, '.repeat(depth)}${leaf}${')'.repeat(depth)}`;
      const result = await lint(`
        .fixture {
          /* cinder-z-index-local: generated fallbacks must not abort linting. */
          z-index: ${nestedFallback};
        }
      `);
      expect(warnings(result)).toHaveLength(warningCount);
    }
  });

  test('scans deeply nested calc chains without recursion or overflow', async () => {
    const depth = 25_000;
    for (const [leaf, warningCount] of [
      ['1', 0],
      ['9999', 1],
    ] as const) {
      const nestedCalc = `${'calc('.repeat(depth)}${leaf}${')'.repeat(depth)}`;
      const result = await lint(`
        .fixture {
          /* cinder-z-index-local: generated calculations must not abort linting. */
          z-index: var(--item-layer, ${nestedCalc});
        }
      `);
      expect(warnings(result)).toHaveLength(warningCount);
    }
  });

  test('follows CSS integer rounding for negative half values', async () => {
    const roundedToZero = await lint(`
      .fixture {
        /* cinder-z-index-local: this rounds to the neutral zero layer. */
        z-index: var(--item-layer, calc(-0.5));
      }
    `);
    expect(warnings(roundedToZero)).toEqual([]);

    const roundedNegative = await lint(`
      .fixture {
        /* cinder-z-index-local: this remains a negative layer after rounding. */
        z-index: var(--item-layer, calc(-1.5));
      }
    `);
    expect(warnings(roundedNegative)).toHaveLength(1);
  });

  test('does not inspect a similarly named non-var function', async () => {
    expect(
      warnings(
        await lint(`
          .fixture {
            /* cinder-z-index-local: this is a non-var function. */
            z-index: cvar(--item-layer, 9999);
          }
        `),
      ),
    ).toEqual([]);

    expect(
      warnings(
        await lint(`
          .fixture {
            /* cinder-z-index-local: this is not a var() function. */
            z-index: cvar(--cinder-z-popover, 1100);
          }
        `),
      ),
    ).toEqual([]);

    expect(
      warnings(
        await lint(`
          .fixture {
            /* cinder-z-index-local: this is not a CSS math function. */
            z-index: var(--item-layer, recalc(9999));
          }
        `),
      ),
    ).toEqual([]);

    expect(
      warnings(
        await lint(`
          .fixture {
            /* cinder-z-index-local: this is not a var() function. */
            z-index: var(--item-layer, évar(--x, 9999));
          }
        `),
      ),
    ).toEqual([]);
  });

  test('handles escaped commas and invalid Unicode escapes without throwing', async () => {
    const escapedComma = await lint(`
      .fixture {
        /* cinder-z-index-local: this is a valid custom property name. */
        z-index: var(--foo\\,bar, 9999);
      }
    `);
    expect(warnings(escapedComma)).toHaveLength(1);

    for (const escapedCommaValue of ['\\2c ', '\\02c ', '\\00002c ']) {
      const numericEscapedComma = await lint(`
        .fixture {
          /* cinder-z-index-local: this is a valid custom property name. */
          z-index: var(--foo${escapedCommaValue}bar, 9999);
        }
      `);
      expect(warnings(numericEscapedComma)).toHaveLength(1);
    }

    const sixDigitComma = await lint(`
      .fixture {
        /* cinder-z-index-local: this is a valid custom property name. */
        z-index: var(--foo\\00002cbar, 9999);
      }
    `);
    expect(warnings(sixDigitComma)).toHaveLength(1);

    const invalidUnicode = await lint(`
      .fixture {
        /* cinder-z-index-local: this property name contains an invalid escape. */
        z-index: var(--foo\\110000, 1);
      }
    `);
    expect(warnings(invalidUnicode)).toEqual([]);
  });

  test('preserves escaped parentheses in custom-property names while scanning fallbacks', async () => {
    const result = await lint(`
      .fixture {
        /* cinder-z-index-local: this is a valid custom property name. */
        z-index: var(--foo\\)bar, -1);
      }
    `);
    expect(warnings(result)).toHaveLength(1);
  });

  test('preserves numeric escaped parentheses in custom-property names while scanning fallbacks', async () => {
    for (const [opening, closing] of [
      ['\\28 ', '\\29 '],
      ['\\028 ', '\\029 '],
      ['\\000028 ', '\\000029 '],
    ]) {
      const result = await lint(`
        .fixture {
          /* cinder-z-index-local: this is a valid custom property name. */
          z-index: var(--foo${opening}bar${closing}, -1);
        }
      `);
      expect(warnings(result)).toHaveLength(1);
    }

    const sixDigitHexAdjacent = await lint(`
      .fixture {
        /* cinder-z-index-local: this is a valid custom property name. */
        z-index: var(--foo\\000028bar\\000029, -1);
      }
    `);
    expect(warnings(sixDigitHexAdjacent)).toHaveLength(1);

    const dynamicFallback = await lint(`
      .fixture {
        /* cinder-z-index-local: this is a valid dynamic fallback. */
        z-index: var(--foo\\28 bar\\29 , var(--dynamic));
      }
    `);
    expect(warnings(dynamicFallback)).toEqual([]);

    const ordinaryName = await lint(`
      .fixture {
        /* cinder-z-index-local: this is a valid dynamic fallback. */
        z-index: var(--foo00002cbar, var(--dynamic));
      }
    `);
    expect(warnings(ordinaryName)).toEqual([]);
  });

  test('rejects escaped layer-token fallbacks', async () => {
    const result = await lint(`.fixture { z-index: v\\61r(--cinder-z-popover, 1100); }`);
    expect(warnings(result)).toHaveLength(1);
    expect(warnings(result)[0]?.text).toContain('must not have a fallback');
  });

  test('preserves backslash parity while decoding layer-token names', async () => {
    expect(warnings(await lint('.fixture { z-index: var(--cinder-z-po\\70 over); }'))).toEqual([]);
    expect(
      warnings(await lint('.fixture { z-index: var(--cinder-z-po\\\\70over); }')),
    ).toHaveLength(1);
    expect(
      warnings(await lint('.fixture { z-index: var(--cinder-z-po\\\\\\70 over); }')),
    ).toHaveLength(1);

    expect(
      warnings(
        await lint(`
          .fixture {
            /* cinder-z-index-local: this is not a var() function token. */
            z-index: v\\\\61r(--item-layer, -1);
          }
        `),
      ),
    ).toEqual([]);
  });

  test.each([
    'var(--item-layer)',
    'var(--item-layer, var(--cinder-z-popover))',
    'calc(var(--item-layer, var(--cinder-z-popover)) + 1)',
    'var(--item-layer, calc(96px / 1in))',
    'var(--item-layer, calc(1s / 1000ms))',
    'var(--item-layer, calc(1turn / 360deg))',
    'var(--item-layer, calc(1khz / 1000hz))',
    'var(--item-layer, calc(1dppx / 96dpi))',
    'var(--item-layer, calc(1x / 1dppx))',
    'attr(data-layer type(<integer>), 1)',
    'calc(var(--item-layer, 9998) + var(--dynamic))',
    'var(--item-layer, mod(1, 10000))',
    'var(--item-layer, rem(1, 10000))',
    'var(--item-layer, round(nearest, 1.4, 1))',
    'var(--item-layer, round(1.4))',
    'var(--item-layer, pow(1, 1))',
    'var(--item-layer, sqrt(1))',
    'var(--item-layer, hypot(1, 0))',
    'var(--item-layer, calc(1 * sin(pi / 2)))',
    'var(--item-layer, exp(log(1)))',
    'var(--item-layer, calc(1 * progress(1, 0, 1)))',
    'var(--item-layer, calc(asin(1) / 90deg))',
    'var(--item-layer, calc(atan2(0, 1) / 90deg))',
  ])('accepts a reasoned unresolved property with a safe fallback: %s', async (value) => {
    expect(
      warnings(
        await lint(`
          .fixture {
            /* cinder-z-index-local: this relationship is intentionally local. */
            z-index: ${value};
          }
        `),
      ),
    ).toEqual([]);
  });

  test.each(['calc(9999)', 'calc(10000 - 1)', 'calc(9998 + 1)'])(
    'rejects the calculated magic-number variant %s even with a local reason',
    async (value) => {
      // A plain string comparison against '9999' only catches the literal,
      // not an arithmetic expression that evaluates to the same number.
      const result = await lint(`
        .fixture {
          /* cinder-z-index-local: this is still not a scale. */
          z-index: ${value};
        }
      `);
      expect(warnings(result)).toHaveLength(1);
    },
  );

  test('rejects an empty or detached local-layer justification', async () => {
    const empty = await lint(`
      .fixture {
        /* cinder-z-index-local: */
        z-index: 2;
      }
    `);
    expect(warnings(empty)).toHaveLength(1);

    const detached = await lint(`
      .fixture {
        /* cinder-z-index-local: this comment describes a different declaration. */
        color: red;
        z-index: 2;
      }
    `);
    expect(warnings(detached)).toHaveLength(1);
  });

  test('matches relative files and case-insensitive property names', async () => {
    const result = await stylelint.lint({
      code: '.fixture { Z-INDEX: 42; }',
      codeFilename: 'packages/components/src/components/fixture.css',
      config: { plugins: [pluginPath], rules: { [ruleName]: true } },
    });
    expect(warnings(result)).toHaveLength(1);
  });
});
