import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'bun:test';
import stylelint from 'stylelint';

const ruleName = 'cinder/z-index-scale';
const pluginPath = fileURLToPath(new URL('./z-index-scale.mjs', import.meta.url));
const fallbackAnalysisPath = fileURLToPath(
  new URL('./z-index-fallback-analysis.mjs', import.meta.url),
);
const valueAnalysisPath = fileURLToPath(new URL('./z-index-value-analysis.mjs', import.meta.url));

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

function sourceLocation(value: string, index: number) {
  let line = 1;
  let column = 1;
  for (let cursor = 0; cursor < index; cursor += 1) {
    if (value[cursor] === '\r') {
      if (value[cursor + 1] === '\n') cursor += 1;
      line += 1;
      column = 1;
      continue;
    }
    if (value[cursor] === '\n' || value[cursor] === '\f') {
      line += 1;
      column = 1;
      continue;
    }
    column += 1;
  }
  return { line, column };
}

describe('cinder/z-index-scale', () => {
  test('keeps the fallback scanner compatible with the ES2022 runtime target', async () => {
    expect(await Bun.file(fallbackAnalysisPath).text()).not.toMatch(
      /\.toReversed\s*(?:\?\.\s*)?\(/,
    );
  });

  test('charges frame-expression operator scans to the shared resolution budget', async () => {
    const source = await Bun.file(fallbackAnalysisPath).text();

    expect(source).toContain('function analyzeFrameExpression(frame, resolvedFallback, budget)');
    expect(source).toMatch(/resolvedFallback\.length,\s+budget,\s+frame\.mathContext/);
  });

  test('uses constant-time progress-parent membership checks', async () => {
    const source = await Bun.file(fallbackAnalysisPath).text();

    expect(source).toContain('const progressParentSet = new Set();');
    expect(source).toContain('progressParentSet.has(child.progressParent)');
    expect(source).not.toContain('progressParents.includes(progressParent)');
  });

  test('reduces wide CSS math functions without spreading call arguments', async () => {
    expect(await Bun.file(valueAnalysisPath).text()).not.toMatch(
      /Math\.(?:hypot|max|min)\s*(?:\?\.\s*)?\(\s*\.\.\./,
    );
  });

  test.each([
    'auto',
    'AUTO',
    'Auto',
    '0',
    '1',
    '/**/0/**/',
    'var(--cinder-z-popover)',
    '/**/var(--cinder-z-popover)/**/',
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

  test('does not treat comments as operator whitespace in a reasoned local expression', async () => {
    const result = await lint(`
      .fixture {
        /* cinder-z-index-local: an unused invalid expression is not the magic layer. */
        z-index: calc(10000/**/-/**/1);
      }
    `);

    expect(warnings(result)).toEqual([]);
  });

  test.each(['\n', '\r', '\f', '\r\n'])(
    'does not treat a comment containing %j as operator whitespace',
    async (lineBreak) => {
      const result = await lint(`
        .fixture {
          /* cinder-z-index-local: comment contents cannot supply calculation whitespace. */
          z-index: calc(10000/*${lineBreak}*/-/*${lineBreak}*/1);
        }
      `);

      expect(warnings(result)).toEqual([]);
    },
  );

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

  test.each(['calc(0 - 1)', 'calc(-1 * 1)', 'calc(1 - 2)', 'calc((0 - 1) * 1)', 'calc(-infinity)'])(
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
    'var(--item-layer, calc(10000 + -1))',
    'var(--item-layer, calc(10000/**/ - /**/1))',
    'var(--item-layer, calc(9999*1))',
    'var(--item-layer, calc(9999/1))',
    'var(--item-layer, -webkit-calc(9999))',
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
    'var(--item-layer, calc(9999fr / 1fr))',
    'var(--item-layer, calc(9999px * 1px / 1px / 1px))',
    'attr(data-layer type(<integer>), 9999)',
    'var(--item-layer, mod(9999, 10000))',
    'var(--item-layer, rem(9999, 10000))',
    'var(--item-layer, calc(1 / mod(0, -1)))',
    'var(--item-layer, mod(9999, infinity))',
    'var(--item-layer, rem(9999, infinity))',
    'var(--item-layer, rem(9999, -infinity))',
    'var(--item-layer, mod(-9999, -infinity))',
    'var(--item-layer, round(nearest, 9999.4, 1))',
    'var(--item-layer, round(9999.4))',
    'var(--item-layer, round(nearest, 9998.5, -1))',
    'var(--item-layer, round(up, 9998.5, -1))',
    'var(--item-layer, round(down, -9999, infinity))',
    'var(--item-layer, pow(9999, 1))',
    'var(--item-layer, sqrt(99980001))',
    'var(--item-layer, hypot(9999, 0))',
    'var(--item-layer, calc(9999 * sin(pi / 2)))',
    'var(--item-layer, calc(1 / sin(-1 * 0)))',
    'var(--item-layer, calc(1 / tan(-1 * 0)))',
    'var(--item-layer, calc(9999 + cos(90deg) * 1e16))',
    'var(--item-layer, tan(270deg))',
    'var(--item-layer, exp(log(9999)))',
    'var(--item-layer, calc(9999 * progress(1, 0, 1)))',
    'var(--item-layer, calc(9999 * progress(2, 0, 1)))',
    'var(--item-layer, calc(9999 * progress(2, 1, 1)))',
    'var(--item-layer, calc(9999 * progress(-1, 1, 0)))',
    'var(--item-layer, calc(asin(1) / 90deg * 9999))',
    'var(--item-layer, calc(atan2(1, 0) / 90deg * 9999))',
    'var(--item-layer, calc(-infinity))',
    'var(--item-layer, clamp(none, 9999, 10000))',
    'var(--item-layer, clamp(none/**/, 9999, 9999))',
    'var(--item-layer, clamp(0, 9999, none))',
    'var(--item-layer, clamp(9999, 9999, none/**/))',
    'max(var(--item-layer, 9999), var(--dynamic, 0), 0)',
    'calc(2 * var(--inner, 4997 + 5))',
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

  test('evaluates a top-level fallback only in its enclosing safe context', async () => {
    const safe = await lint(`
      .fixture {
        /* cinder-z-index-local: max prevents the fallback from producing a negative layer. */
        z-index: max(var(--inner, -1), 0);
      }
    `);
    expect(warnings(safe)).toEqual([]);

    const unsafe = await lint(`
      .fixture {
        /* cinder-z-index-local: min can still expose the negative fallback. */
        z-index: min(var(--inner, -1), 0);
      }
    `);
    expect(warnings(unsafe)).toHaveLength(1);
  });

  test('retains a banned fallback when a sibling may use its defined value', async () => {
    const result = await lint(`
      .fixture {
        /* cinder-z-index-local: the factor fallback is not its only runtime value. */
        z-index: var(--outer, calc(var(--inner, -1) * var(--factor, 0)));
      }
    `);

    expect(warnings(result)).toHaveLength(1);
  });

  test('reports the surviving magic fallback after a max floor eliminates a negative sibling', async () => {
    const result = await lint(`
      .fixture {
        /* cinder-z-index-local: the magic fallback remains observable. */
        z-index: max(var(--negative, -1), var(--magic, 9999), 0);
      }
    `);

    expect(warnings(result)).toHaveLength(1);
    expect(result.results[0]?.warnings?.[0]?.text).toContain('`9999`');
  });

  test('preserves distinct banned classifications through nested fallback frames', async () => {
    const result = await lint(`
      .fixture {
        /* cinder-z-index-local: the outer floor cannot eliminate the nested magic fallback. */
        z-index: var(
          --outer,
          max(var(--mid, calc(var(--negative, -1) + var(--magic, 9999) + var(--runtime))), 0)
        );
      }
    `);

    expect(warnings(result)).toHaveLength(1);
    expect(result.results[0]?.warnings?.[0]?.text).toContain('`9999`');
  });

  test('accepts a magic fallback capped by a fallback-independent min ceiling', async () => {
    const result = await lint(`
      .fixture {
        /* cinder-z-index-local: the static ceiling prevents the magic fallback from surfacing. */
        z-index: min(var(--magic, 9999), var(--dynamic), 1);
      }
    `);

    expect(warnings(result)).toEqual([]);
  });

  test('does not treat a safe value above the magic layer as an eliminating min ceiling', async () => {
    const result = await lint(`
      .fixture {
        /* cinder-z-index-local: this ceiling can still expose the magic fallback. */
        z-index: min(var(--magic, 9999), var(--dynamic), 10000);
      }
    `);

    expect(warnings(result)).toHaveLength(1);
  });

  test.each(['-1', '9999'])(
    'accepts a banned fallback bounded by independent clamp limits: %s',
    async (fallback) => {
      const result = await lint(`
        .fixture {
          /* cinder-z-index-local: clamp guarantees a final local layer from zero through one. */
          z-index: clamp(0, calc(var(--inner, ${fallback}) + var(--runtime)), 1);
        }
      `);

      expect(warnings(result)).toEqual([]);
    },
  );

  test('does not suppress a magic fallback with crossed clamp bounds', async () => {
    const result = await lint(`
      .fixture {
        /* cinder-z-index-local: the minimum wins when clamp bounds cross. */
        z-index: clamp(9999, calc(var(--inner, 9999) + var(--runtime)), 1);
      }
    `);

    expect(warnings(result)).toHaveLength(1);
  });

  test.each([
    'clamp(none, calc(var(--inner, 9999) + var(--runtime)), 1)',
    'clamp(10000, calc(var(--inner, 9999) + var(--runtime)), 1)',
    'clamp(10000, calc(var(--inner, 9999) + var(--runtime)), 9999)',
  ])('accepts a magic fallback when clamp still proves a safe final layer: %s', async (value) => {
    const result = await lint(`
      .fixture {
        /* cinder-z-index-local: the final clamp result cannot expose the magic layer. */
        z-index: ${value};
      }
    `);

    expect(warnings(result)).toEqual([]);
  });

  test.each([
    'clamp(0, var(--inner, -1))',
    'clamp(0, var(--inner, -1),)',
    'clamp(0,, var(--inner, -1), 1)',
    'clamp(0, var(--inner, -1), 1, 2)',
    'clamp(0, var(--inner, 9999), 1, 2)',
    'clamp(0, none, var(--inner, -1))',
    'clamp(var(--inner, 9999), none, 1)',
    'clamp(0, none + var(--inner, -1), 1)',
    'clamp(0, var(--inner, -1) + none, 1)',
    'clamp(0, calc(none + var(--inner, -1)), 1)',
    'clamp(0, "none" + var(--inner, -1), 1)',
    'clamp(0, calc(var(--inner, -1)9999), 1)',
    'clamp(0, calc(var(--inner, 9999)1), 1)',
  ])('does not apply independent bounds from a malformed clamp: %s', async (value) => {
    const result = await lint(`
      .fixture {
        /* cinder-z-index-local: malformed clamp syntax cannot prove the fallback safe. */
        z-index: ${value};
      }
    `);

    expect(warnings(result)).toHaveLength(1);
  });

  test.each(['var(--outer, var(--inner, 9)999)', 'calc(var(--inner, 9)999)'])(
    'preserves adjacent numeric tokens during fallback substitution: %s',
    async (value) => {
      const result = await lint(`
      .fixture {
        /* cinder-z-index-local: adjacent number tokens do not form the magic number. */
        z-index: ${value};
      }
    `);
      expect(warnings(result)).toEqual([]);
    },
  );

  test.each([
    'var(--outer, calc(var(--inner, -1) * 0))',
    'var(--outer, calc(0 * var(--inner, -1)))',
    'var(--outer, calc(var(--inner, -1) * 0 + 0))',
    'var(--outer, calc(var(--inner, -1) * 0 + var(--dynamic)))',
    'var(--outer, calc(0 * var(--inner, -1) + var(--dynamic)))',
    'var(--outer, calc((var(--inner, -1)) * (0 + 0) + var(--dynamic)))',
  ])('accepts a nested banned fallback whose contribution is eliminated: %s', async (value) => {
    const result = await lint(`
      .fixture {
        /* cinder-z-index-local: the banned child cannot contribute to this layer. */
        z-index: ${value};
      }
    `);

    expect(warnings(result)).toEqual([]);
  });

  test.each([
    'var(--outer, calc(1 / (var(--inner, -1) * 0) + var(--dynamic)))',
    'var(--outer, calc(pow(var(--inner, -1) * 0, -1) + var(--dynamic)))',
    'calc(1 / var(--outer, rem(var(--inner, -1) * 0, var(--divisor))))',
  ])('retains a zeroed banned fallback when its sign remains observable: %s', async (value) => {
    const result = await lint(`
      .fixture {
        /* cinder-z-index-local: negative zero can produce negative infinity. */
        z-index: ${value};
      }
    `);

    expect(warnings(result)).toHaveLength(1);
  });

  test('limits rem signed-zero sensitivity to the dividend', async () => {
    const result = await lint(`
      .fixture {
        /* cinder-z-index-local: a zero divisor cannot expose its negative fallback. */
        z-index: var(--outer, rem(1, var(--inner, -1) * 0));
      }
    `);

    expect(warnings(result)).toEqual([]);
  });

  test.each([
    'calc(1 / var(--outer, calc(var(--inner, -1) * 0 + var(--dynamic))))',
    'calc(1 / var(--outer, calc(var(--inner, -1) * 0 + var(--dynamic, 0))))',
    'calc(1 / var(--outer, calc(var(--inner, -1) * 0 - var(--dynamic))))',
  ])('retains signed-zero evidence with a runtime additive sibling: %s', async (value) => {
    const result = await lint(`
      .fixture {
        /* cinder-z-index-local: a runtime sibling can preserve negative zero. */
        z-index: ${value};
      }
    `);

    expect(warnings(result)).toHaveLength(1);
  });

  test('preserves ungrouped fallback token-stream precedence during zero elimination', async () => {
    const unsafe = await lint(`
      .fixture {
        /* cinder-z-index-local: the ungrouped fallback can expose the magic layer. */
        z-index: var(--outer, calc(0 * var(--inner, 0 + 9999) + var(--dynamic)));
      }
    `);
    expect(warnings(unsafe)).toHaveLength(1);

    const grouped = await lint(`
      .fixture {
        /* cinder-z-index-local: calc groups the fallback beneath the zero product. */
        z-index: var(--outer, calc(0 * var(--inner, calc(0 + 9999)) + var(--dynamic)));
      }
    `);
    expect(warnings(grouped)).toEqual([]);
  });

  test('consumes a unary sign when scanning a right-hand zero factor', async () => {
    const result = await lint(`
      .fixture {
        /* cinder-z-index-local: the signed zero eliminates the negative fallback. */
        z-index: var(--outer, calc(var(--inner, -1) * -0 + var(--dynamic)));
      }
    `);

    expect(warnings(result)).toEqual([]);
  });

  test('does not scan fallback-like text inside quoted strings', async () => {
    for (const fallback of [
      '"var(--inner, -1)"',
      "'var(--inner, 9999)'",
      '"var(\\"--inner, -1)"',
    ]) {
      const result = await lint(`
        .fixture {
          /* cinder-z-index-local: string tokens cannot invoke substitution functions. */
          z-index: var(--outer, ${fallback});
        }
      `);

      expect(warnings(result)).toEqual([]);
    }
  });

  test('does not count parentheses inside quoted strings as static expression depth', async () => {
    const quotedParentheses = `"${'('.repeat(513)}not-a-number${')'.repeat(513)}"`;
    const result = await lint(`
      .fixture {
        /* cinder-z-index-local: string contents are opaque to static math analysis. */
        z-index: var(--outer, ${quotedParentheses});
      }
    `);

    expect(warnings(result)).toEqual([]);
  });

  test('resumes fallback scanning after an unescaped newline terminates a quoted string', async () => {
    const result = await lint(`
      .fixture {
        /* cinder-z-index-local: a bad string must not hide the following negative fallback. */
        z-index: calc(var(--left, "
          ) + var(--inner, -1) + var(--right, "));
      }
    `);

    expect(warnings(result)).toHaveLength(1);
  });

  test('preserves fallbacks between comment delimiters inside quoted strings', async () => {
    const result = await lint(`
      .fixture {
        /* cinder-z-index-local: quoted comment text must not mask the negative fallback. */
        z-index: calc(var(--left, "/*") + var(--inner, -1) + var(--right, "*/"));
      }
    `);

    expect(warnings(result)).toHaveLength(1);
  });

  test.each(['var(--inner, 9999)', 'env(cinder-missing, 9999)'])(
    'treats a masked comment as trivia before a substitution function: %s',
    async (fallback) => {
      const result = await lint(`
        .fixture {
          /* cinder-z-index-local: a comment may separate adjacent fallback functions. */
          z-index: var(--outer, /**/${fallback});
        }
      `);

      expect(warnings(result)).toHaveLength(1);
    },
  );

  test('keeps a literal private-use code point identifier-adjacent', async () => {
    const privateUseIdentifierCharacter = '\uE001';
    const result = await lint(`
      .fixture {
        /* cinder-z-index-local: the private-use prefix makes this a different function name. */
        z-index: var(--outer, ${privateUseIdentifierCharacter}var(--inner, 9999));
      }
    `);

    expect(warnings(result)).toEqual([]);
  });

  test('does not treat an escaped slash as the start of a CSS comment', async () => {
    const result = await lint(`
      .fixture {
        /* cinder-z-index-local: escaped syntax must not mask the nested magic fallback. */
        z-index: var(--outer, \\/* var(--inner, 9999) */);
      }
    `);

    expect(warnings(result)).toHaveLength(1);
  });

  test('does not find cinder layer-token references inside quoted strings', async () => {
    const result = await lint(`
      .fixture {
        /* cinder-z-index-local: string tokens cannot invoke cinder layer substitutions. */
        z-index: var(--outer, "var(--cinder-z-popover, 1)");
      }
    `);

    expect(warnings(result)).toEqual([]);
  });

  test('evaluates fallback operators only when a CSS math context supplies their grammar', async () => {
    const bare = await lint(`
      .fixture {
        /* cinder-z-index-local: bare operator tokens invalidate the fallback value. */
        z-index: var(--outer, 10000 - 1);
      }
    `);
    expect(warnings(bare)).toEqual([]);

    const calculated = await lint(`
      .fixture {
        /* cinder-z-index-local: calc gives the substituted operator stream a math grammar. */
        z-index: calc(var(--outer, 10000 - 1));
      }
    `);
    expect(warnings(calculated)).toHaveLength(1);
  });

  test.each([
    'var(--outer, var(--inner, -1) + 0)',
    'var(--outer, var(--inner, 9999) - 0)',
    'var(--outer, var(--inner, -1) * 1)',
    'var(--outer, var(--inner, 9999) / 1)',
    'var(--outer, var(--inner, -1)/**/+/**/var(--runtime))',
    'var(--outer, min(var(--inner, -1), 0) + 0)',
    'var(--outer, var(--negative, -1) + max(var(--magic, 9999), 0))',
    'var(--outer, max(var(--negative, -1), 0) + var(--magic, 9999))',
    'var(--outer, max(var(--negative, -1), 0) + max(var(--magic, 9999), 0))',
    'var(--outer, 1e + var(--inner, -1))',
    'var(--outer, 1e+var(--inner, -1))',
    'var(--outer, 1e - var(--inner, -1))',
    'var(--outer, rgb(var(--inner, -1) + 0))',
    'var(--outer, hsl(var(--inner, 9999) + 0 0% 0%))',
    'var(--outer, blur(max(var(--inner, -1), 0) + 0))',
  ])(
    'discards nested candidates from a grammar-invalid bare operator stream: %s',
    async (value) => {
      const result = await lint(`
      .fixture {
        /* cinder-z-index-local: bare operators make the selected fallback invalid. */
        z-index: ${value};
      }
    `);

      expect(warnings(result)).toEqual([]);
    },
  );

  test.each([
    'var(--outer, calc(var(--inner, -1) + 0))',
    'var(--outer, calc(var(--inner, 9999) * 1))',
    'var(--outer, rgb(calc(var(--inner, -1) + 0) 0 0))',
  ])('preserves nested candidates inside a valid CSS math context: %s', async (value) => {
    const result = await lint(`
      .fixture {
        /* cinder-z-index-local: calc supplies grammar for the nested banned fallback. */
        z-index: ${value};
      }
    `);

    expect(warnings(result)).toHaveLength(1);
  });

  test.each(['#calc', '@calc'])(
    'does not inherit math grammar from a CSS name token: %s',
    async (functionName) => {
      const result = await lint(`
        .fixture {
          /* cinder-z-index-local: a prefixed name is not a calc function token. */
          z-index: var(--outer, ${functionName}(var(--inner, 10000 - 1)));
        }
      `);

      expect(warnings(result)).toEqual([]);
    },
  );

  test.each([
    ['-pi', 0],
    ['-infinity', 1],
  ] as const)(
    'treats a bare calc-only constant as opaque outside a math context: %s',
    async (constant, calculatedWarningCount) => {
      const bare = await lint(`
        .fixture {
          /* cinder-z-index-local: calc constants are identifiers outside CSS math functions. */
          z-index: var(--outer, ${constant});
        }
      `);
      expect(warnings(bare)).toEqual([]);

      const calculated = await lint(`
        .fixture {
          /* cinder-z-index-local: calc supplies the numeric constant grammar. */
          z-index: var(--outer, calc(${constant}));
        }
      `);
      expect(warnings(calculated)).toHaveLength(calculatedWarningCount);
    },
  );

  test('retains banned values produced by valid negative round intervals', async () => {
    const result = await lint(`
      .fixture {
        /* cinder-z-index-local: negative round intervals remain valid CSS math. */
        z-index: var(--outer, round(nearest, 9999, -1));
      }
    `);

    expect(warnings(result)).toHaveLength(1);
  });

  test.each([
    ['down', '-0.4', 1],
    ['nearest', '-0.6', 1],
    ['up', '-0.4', 0],
    ['nearest', '-0.4', 0],
  ] as const)(
    'preserves fractional fallback evidence through unresolved round(%s): %s',
    async (strategy, fallback, warningCount) => {
      const result = await lint(`
        .fixture {
          /* cinder-z-index-local: runtime zero leaves the fractional fallback unchanged. */
          z-index: var(
            --outer,
            round(${strategy}, var(--inner, ${fallback}) + var(--runtime) * 0, 1)
          );
        }
      `);

      expect(warnings(result)).toHaveLength(warningCount);
    },
  );

  test('retains banned attr fallbacks regardless of the attribute result type', async () => {
    const result = await lint(`
      .fixture {
        /* cinder-z-index-local: a missing attribute substitutes fallback tokens directly. */
        z-index: var(--outer, attr(data-layer raw-string, 9999));
      }
    `);

    expect(warnings(result)).toHaveLength(1);
  });

  test('retains signed-zero evidence across a resolved fallback frame', async () => {
    const result = await lint(`
      .fixture {
        /* cinder-z-index-local: the nested fallback can become negative infinity. */
        z-index: calc(1 / var(--outer, calc(var(--inner, -1) * 0)) + var(--dynamic));
      }
    `);

    expect(warnings(result)).toHaveLength(1);
  });

  test('distinguishes generated negative-zero max floors from literal zero', async () => {
    const unsafe = await lint(`
      .fixture {
        /* cinder-z-index-local: a generated negative-zero floor preserves the fallback sign. */
        z-index: calc(1 / var(--outer, max(var(--inner, -1) * 0, -1 * 0)) + var(--dynamic));
      }
    `);
    expect(warnings(unsafe)).toHaveLength(1);

    const safe = await lint(`
      .fixture {
        /* cinder-z-index-local: a written negative sign still produces literal positive zero. */
        z-index: calc(1 / var(--outer, max(var(--inner, -1) * 0, -0)) + var(--dynamic));
      }
    `);
    expect(warnings(safe)).toEqual([]);
  });

  test.each([
    ['-1 * 0', 1],
    ['calc(-1 * 0)', 1],
    ['0', 0],
    ['-0', 0],
  ] as const)(
    'preserves signed-zero-sensitive magic candidates through a min ceiling: %s',
    async (ceiling, warningCount) => {
      const result = await lint(`
        .fixture {
          /* cinder-z-index-local: a generated negative zero remains observable by division. */
          z-index: var(
            --outer,
            calc(
              1 / var(--mid, min(var(--inner, 9999), ${ceiling})) + var(--runtime) * 0
            )
          );
        }
      `);

      expect(warnings(result)).toHaveLength(warningCount);
    },
  );

  test('does not treat a negative fractional max floor as nonnegative', async () => {
    const result = await lint(`
      .fixture {
        /* cinder-z-index-local: the fractional floor can still produce a negative layer. */
        z-index: calc(1 / var(--outer, max(var(--inner, -1), -0.4)) + var(--dynamic));
      }
    `);

    expect(warnings(result)).toHaveLength(1);
  });

  test('does not retokenize an escaped dimension unit as exponent notation', async () => {
    const result = await lint(`
      .fixture {
        /* cinder-z-index-local: the escaped unit keeps this fallback non-numeric. */
        z-index: var(--outer, calc(9999\\65 0));
      }
    `);

    expect(warnings(result)).toEqual([]);
  });

  test.each([
    '#var(--inner, -1)',
    '@var(--inner, -1)',
    '#var(--cinder-z-popover, 1)',
    '@var(--cinder-z-popover, 1)',
  ])('does not scan substitution-like text inside a CSS name token: %s', async (fallback) => {
    const result = await lint(`
        .fixture {
          /* cinder-z-index-local: the prefixed name cannot invoke var(). */
          z-index: var(--outer, ${fallback});
        }
      `);

    expect(warnings(result)).toEqual([]);
  });

  test('requires an exact algebraic zero before eliminating a banned fallback', async () => {
    const result = await lint(`
      .fixture {
        /* cinder-z-index-local: multiplying by 0.4 still produces a negative layer. */
        z-index: var(--outer, calc(var(--inner, -3) * 0.4 + var(--dynamic)));
      }
    `);

    expect(warnings(result)).toHaveLength(1);
  });

  test.each([
    'var(--outer, calc(var(--inner, -1) * 1 + var(--dynamic)))',
    'var(--outer, calc(var(--inner, -1) + 0 + var(--dynamic)))',
    'var(--outer, calc(var(--inner, -1) / 0 + var(--dynamic)))',
  ])(
    'retains a nested banned fallback when its contribution is not eliminated: %s',
    async (value) => {
      expect(
        warnings(
          await lint(`
          .fixture {
            /* cinder-z-index-local: the banned child can still contribute. */
            z-index: ${value};
          }
        `),
        ),
      ).toHaveLength(1);
    },
  );

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
      '.fixture { /* cinder-z-index-local: test. */ z-index: calc(0 + var(--x, 9999)); }',
      '.fixture { /* cinder-z-index-local: test. */ z-index: calc(min(1, 9999) * var(--x, 9999)); }',
      '.fixture { /* cinder-z-index-local: test. */ z-index: calc(0 + var(--x/**/, 9999)); }',
    ]) {
      const result = await lint(css);
      const [warning] = warnings(result);
      expect(warning?.column).toBe(css.lastIndexOf('9999') + 1);
      expect(warning?.endColumn).toBe(css.lastIndexOf('9999') + 5);
    }
  });

  test('anchors fallback warnings after decoding escaped function names', async () => {
    const css =
      '.fixture { /* cinder-z-index-local: test. */ z-index: calc(0 + v\\61r(--x, 9999)); }';
    const result = await lint(css);
    const [warning] = warnings(result);
    const start = sourceLocation(css, css.lastIndexOf('9999'));
    const end = sourceLocation(css, css.lastIndexOf('9999') + 4);
    expect(warning?.line).toBe(start.line);
    expect(warning?.column).toBe(start.column);
    expect(warning?.endLine).toBe(end.line);
    expect(warning?.endColumn).toBe(end.column);
  });

  test('anchors fallback warnings after escaped astral code points', async () => {
    const css =
      '.fixture { /* cinder-z-index-local: test. */ z-index: calc(\\1f600 + var(--x, 9999)); }';
    const result = await lint(css);
    const [warning] = warnings(result);
    const start = sourceLocation(css, css.lastIndexOf('9999'));
    const end = sourceLocation(css, css.lastIndexOf('9999') + 4);
    expect(warning?.line).toBe(start.line);
    expect(warning?.column).toBe(start.column);
    expect(warning?.endLine).toBe(end.line);
    expect(warning?.endColumn).toBe(end.column);
    expect(warning?.text).toContain('Offending expression: `9999`');
  });

  test.each([
    ['negative', 'calc(\\1f600 + v\\61r(--x, -1))', '-1'],
    ['nested', 'calc(\\1f600 + var(--outer, v\\61r(--inner, 9999)))', '9999'],
  ])('maps the exact %s fallback range through nested CSS escapes', async (_, value, fallback) => {
    const css = `.fixture { /* cinder-z-index-local: test. */ z-index: ${value}; }`;
    const result = await lint(css);
    const [warning] = warnings(result);
    const start = sourceLocation(css, css.lastIndexOf(fallback));
    const end = sourceLocation(css, css.lastIndexOf(fallback) + fallback.length);
    expect(warning?.line).toBe(start.line);
    expect(warning?.column).toBe(start.column);
    expect(warning?.endLine).toBe(end.line);
    expect(warning?.endColumn).toBe(end.column);
    expect(warning?.text).toContain(`Offending expression: \`${fallback}\``);
  });

  test('reports the original fallback source in offending-expression diagnostics', async () => {
    const expression = 'var(--x, calc(9999/*comment*/))';
    const css = `.fixture { /* cinder-z-index-local: test. */ z-index: ${expression}; }`;
    const [warning] = warnings(await lint(css));
    expect(warning?.text).toContain('Offending expression: `calc(9999/*comment*/)`');
  });

  test('maps a too-complex fallback range through escaped astral code points', async () => {
    const deepStaticMath = `${'min('.repeat(513)}1${')'.repeat(513)}`;
    const expression = `calc(\\1f600 + var(--x, ${deepStaticMath}))`;
    const css = `.fixture { /* cinder-z-index-local: test. */ z-index: ${expression}; }`;
    const [warning] = warnings(await lint(css));
    const start = sourceLocation(css, css.indexOf(expression));
    const end = sourceLocation(css, css.indexOf(expression) + expression.length);
    expect(warning?.line).toBe(start.line);
    expect(warning?.column).toBe(start.column);
    expect(warning?.endLine).toBe(end.line);
    expect(warning?.endColumn).toBe(end.column);
    expect(warning?.text).toContain('too complex to verify');
  });

  test('anchors fallback warnings correctly when the declaration value starts with a leading comment', async () => {
    const css =
      '.fixture { /* cinder-z-index-local: test. */ z-index: /* leading comment */ var(--x, 9999); }';
    const result = await lint(css);
    const [warning] = warnings(result);
    expect(warning?.column).toBe(css.lastIndexOf('9999') + 1);
    expect(warning?.endColumn).toBe(css.lastIndexOf('9999') + 5);
    expect(warning?.text).toContain('Offending expression: `9999`');
  });

  test('preserves warning anchoring when masked inline comments contain form-feed characters', async () => {
    const css =
      '.fixture { /* cinder-z-index-local: test. */ z-index: calc(0 + var(--x/*\\f*/, 9999)); }'.replace(
        '\\f',
        '\f',
      );
    const result = await lint(css);
    const [warning] = warnings(result);
    expect(warning?.column).toBe(css.lastIndexOf('9999') + 1);
    expect(warning?.endColumn).toBe(css.lastIndexOf('9999') + 5);
  });

  test('shows the original commented fallback in the diagnostic message', async () => {
    const fallback = 'calc(10000 /* keep this context */ - 1)';
    const css = `.fixture { /* cinder-z-index-local: test. */ z-index: var(--x, ${fallback}); }`;
    const [warning] = warnings(await lint(css));

    expect(warning?.text).toContain(`Offending expression: \`${fallback}\``);
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

  test.each(['\n', '\r', '\f', '\r\n'])(
    'does not join an identifier across a backslash-newline sequence: %j',
    async (newline) => {
      const result = await lint(`
        .fixture {
          /* cinder-z-index-local: backslash-newline is not an identifier escape. */
          z-index: va\\${newline}r(--inner, -1);
        }
      `);

      expect(warnings(result)).toEqual([]);
    },
  );

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

  test('reuses unresolved classification across sole-child fallback chains', async () => {
    let nestedFallback = `calc(${'-'.repeat(50_000)}9999)`;
    for (let depth = 0; depth < 1_000; depth += 1)
      nestedFallback = `var(--item-layer-${depth}, ${nestedFallback})`;

    const startedAt = performance.now();
    const result = await lint(`
      .fixture {
        /* cinder-z-index-local: repeated wrappers must reuse unresolved classification. */
        z-index: ${nestedFallback};
      }
    `);

    expect(warnings(result)).toEqual([]);
    expect(performance.now() - startedAt).toBeLessThan(2_000);
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

  test('leaves long invalid unary-sign chains unresolved without excessive work', async () => {
    const unarySigns = '-'.repeat(50_000);
    const startedAt = performance.now();
    const result = await lint(`
      .fixture {
        /* cinder-z-index-local: invalid generated syntax can remain unused. */
        z-index: var(--item-layer, calc(${unarySigns}9999));
      }
    `);

    expect(warnings(result)).toEqual([]);
    expect(performance.now() - startedAt).toBeLessThan(2_000);
  });

  test('bounds associative symbolic identity normalization', async () => {
    const { analyzeStaticLayerValue } = await import(valueAnalysisPath);
    const terms = Array.from({ length: 2_000 }, (_, index) => `max(1em, ${index}px) / 1rem`);
    const startedAt = performance.now();

    expect(analyzeStaticLayerValue(`calc(${terms.join(' + ')})`)).toEqual({
      classification: 'too-complex',
      resultType: 'too-complex',
    });
    expect(performance.now() - startedAt).toBeLessThan(2_000);
  });

  test('bounds variadic symbolic identity normalization', async () => {
    const { analyzeStaticLayerValue } = await import(valueAnalysisPath);
    const arguments_ = Array.from({ length: 140_000 }, (_, index) =>
      index % 2 === 0 ? '1em' : '1rem',
    );
    const startedAt = performance.now();

    expect(analyzeStaticLayerValue(`max(${arguments_.join(',')})`)).toEqual({
      classification: 'too-complex',
      resultType: 'too-complex',
    });
    expect(performance.now() - startedAt).toBeLessThan(2_000);
  });

  test.each([
    '--9999',
    '++++9999',
    '+- -9999',
    '+-+1',
    '-+9999',
    '- 9999',
    '+ 9999',
    '-(9999)',
    '+calc(9999)',
  ])('does not evaluate an invalid unary-sign expression: %s', async (expression) => {
    const result = await lint(`
        .fixture {
          /* cinder-z-index-local: the invalid fallback can remain unused. */
          z-index: var(--item-layer, calc(${expression}));
        }
      `);

    expect(warnings(result)).toEqual([]);
  });

  test.each(['+9999', '-1', '-infinity'])(
    'continues evaluating a valid signed numeric token: %s',
    async (expression) => {
      const result = await lint(`
        .fixture {
          /* cinder-z-index-local: valid signed values remain subject to the policy. */
          z-index: var(--item-layer, calc(${expression}));
        }
      `);

      expect(warnings(result)).toHaveLength(1);
    },
  );

  test('reduces wide min, max, and hypot fallbacks without argument-limit bypasses', async () => {
    const repeatedArguments = 130_000;
    for (const [functionName, repeatedValue] of [
      ['min', '10000'],
      ['max', '0'],
      ['hypot', '0'],
    ] as const) {
      const value = `${functionName}(9999${`, ${repeatedValue}`.repeat(repeatedArguments)})`;
      const result = await lint(`
        .fixture {
          /* cinder-z-index-local: wide generated math still resolves to the banned layer. */
          z-index: var(--item-layer, ${value});
        }
      `);
      const [warning] = warnings(result);
      expect(warning).toBeDefined();
      expect(warning?.text.length).toBeLessThan(1_024);
      expect(warning?.text).toContain('Offending expression:');
      expect(warning?.text).toContain('…');
    }
  });

  test('bounds cumulative work for mixed substitution and calc nesting', async () => {
    let nestedFallback = '1';
    for (let depth = 0; depth < 2_000; depth += 1)
      nestedFallback = `var(--item-layer, calc(${nestedFallback} + 0))`;

    const result = await lint(`
      .fixture {
        /* cinder-z-index-local: excessive generated analysis fails closed. */
        z-index: ${nestedFallback};
      }
    `);
    const [warning] = warnings(result);
    expect(warning).toBeDefined();
    expect(warning?.text).toContain('too complex to verify');
    expect(warning?.text).not.toContain('must not contain a banned z-index');
  });

  test('reports static-depth exhaustion as too complex instead of proven banned', async () => {
    const deepStaticMath = `${'min('.repeat(513)}1${')'.repeat(513)}`;
    const [warning] = warnings(
      await lint(`
        .fixture {
          /* cinder-z-index-local: excessive static depth must fail closed accurately. */
          z-index: var(--item-layer, ${deepStaticMath});
        }
      `),
    );

    expect(warning).toBeDefined();
    expect(warning?.text).toContain('too complex to verify');
    expect(warning?.text).not.toContain('must not contain a banned z-index');
  });

  test('does not count parentheses inside an unquoted URL token as static expression depth', async () => {
    const urlParentheses = `url(${'('.repeat(513)})`;
    const result = await lint(`
      .fixture {
        /* cinder-z-index-local: URL contents are opaque to static math analysis. */
        z-index: var(--outer, ${urlParentheses});
      }
    `);

    expect(warnings(result)).toEqual([]);
  });

  test.each([
    '#var(--runtime)',
    '@var(--runtime)',
    '#env(runtime)',
    '@env(runtime)',
    '#attr(data-runtime)',
    '@attr(data-runtime)',
  ])('does not treat a CSS name token as a runtime substitution: %s', async (lookalike) => {
    const tooDeepToClassify = `${'calc(1 + '.repeat(520)}${lookalike}${')'.repeat(520)}`;
    const result = await lint(`
      .fixture {
        /* cinder-z-index-local: token lookalikes cannot bypass fail-closed analysis. */
        z-index: ${tooDeepToClassify};
      }
    `);

    expect(warnings(result)).toHaveLength(1);
  });

  test('bounds cumulative output for repeated mixed fallback branches', async () => {
    let repeatedFallback = '1';
    for (let depth = 0; depth < 16; depth += 1)
      repeatedFallback = `var(--item-layer, calc(${repeatedFallback} + ${repeatedFallback}))`;

    const result = await lint(`
      .fixture {
        /* cinder-z-index-local: excessive generated analysis fails closed. */
        z-index: ${repeatedFallback};
      }
    `);
    expect(warnings(result)).toHaveLength(1);
  });

  test('returns an exhausted wide fallback analysis before quadratic sibling scans', async () => {
    const siblings = Array.from(
      { length: 8_000 },
      (_, index) => `var(--item-layer-${index}, -1)`,
    ).join(' + ');
    const startedAt = performance.now();
    const result = await lint(`
      .fixture {
        /* cinder-z-index-local: exhausted generated analysis must fail closed promptly. */
        z-index: var(--outer, ${siblings});
      }
    `);

    expect(warnings(result)).toHaveLength(1);
    expect(performance.now() - startedAt).toBeLessThan(2_000);
  });

  test('indexes wide additive terms without rescanning every fallback child', async () => {
    const { bannedFallback } = await import(fallbackAnalysisPath);
    const terms = [
      'var(--item-layer, -1) * 1px',
      ...Array.from({ length: 32_000 }, (_, index) => `var(--runtime-${index}) * 1px`),
    ];
    const startedAt = performance.now();

    bannedFallback(`calc(${terms.join(' + ')})`);
    expect(performance.now() - startedAt).toBeLessThan(2_000);
  });

  test('bounds static max-floor scans with an unresolved wide sibling set', async () => {
    const siblings = Array.from(
      { length: 64_000 },
      (_, index) => `var(--item-layer-${index}, -1)`,
    ).join(', ');
    const startedAt = performance.now();
    const result = await lint(`
      .fixture {
        /* cinder-z-index-local: unresolved generated max arguments must fail closed promptly. */
        z-index: max(var(--runtime), ${siblings});
      }
    `);

    expect(warnings(result)).toHaveLength(1);
    expect(performance.now() - startedAt).toBeLessThan(2_000);
  });

  test('builds wide clamp placeholders in linear time', async () => {
    const siblings = Array.from(
      { length: 64_000 },
      (_, index) => `var(--item-layer-${index}, -1)`,
    ).join(' + ');
    const startedAt = performance.now();
    const result = await lint(`
      .fixture {
        /* cinder-z-index-local: static clamp bounds keep every generated fallback safe. */
        z-index: clamp(0, calc(var(--runtime) + ${siblings}), 1);
      }
    `);

    expect(warnings(result)).toEqual([]);
    expect(performance.now() - startedAt).toBeLessThan(2_000);
  });

  test('reuses parenthesis indexes across nested bound checks', async () => {
    let nestedValue = 'var(--runtime)';
    for (let depth = 0; depth < 2_400; depth += 1)
      nestedValue =
        `var(--outer-${depth}, ` +
        `max(0, var(--bad-${depth}, -1), var(--runtime-${depth}), ${nestedValue}))`;

    const startedAt = performance.now();
    const result = await lint(`
      .fixture {
        /* cinder-z-index-local: nested static floors keep each negative fallback safe. */
        z-index: ${nestedValue};
      }
    `);

    expect(warnings(result)).toEqual([]);
    expect(performance.now() - startedAt).toBeLessThan(2_000);
  });

  test('unwraps deeply nested calc containers in linear time for safe-bound analysis', async () => {
    const depth = 16_000;
    const nestedValue = `${'calc('.repeat(depth)}max(var(--runtime), var(--inner, -1), 0)${')'.repeat(depth)}`;
    const startedAt = performance.now();
    const result = await lint(`
      .fixture {
        /* cinder-z-index-local: the static max floor keeps the negative fallback safe. */
        z-index: ${nestedValue};
      }
    `);

    expect(warnings(result)).toEqual([]);
    expect(performance.now() - startedAt).toBeLessThan(2_000);
  });

  test('bounds nested zero-product factor analysis with unresolved runtime substitutions', async () => {
    let nestedProduct = 'var(--runtime)';
    for (let index = 0; index < 4_000; index += 1)
      nestedProduct = `var(--item-${index}, -1) * (${nestedProduct})`;
    const startedAt = performance.now();
    const result = await lint(`
      .fixture {
        /* cinder-z-index-local: generated products must fail closed without quadratic scans. */
        z-index: var(--outer, calc(${nestedProduct}));
      }
    `);

    expect(warnings(result)).toHaveLength(1);
    expect(performance.now() - startedAt).toBeLessThan(2_000);
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

  test('cancels recognized relative and flex units but not unknown dimensions', async () => {
    for (const unit of ['rem', 'dvw', 'cqi', 'fr']) {
      const result = await lint(`
        .fixture {
          /* cinder-z-index-local: matching CSS dimensions cancel to the magic number. */
          z-index: var(--outer, calc(9999${unit} / 1${unit}));
        }
      `);
      expect(warnings(result)).toHaveLength(1);
    }

    const unknown = await lint(`
      .fixture {
        /* cinder-z-index-local: an unknown dimension makes the fallback invalid. */
        z-index: var(--outer, calc(9999quux / 1quux));
      }
    `);
    expect(warnings(unknown)).toEqual([]);
  });

  test('does not propagate nested fallback candidates through statically non-number results', async () => {
    for (const value of [
      'calc(var(--inner, -1) * 1px)',
      'var(--outer, calc(var(--inner, 9999) * 1deg))',
      'var(--outer, calc(var(--inner, -1px) + 0px))',
      'var(--outer, calc(var(--inner, -1) / 1px))',
    ]) {
      const result = await lint(`
        .fixture {
          /* cinder-z-index-local: the selected fallback has a non-number result. */
          z-index: ${value};
        }
      `);

      expect(warnings(result)).toEqual([]);
    }

    for (const value of [
      'calc(var(--inner, -1) * 1px / 1px)',
      'var(--outer, calc(var(--inner, 9999px) / 1px))',
      'var(--outer, calc(var(--inner, -1) * 1rem / 1em))',
      'var(--outer, calc(var(--inner, 9999) * 1px / 1rem))',
    ]) {
      const result = await lint(`
        .fixture {
          /* cinder-z-index-local: matching dimensions cancel to a banned number. */
          z-index: ${value};
        }
      `);

      expect(warnings(result)).toHaveLength(1);
    }

    const runtimeSibling = await lint(`
      .fixture {
        /* cinder-z-index-local: a runtime sibling can still make the selected fallback numeric. */
        z-index: var(--outer, calc(var(--inner, -1) * var(--unit, 1px)));
      }
    `);
    expect(warnings(runtimeSibling)).toHaveLength(1);

    for (const value of [
      'var(--outer, calc(var(--inner, -1) * 1px + var(--runtime)))',
      'var(--outer, calc(var(--inner, 9999) * 1px + var(--runtime)))',
      'var(--outer, calc(1px + var(--inner, -1)))',
    ]) {
      const result = await lint(`
        .fixture {
          /* cinder-z-index-local: a proven non-number additive term fixes the result type. */
          z-index: ${value};
        }
      `);

      expect(warnings(result)).toEqual([]);
    }

    const enclosingCancellation = await lint(`
      .fixture {
        /* cinder-z-index-local: enclosing division can still cancel the additive result type. */
        z-index: var(--outer, calc((var(--inner, -1) * 1px + var(--runtime)) / 1px));
      }
    `);
    expect(warnings(enclosingCancellation)).toHaveLength(1);

    const nestedEnclosingCancellation = await lint(`
      .fixture {
        /* cinder-z-index-local: a nested typed fallback can become numeric in its parent. */
        z-index: var(--outer, calc(var(--middle, var(--inner, -1) * 1px) / 1px + var(--runtime)));
      }
    `);
    expect(warnings(nestedEnclosingCancellation)).toHaveLength(1);

    for (const value of [
      'var(--outer, calc(var(--length, 1px) + var(--inner, -1)))',
      'var(--outer, calc(var(--length, 1px) + var(--inner, 9999)))',
    ]) {
      const result = await lint(`
        .fixture {
          /* cinder-z-index-local: another fallback term may be runtime-defined as scalar. */
          z-index: ${value};
        }
      `);

      expect(warnings(result)).toHaveLength(1);
    }
  });

  test('cancels an identical compatible-length sum without inventing conversion values', async () => {
    const identicalSum = await lint(`
      .fixture {
        /* cinder-z-index-local: the identical runtime-dependent length factors cancel exactly. */
        z-index: var(--outer, calc(9999 * (1px + 1em) / (1px + 1em)));
      }
    `);
    expect(warnings(identicalSum)).toHaveLength(1);

    const commutedSum = await lint(`
      .fixture {
        /* cinder-z-index-local: compatible addition is commutative before exact cancellation. */
        z-index: var(--outer, calc(9999 * (1px + 1em) / (1em + 1px)));
      }
    `);
    expect(warnings(commutedSum)).toHaveLength(1);

    const regroupedSum = await lint(`
      .fixture {
        /* cinder-z-index-local: associative regrouping still describes the same exact length sum. */
        z-index: var(--outer, calc(9999 * (1px + (1em + 1rem)) / ((1px + 1em) + 1rem)));
      }
    `);
    expect(warnings(regroupedSum)).toHaveLength(1);

    const regroupedLikeUnits = await lint(`
      .fixture {
        /* cinder-z-index-local: like-unit coefficients survive associative regrouping. */
        z-index: var(--outer, calc(9999 * ((1em + 1em) + 1rem) / (1em + (1em + 1rem))));
      }
    `);
    expect(warnings(regroupedLikeUnits)).toHaveLength(1);

    const combinedLikeUnits = await lint(`
      .fixture {
        /* cinder-z-index-local: an equivalent written coefficient cancels the regrouped sum. */
        z-index: var(--outer, calc(9999 * (2em + 1rem) / (1em + (1em + 1rem))));
      }
    `);
    expect(warnings(combinedLikeUnits)).toHaveLength(1);

    const differentSum = await lint(`
      .fixture {
        /* cinder-z-index-local: different mixed-unit sums have an unknown numeric ratio. */
        z-index: var(--outer, calc(9999 * (1px + 1em) / (1px + 2em)));
      }
    `);
    expect(warnings(differentSum)).toEqual([]);
  });

  test('reports relative-unit sign ranges that can reach a banned layer', async () => {
    for (const [fallback, warningCount] of [
      ['calc(9998 + sign(1em))', 1],
      ['calc(9998 + sign(calc(1em)))', 1],
      ['calc(9998 + sign((1em)))', 1],
      ['calc(9998 + sign(-1em))', 0],
      ['calc(9998 + sign(0em))', 0],
    ] as const) {
      const result = await lint(`
        .fixture {
          /* cinder-z-index-local: only conversion-independent sign ranges are classified. */
          z-index: var(--outer, ${fallback});
        }
      `);

      expect(warnings(result)).toHaveLength(warningCount);
    }

    const safeBound = await lint(`
      .fixture {
        /* cinder-z-index-local: a zero relative unit can preserve the negative fallback. */
        z-index: var(--outer, max(var(--inner, -1), calc(sign(1em) - 1)));
      }
    `);
    expect(warnings(safeBound)).toHaveLength(1);

    const correlatedSigns = await lint(`
      .fixture {
        /* cinder-z-index-local: identical sign calls share one runtime endpoint. */
        z-index: var(--outer, calc(sign(1em) - sign(1em)));
      }
    `);
    expect(warnings(correlatedSigns)).toEqual([]);

    const { analyzeStaticLayerValue, evaluateStaticLayerNumber } = await import(valueAnalysisPath);
    expect(analyzeStaticLayerValue('calc(9998 + sign(1%))')).toEqual({
      classification: 'unresolved',
      resultType: 'number',
    });
    expect(evaluateStaticLayerNumber('sign(1em)')).toBeUndefined();
  });

  test.each(['max', 'min', 'hypot'])(
    'cancels commuted mixed-unit %s arguments without inventing conversion values',
    async (functionName) => {
      const result = await lint(`
        .fixture {
          /* cinder-z-index-local: commutative functions preserve an exact symbolic identity. */
          z-index: var(--outer, calc(9999 * ${functionName}(1em, 1px) / ${functionName}(1px, 1em)));
        }
      `);

      expect(warnings(result)).toHaveLength(1);
    },
  );

  test('keeps distinct round strategies symbolically independent', async () => {
    const { analyzeStaticLayerValue } = await import(valueAnalysisPath);

    expect(
      analyzeStaticLayerValue('calc(1 - round(up, 1em, 1px) / round(down, 1em, 1px))'),
    ).toEqual({ classification: 'unresolved', resultType: 'number' });
    expect(analyzeStaticLayerValue('calc(1 - round(nearest, 1em, 1px) / round(1em, 1px))')).toEqual(
      { classification: 'safe', resultType: 'number' },
    );
  });

  test.each([
    'calc(9999\\70 x / 1px)',
    'calc(9999\\70x / 1px)',
    'calc(9999\\000070x / 1px)',
    'calc(9999p\\78 / 1px)',
    'calc(9999\\72 em / 1rem)',
    'calc(9999\\63 m / 1cm)',
  ])('decodes a recognized escaped dimension unit: %s', async (fallback) => {
    const result = await lint(`
      .fixture {
        /* cinder-z-index-local: matching escaped dimensions cancel to the magic number. */
        z-index: var(--outer, ${fallback});
      }
    `);

    expect(warnings(result)).toHaveLength(1);
  });

  test.each(['calc(9999\\31 / 1px)', 'calc(9999q\\75ux / 1quux)', 'calc(9999\\65 0)'])(
    'keeps an unknown escaped dimension unresolved: %s',
    async (fallback) => {
      const result = await lint(`
      .fixture {
        /* cinder-z-index-local: the escaped dimension is not a recognized CSS unit. */
        z-index: var(--outer, ${fallback});
      }
    `);

      expect(warnings(result)).toEqual([]);
    },
  );

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

  test('preserves escaped whitespace as part of a layer-token identifier', async () => {
    for (const value of [
      'var(--cinder-z-popover\\20 )',
      'var(--cinder-z-\\20 popover)',
      'var(--cinder-z-popover\\9 )',
    ]) {
      const result = await lint(`
        .fixture {
          /* cinder-z-index-local: this is a distinct undeclared token. */
          z-index: ${value};
        }
      `);
      expect(warnings(result)).toHaveLength(1);
    }

    expect(warnings(await lint('.fixture { z-index: var( --cinder-z-popover ); }'))).toEqual([]);
    const fallback = warnings(
      await lint('.fixture { z-index: var(--cinder-z-popover\\20 , 9999); }'),
    );
    expect(fallback).toHaveLength(1);
    expect(fallback[0]?.text).toContain('must not have a fallback');
  });

  test.each(['\\[x', '\\5b x', '\\*x'])(
    'preserves escaped punctuation in a scale-prefixed token name: %s',
    async (suffix) => {
      const undeclared = await lint(`
        .fixture {
          /* cinder-z-index-local: escaped punctuation remains part of the identifier. */
          z-index: var(--cinder-z-popover${suffix});
        }
      `);
      expect(warnings(undeclared)).toHaveLength(1);

      const fallback = warnings(
        await lint(`.fixture { z-index: var(--cinder-z-popover${suffix}, 1100); }`),
      );
      expect(fallback).toHaveLength(1);
      expect(fallback[0]?.text).toContain('must not have a fallback');
    },
  );

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
    'calc(var(--item-layer, 10000 - 1) + 1)',
    'var(--item-layer, mod(1, 10000))',
    'var(--item-layer, rem(1, 10000))',
    'var(--item-layer, mod(1, infinity))',
    'var(--item-layer, rem(1, infinity))',
    'var(--item-layer, mod(9999, -infinity))',
    'var(--item-layer, mod(-9999, infinity))',
    'var(--item-layer, round(nearest, 1.4, 1))',
    'var(--item-layer, round(1.4))',
    'var(--item-layer, round(down, 9998.5, -1))',
    'var(--item-layer, round(to-zero, 9998.5, -1))',
    'var(--item-layer, round(nearest, -9999, infinity))',
    'var(--item-layer, round(up, -9999, infinity))',
    'var(--item-layer, round(down, 9999, infinity))',
    'var(--item-layer, pow(1, 1))',
    'var(--item-layer, sqrt(1))',
    'var(--item-layer, min(1, 2))',
    'var(--item-layer, max(1, 0))',
    'var(--item-layer, clamp(none, 1, 10000))',
    'var(--item-layer, clamp(0, 1, none))',
    'var(--item-layer, hypot(1, 0))',
    'var(--item-layer, calc(1 * sin(pi / 2)))',
    'var(--item-layer, calc(1 / sin(-0)))',
    'var(--item-layer, calc(1 / tan(-0)))',
    'var(--item-layer, calc(1 / sin(-0 * 1)))',
    'var(--item-layer, calc(1 / tan(-0 / 1)))',
    'var(--item-layer, calc(1 / rem(-0, 1)))',
    'var(--item-layer, calc(1 / round(nearest, -0, 1)))',
    'var(--item-layer, exp(log(1)))',
    'var(--item-layer, calc(1 * progress(1, 0, 1)))',
    'var(--item-layer, calc(9999 * progress(-1, 0, 1)))',
    'var(--item-layer, calc(9999 * progress(2, 1, 0)))',
    'var(--item-layer, calc(9999 * progress(0, 1, 1)))',
    'max(var(--item-layer, -1), var(--dynamic, 0), 0)',
    'max(var(--item-layer, -1), var(--dynamic, -2), 0)',
    'max(var(--item-layer, -1), var(--dynamic), 0)',
    'calc(max(var(--item-layer, -1), var(--dynamic, -2), 0))',
    'var(--item-layer, \\39 999)',
    'var(--item-layer, \\39 998)',
    'var(--item-layer, calc(asin(1) / 90deg))',
    'var(--item-layer, calc(atan2(0, 1) / 90deg))',
    'var(--item-layer, calc(9999.))',
    'var(--item-layer, calc(9999.e1))',
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

  test.each([
    'calc(10000-1)',
    'calc(10000 -1)',
    'calc(10000- 1)',
    'calc(10000/**/-/**/1)',
    'calc(9998+1)',
    'min(10000-1, 10000)',
  ])('does not evaluate an invalid unspaced additive expression: %s', async (fallback) => {
    expect(
      warnings(
        await lint(`
          .fixture {
            /* cinder-z-index-local: the invalid fallback can remain unused. */
            z-index: var(--outer, ${fallback});
          }
        `),
      ),
    ).toEqual([]);
  });

  test.each([
    'var(--inner, -1) 0',
    '0 var(--inner, -1)',
    'var(--inner, 9999) safe',
    'calc(var(--inner, -1) 0)',
    'calc(var(--inner, 9999) 0)',
  ])(
    'does not propagate a candidate through an invalid adjacent token stream: %s',
    async (fallback) => {
      expect(
        warnings(
          await lint(`
          .fixture {
            /* cinder-z-index-local: an invalid fallback can remain unused. */
            z-index: var(--outer, ${fallback});
          }
        `),
        ),
      ).toEqual([]);
    },
  );

  test.each(['calc(rgb(var(--inner, -1) + 0))', 'calc(hsl(var(--inner, 9999) + 0 0% 0%))'])(
    'resets math grammar inside a nested non-math function: %s',
    async (fallback) => {
      expect(
        warnings(
          await lint(`
          .fixture {
            /* cinder-z-index-local: invalid non-math operators cannot produce a layer. */
            z-index: var(--outer, ${fallback});
          }
        `),
        ),
      ).toEqual([]);
    },
  );

  test.each([
    'calc(#rgb(var(--inner, -1) + 0))',
    'calc(@rgb(var(--inner, 9999) + 0))',
    'calc(#rgb(var(--inner, -1)))',
    'calc(@rgb(var(--inner, 9999)))',
    'calc(rgb(var(--inner, -1)))',
  ])('does not inherit math grammar through a prefixed token block: %s', async (fallback) => {
    expect(
      warnings(
        await lint(`
          .fixture {
            /* cinder-z-index-local: a prefixed token block is not a math function. */
            z-index: var(--outer, ${fallback});
          }
        `),
      ),
    ).toEqual([]);
  });

  test.each([
    'calc(var(--inner, -1), 0)',
    'calc(0, var(--inner, 9999))',
    'calc(0, var(--inner, -1), 1)',
    'var(--inner, -1), 0',
  ])(
    'does not propagate a fallback through an invalid comma-separated expression: %s',
    async (fallback) => {
      expect(
        warnings(
          await lint(`
          .fixture {
            /* cinder-z-index-local: calc accepts one calculation, not an argument list. */
            z-index: var(--outer, ${fallback});
          }
        `),
        ),
      ).toEqual([]);
    },
  );

  test('does not propagate a fallback through a direct top-level comma stream', async () => {
    expect(
      warnings(
        await lint(`
          .fixture {
            /* cinder-z-index-local: a comma is invalid in the top-level z-index grammar. */
            z-index: var(--inner, -1), 0;
          }
        `),
      ),
    ).toEqual([]);
  });

  test.each(['calc(var(--inner, -1), 0)', 'calc((var(--inner, -1), 0))'])(
    'does not propagate a fallback through a direct invalid math comma stream: %s',
    async (value) => {
      expect(
        warnings(
          await lint(`
            .fixture {
              /* cinder-z-index-local: calc and grouping accept one calculation. */
              z-index: ${value};
            }
          `),
        ),
      ).toEqual([]);
    },
  );

  test.each([
    'var(1, -1)',
    'var(foo, 9999)',
    'var(--x extra, -1)',
    'env(1 bad, 9999)',
    'attr(1 bad, -1)',
    'env(inherit, -1)',
    'env(INITIAL, 9999)',
    'env(unset, -1)',
    'env(revert, 9999)',
    'env(revert-layer, -1)',
    'env(default, 9999)',
    'env(foo + 1, -1)',
    'attr(data-layer type(<integer), -1)',
  ])('does not propagate a fallback from an invalid substitution header: %s', async (fallback) => {
    expect(
      warnings(
        await lint(`
          .fixture {
            /* cinder-z-index-local: the malformed nested substitution can remain unused. */
            z-index: var(--outer, ${fallback});
          }
        `),
      ),
    ).toEqual([]);
  });

  test.each([
    'var(--inner/**/, -1)',
    'env(viewport-segment-width 0 0, 9999)',
    'env(foo +1, -1)',
    'attr(data-layer px, -1)',
    'attr(data-layer number, 9999)',
    'attr(data-layer unknown-unit, -1)',
    'attr(data-layer raw-string, -1)',
    'attr(data-layer type(<integer>), 9999)',
  ])('continues inspecting a fallback from a valid substitution header: %s', async (fallback) => {
    expect(
      warnings(
        await lint(`
          .fixture {
            /* cinder-z-index-local: valid substitution fallbacks remain inspected. */
            z-index: var(--outer, ${fallback});
          }
        `),
      ),
    ).toHaveLength(1);
  });

  test.each([
    'progress(var(--inner, -1), var(--runtime), 10)',
    'max(var(--inner, -1), progress(var(--runtime), 0, 1))',
    'min(var(--inner, 9999), progress(var(--runtime), 0, 1))',
  ])('applies the safe output range of a valid progress function: %s', async (fallback) => {
    expect(
      warnings(
        await lint(`
          .fixture {
            /* cinder-z-index-local: progress constrains the resulting layer to zero through one. */
            z-index: var(--outer, ${fallback});
          }
        `),
      ),
    ).toEqual([]);
  });

  test.each([
    'progress(var(--inner, -1), 0)',
    'progress(var(--inner, 9999), 0, 1, 2)',
    'progress(no-clamp var(--inner, -1), 0, 1)',
    'progress(/**/no-clamp var(--inner, -1), 0, 1)',
    'calc(progress(var(--inner, -1), 0, 1) + var(--runtime))',
  ])(
    'does not apply a progress range proof outside a whole valid function: %s',
    async (fallback) => {
      expect(
        warnings(
          await lint(`
          .fixture {
            /* cinder-z-index-local: this expression has no independent safe output range. */
            z-index: var(--outer, ${fallback});
          }
        `),
        ),
      ).toHaveLength(1);
    },
  );

  test.each([
    'calc(-2 + progress(var(--runtime), 0, 1))',
    'calc(progress(var(--runtime), 0, 1) + 9999)',
    'calc(9999 + progress(var(--runtime), 0, 1))',
    'calc(progress(var(--runtime), 0, 1) - 9999)',
    'calc(progress(var(--runtime), 0, 1) * 9999)',
    'calc(9999 * progress(var(--runtime), 0, 1))',
  ])('propagates a valid progress range through enclosing arithmetic: %s', async (fallback) => {
    expect(
      warnings(
        await lint(`
          .fixture {
            /* cinder-z-index-local: the progress range reaches a banned layer. */
            z-index: var(--outer, ${fallback});
          }
        `),
      ),
    ).toHaveLength(1);
  });

  test('keeps a safely bounded progress expression accepted', async () => {
    expect(
      warnings(
        await lint(`
          .fixture {
            /* cinder-z-index-local: the full progress range stays within the local scale. */
            z-index: var(--outer, calc(1 + progress(var(--runtime), 0, 1)));
          }
        `),
      ),
    ).toEqual([]);
  });

  test('propagates independent progress ranges through shared arithmetic', async () => {
    expect(
      warnings(
        await lint(`
          .fixture {
            /* cinder-z-index-local: the progress corner reaches the magic layer. */
            z-index: var(--outer, calc(progress(var(--a), 0, 1) * progress(var(--b), 0, 1) * 9999));
          }
        `),
      ),
    ).toHaveLength(1);
  });

  test('keeps multiple safely bounded progress ranges accepted', async () => {
    expect(
      warnings(
        await lint(`
          .fixture {
            /* cinder-z-index-local: every progress corner stays within the local scale. */
            z-index: var(--outer, calc(1 + progress(var(--a), 0, 1) * progress(var(--b), 0, 1)));
          }
        `),
      ),
    ).toEqual([]);
  });

  test('uses a resolved fallback path when proving a progress range safe', async () => {
    expect(
      warnings(
        await lint(`
          .fixture {
            /* cinder-z-index-local: the selected fallback path stays above the magic layer. */
            z-index: var(--outer, calc(var(--inner, 9999) + 1 + progress(var(--runtime), 0, 1)));
          }
        `),
      ),
    ).toEqual([]);
  });

  test('preserves a progress-path candidate when a sibling may use its defined value', async () => {
    expect(
      warnings(
        await lint(`
          .fixture {
            /* cinder-z-index-local: the sibling runtime value can restore the magic layer. */
            z-index: var(--outer, calc(var(--inner, 9999) + 1 + var(--sibling, 0) + progress(var(--runtime), 0, 1)));
          }
        `),
      ),
    ).toHaveLength(1);
  });

  test('correlates structurally identical progress ranges', async () => {
    expect(
      warnings(
        await lint(`
          .fixture {
            /* cinder-z-index-local: identical progress values cancel to zero. */
            z-index: var(--outer, calc(progress(var(--runtime), 0, 1) - progress(var(--runtime), 0, 1)));
          }
        `),
      ),
    ).toEqual([]);
  });

  test.each([
    'calc(progress(var(--runtime), 0, 1) - progress(var(--runtime),0,1))',
    'calc(PROGRESS(var(--runtime), 0, 1) - progress(var(--runtime), 0, 1))',
    'calc(progress(VAR(--runtime), 0, 1) - progress(var(--runtime), 0, 1))',
    'calc(progress(var(--runtime), 0, 1) - progress(var(--runtime),/**/0,1))',
    'calc(progress(calc(var(--runtime)/1), 0, 1) - progress(calc(var(--runtime) / 1),0,1))',
    'calc(progress(var(--runtime) * 1, 0, 1) - progress(var(--runtime)*1,0,1))',
  ])('correlates equivalent progress token streams: %s', async (fallback) => {
    expect(
      warnings(
        await lint(`
          .fixture {
            /* cinder-z-index-local: equivalent progress values cancel to zero. */
            z-index: var(--outer, ${fallback});
          }
        `),
      ),
    ).toEqual([]);
  });

  test('keeps case-sensitive custom property progress ranges independent', async () => {
    expect(
      warnings(
        await lint(`
          .fixture {
            /* cinder-z-index-local: custom property names are case-sensitive. */
            z-index: var(--outer, calc(progress(var(--runtime), 0, 1) - progress(var(--RUNTIME), 0, 1)));
          }
        `),
      ),
    ).toHaveLength(1);
  });

  test('keeps distinct progress ranges independent', async () => {
    expect(
      warnings(
        await lint(`
          .fixture {
            /* cinder-z-index-local: independent progress values can produce a negative layer. */
            z-index: var(--outer, calc(progress(var(--left), 0, 1) - progress(var(--right), 0, 1)));
          }
        `),
      ),
    ).toHaveLength(1);
  });

  test('fails closed when a correlated progress range is reused nonlinearly', async () => {
    const result = warnings(
      await lint(`
        .fixture {
          /* cinder-z-index-local: the repeated range has an interior magic maximum. */
          z-index: var(--outer, calc(9998 + 4 * progress(var(--runtime), 0, 1) * (1 - progress(var(--runtime),0,1))));
        }
      `),
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.text).toContain('too complex to verify');
  });

  test.each([
    'calc(2 * progress(var(--runtime), 0, 1) + progress(var(--runtime),0,1))',
    'calc(progress(var(--runtime), 0, 1) / 2 + progress(var(--runtime),0,1) / 2)',
  ])('keeps repeated affine progress ranges endpoint-safe: %s', async (fallback) => {
    expect(
      warnings(
        await lint(`
          .fixture {
            /* cinder-z-index-local: static scaling preserves affine endpoint extrema. */
            z-index: var(--outer, ${fallback});
          }
        `),
      ),
    ).toEqual([]);
  });

  test.each([
    'calc(pow(progress(var(--runtime), 0, 1), 2) * 9999)',
    'calc(sin(progress(var(--runtime), 0, 1) * 2 * pi) * 9999)',
    'calc(1 / progress(var(--runtime), 0, 1))',
  ])('fails closed for a progress range inside unsupported arithmetic: %s', async (fallback) => {
    const result = warnings(
      await lint(`
        .fixture {
          /* cinder-z-index-local: unsupported range transforms cannot be assumed safe. */
          z-index: var(--outer, ${fallback});
        }
      `),
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.text).toContain('too complex to verify');
  });

  test.each([
    'max(var(--inner, -1), 9999, var(--runtime))',
    'calc(max(var(--inner, -1), 9999) * var(--runtime))',
  ])(
    'does not use the magic layer as an independently safe maximum floor: %s',
    async (fallback) => {
      expect(
        warnings(
          await lint(`
          .fixture {
            /* cinder-z-index-local: the bound itself must not introduce the magic layer. */
            z-index: var(--outer, ${fallback});
          }
        `),
        ),
      ).toHaveLength(1);
    },
  );

  test('continues using a non-magic safe maximum floor', async () => {
    expect(
      warnings(
        await lint(`
          .fixture {
            /* cinder-z-index-local: the independent floor is nonnegative and non-magic. */
            z-index: var(--outer, max(var(--inner, -1), 10000, var(--runtime)));
          }
        `),
      ),
    ).toEqual([]);
  });

  test('uses a dominant maximum floor to eliminate a magic fallback', async () => {
    expect(
      warnings(
        await lint(`
          .fixture {
            /* cinder-z-index-local: the independent floor keeps the result above magic. */
            z-index: var(--outer, max(10000, var(--inner, 9999), var(--runtime)));
          }
        `),
      ),
    ).toEqual([]);
  });

  test('does not use progress as a dominant maximum floor for a magic fallback', async () => {
    expect(
      warnings(
        await lint(`
          .fixture {
            /* cinder-z-index-local: progress reaches at most one and cannot dominate magic. */
            z-index: var(--outer, max(progress(var(--runtime), 0, 1), var(--inner, 9999), var(--sibling)));
          }
        `),
      ),
    ).toHaveLength(1);
  });

  test.each([
    'max(var(--inner, -1), 1, 9999, var(--runtime))',
    'min(var(--inner, 9999), 10000, -1, var(--runtime))',
  ])('preserves a direct banned bound sibling in unresolved math: %s', async (fallback) => {
    expect(
      warnings(
        await lint(`
          .fixture {
            /* cinder-z-index-local: one safe bound cannot erase another banned argument. */
            z-index: var(--outer, ${fallback});
          }
        `),
      ),
    ).toHaveLength(1);
  });

  test.each([
    'clamp(9999, var(--inner, 9999), progress(var(--runtime), 0, 1))',
    'clamp(progress(var(--runtime), 0, 1), var(--inner, 9999), 9999)',
  ])('preserves a magic candidate across a progress clamp endpoint: %s', async (fallback) => {
    expect(
      warnings(
        await lint(`
          .fixture {
            /* cinder-z-index-local: progress does not eliminate this reachable magic layer. */
            z-index: var(--outer, ${fallback});
          }
        `),
      ),
    ).toHaveLength(1);
  });

  test('uses a progress maximum as a safe ceiling when clamp bounds do not cross', async () => {
    expect(
      warnings(
        await lint(`
          .fixture {
            /* cinder-z-index-local: the progress maximum keeps the final layer below magic. */
            z-index: var(--outer, clamp(none, var(--inner, 9999), progress(var(--runtime), 0, 1)));
          }
        `),
      ),
    ).toEqual([]);
  });

  test('applies a dominant clamp minimum before an unresolved maximum fallback', async () => {
    expect(
      warnings(
        await lint(`
          .fixture {
            /* cinder-z-index-local: clamp precedence keeps the result above magic. */
            z-index: var(--outer, clamp(10000, var(--runtime), var(--maximum, 9999)));
          }
        `),
      ),
    ).toEqual([]);
  });

  test.each(['clamp(-1, var(--runtime), 10)', 'clamp(0, var(--runtime), 9999)'])(
    'preserves a reachable banned clamp endpoint: %s',
    async (fallback) => {
      expect(
        warnings(
          await lint(`
          .fixture {
            /* cinder-z-index-local: the runtime center can select the banned endpoint. */
            z-index: var(--outer, ${fallback});
          }
        `),
        ),
      ).toHaveLength(1);
    },
  );

  test.each(['calc(10000 - 1 + var(--runtime) * 0)', 'calc(9999 + var(--runtime) * 0)'])(
    'evaluates a math witness whose unresolved contribution is statically zero: %s',
    async (fallback) => {
      expect(
        warnings(
          await lint(`
          .fixture {
            /* cinder-z-index-local: a zeroed runtime term cannot hide the magic layer. */
            z-index: var(--outer, ${fallback});
          }
        `),
        ),
      ).toHaveLength(1);
    },
  );

  test('annihilates symbolic conversion factors in an exact zero product', async () => {
    const magicResult = await lint(`
      .fixture {
        /* cinder-z-index-local: the relative-unit product contributes exact zero. */
        z-index: var(--outer, calc(9999 + 0 * 1em / 1px));
      }
    `);
    expect(warnings(magicResult)).toHaveLength(1);

    const safeResult = await lint(`
      .fixture {
        /* cinder-z-index-local: the same zero product leaves a safe local layer. */
        z-index: var(--outer, calc(1 + 0 * 1em / 1px));
      }
    `);
    expect(warnings(safeResult)).toEqual([]);
  });

  test('fails closed when a zero-witness factor scan exhausts the shared budget', async () => {
    const fallback = `calc(9999 + var(--runtime) * 0${' '.repeat(1_000_000)})`;
    const result = warnings(
      await lint(`
        .fixture {
          /* cinder-z-index-local: exhausted zero-witness work cannot hide the magic layer. */
          z-index: var(--outer, ${fallback});
        }
      `),
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.text).toContain('too complex to verify');
  });

  test('recognizes a zero product around multiple unresolved children', async () => {
    expect(
      warnings(
        await lint(`
          .fixture {
            /* cinder-z-index-local: the unresolved group contributes zero for finite values. */
            z-index: var(--outer, calc(9999 + (var(--a) + var(--b)) * 0));
          }
        `),
      ),
    ).toHaveLength(1);
  });

  test.each([
    'calc(1 + (var(--a, -1) + var(--b, 9999)) * 0)',
    'calc((var(--a, -1) + var(--b, 9999)) * 0 + var(--runtime))',
  ])('eliminates every banned child in a grouped zero product: %s', async (fallback) => {
    expect(
      warnings(
        await lint(`
          .fixture {
            /* cinder-z-index-local: the grouped fallback contribution is statically zero. */
            z-index: var(--outer, ${fallback});
          }
        `),
      ),
    ).toEqual([]);
  });

  test.each(['calc(10000 - 1 + var(--runtime))', 'calc(10000 - 1 + var(--runtime) * 1)'])(
    'does not replace a live unresolved contribution with zero: %s',
    async (fallback) => {
      expect(
        warnings(
          await lint(`
          .fixture {
            /* cinder-z-index-local: the runtime term can change the final layer. */
            z-index: var(--outer, ${fallback});
          }
        `),
        ),
      ).toEqual([]);
    },
  );

  test.each(['calc(var(--inner, -1) + 0)', 'rgb(calc(var(--inner, -1) + 0) 0 0)'])(
    'preserves a candidate through a real math boundary: %s',
    async (fallback) => {
      expect(
        warnings(
          await lint(`
          .fixture {
            /* cinder-z-index-local: valid nested math remains inspected. */
            z-index: var(--outer, ${fallback});
          }
        `),
        ),
      ).toHaveLength(1);
    },
  );

  test('bounds invalid-token scanning across nested unresolved fallback frames', async () => {
    let fallback = 'var(--leaf, -1)';
    for (let index = 0; index < 3_000; index += 1)
      fallback = `var(--outer-${index}, rgb(var(--runtime-${index}) ${fallback} + 0))`;

    const startedAt = performance.now();
    await lint(`
      .fixture {
        /* cinder-z-index-local: generated fallbacks must remain bounded. */
        z-index: ${fallback};
      }
    `);
    expect(performance.now() - startedAt).toBeLessThan(2_000);
  });

  test.each([
    'url(var(--inner, -1))',
    'URL(var(--inner, -1))',
    'u\\72l(var(--inner, -1))',
    'url(foo var(--inner, -1))',
    'url(data:image/svg+xml,var(--inner,-1))',
    'url(var(--cinder-z-popover, 1))',
    'URL(var(--cinder-z-popover, 1))',
    'u\\72l(var(--cinder-z-popover, 1))',
    'url(data:image/svg+xml,var(--cinder-z-popover,1))',
    'url("var(--cinder-z-popover, 1)")',
    'url(foo\\)var(--cinder-z-popover, 1))',
  ])('ignores substitution-like text inside an unquoted URL token: %s', async (fallback) => {
    expect(
      warnings(
        await lint(`
          .fixture {
            /* cinder-z-index-local: the invalid fallback can remain unused. */
            z-index: var(--outer, ${fallback});
          }
        `),
      ),
    ).toEqual([]);
  });

  test('resumes fallback scanning after an unquoted URL token', async () => {
    const source =
      '.fixture { /* cinder-z-index-local: the later fallback is still banned. */ ' +
      'z-index: var(--outer, url(var(--ignored, -1)) var(--actual, -1)); }';
    const result = warnings(await lint(source));

    expect(result).toHaveLength(1);
    expect(result[0]?.text).toContain('Offending expression: `-1`');
    expect(result[0]?.column).toBe(source.lastIndexOf('-1') + 1);
  });

  test('lets a closing parenthesis in URL content terminate an unquoted URL token', async () => {
    const source =
      '.fixture { /* cinder-z-index-local: the later fallback is still banned. */ ' +
      'z-index: var(--outer, url(foo/*)*/ var(--actual, -1)); }';
    const result = warnings(await lint(source));

    expect(result).toHaveLength(1);
    expect(result[0]?.text).toContain('Offending expression: `-1`');
    expect(result[0]?.column).toBe(source.lastIndexOf('-1') + 1);
  });

  test('does not mask comment-like bytes inside an unquoted URL token', async () => {
    const result = warnings(
      await lint(`
        .fixture {
          /* cinder-z-index-local: the later undeclared layer token remains visible. */
          z-index: var(--outer, url(foo/*)*/ var(--cinder-z-undeclared));
        }
      `),
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.text).toContain('`z-index` must be `auto`, `0`, `1`');
  });

  test('resumes layer-token scanning after an unquoted URL token', async () => {
    const result = warnings(
      await lint(`
        .fixture {
          /* cinder-z-index-local: the later layer-token fallback is still forbidden. */
          z-index: var(
            --outer,
            url(var(--cinder-z-popover, 1)) var(--cinder-z-undeclared)
          );
        }
      `),
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.text).toContain('`z-index` must be `auto`, `0`, `1`');
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
