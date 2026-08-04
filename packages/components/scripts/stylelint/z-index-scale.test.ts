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

  test('charges typed hypot parents to one cumulative resolution budget', async () => {
    const source = await Bun.file(fallbackAnalysisPath).text();

    expect(source).toContain('typedHypotParents: new Set()');
    expect(source).toContain('budget.typedHypotParents.add(functionParent)');
    expect(source).toMatch(/consumeResolutionWork\(\s*budget,\s*hypotParentWork\s*\)/);
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
    for (const value of [
      'var(--cinder-z-popvoer)',
      'VAR(--cinder-z-popvoer)',
      'var(--cinder-z-unknown extra)',
      'var(--cinder-z-popover extra)',
    ]) {
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
    'var(--item-layer, calc(exp(log(9903.5)) * 19997 / 19807))',
    'var(--item-layer, calc(9999 * abs(-1em) / 1em))',
    'var(--item-layer, calc(9999 * progress(1, 0, 1)))',
    'var(--item-layer, calc(9999 * progress(2, 0, 1)))',
    'var(--item-layer, calc(9999 * progress(-1, 1, 0)))',
    'var(--item-layer, progress(no-clamp 9999, 0, 1))',
    'var(--item-layer, progress(no-clamp -1, 0, 1))',
    'var(--item-layer, progress(/**/no-clamp/**/9999, 0, 1))',
    'var(--item-layer, progress(no-clamp 0, 1, 1))',
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

  test('evaluates written and defined nested paths in their enclosing arithmetic context', async () => {
    const result = await lint(`
      .fixture {
        /* cinder-z-index-local: the written path is 1, but a defined inner value remains live. */
        z-index: var(--outer, calc(var(--inner, -1) + 2));
      }
    `);

    expect(warnings(result)).toHaveLength(1);
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

  test('accepts unresolved extrema arithmetic bounded by independent clamp limits', async () => {
    const result = await lint(`
      .fixture {
        /* cinder-z-index-local: clamp guarantees a final local layer from zero through one. */
        z-index: clamp(0, calc(max(var(--runtime), 0) + 2), 1);
      }
    `);

    expect(warnings(result)).toEqual([]);
  });

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
    ['calc(9999 * mod(var(--runtime), 2))', 1],
    ['calc(9999 * rem(var(--runtime), 2))', 1],
    ['calc(9999 * round(var(--runtime)))', 1],
    ['calc(9999 * round(var(--runtime), 2))', 1],
    ['calc(9999 * round(nearest, var(--runtime), 2))', 1],
    ['calc(9999 * round(up, var(--runtime)))', 1],
    ['calc(9999 * round(var(--runtime), -2))', 1],
    ['min(1, calc(9999 * rem(var(--runtime), 2)))', 1],
    ['calc(0 * mod(var(--runtime), 2))', 0],
    ['calc(0 * rem(var(--runtime), 2))', 0],
    ['calc(0 * round(var(--runtime)))', 0],
    ['clamp(0, calc(9999 * mod(var(--runtime), 2)), 1)', 0],
    ['min(1, calc(9999 * mod(var(--runtime), 2)))', 0],
    ['calc(9999 * mod(var(--runtime), 0))', 0],
    ['calc(9999 * rem(var(--runtime), 0))', 0],
    ['calc(9999 * mod(infinity, var(--runtime)))', 0],
    ['calc(9999 * rem(-infinity, var(--runtime)))', 0],
    ['calc(9999 * round(var(--runtime), 0))', 0],
    ['calc(9999 * mod(var(--runtime)))', 0],
    ['calc(9999 * rem(var(--runtime), 2, 3))', 0],
    ['calc(9999 * round(var(--runtime), 2, 3))', 0],
    ['calc(9999 * round(foo, var(--runtime)))', 0],
    ['calc(9999 * round(line-width, var(--runtime)))', 0],
    ['calc(9999 * mod(var(--runtime), 2px))', 0],
    ['calc(9999 * round(var(--runtime), 2px))', 0],
    ['calc(9999 * mod(var(--runtime), 2px) / 1px)', 1],
    ['calc(9999 * mod(var(--runtime), 0.2px) / 0.1px)', 1],
    ['calc(9999 * mod(var(--runtime), 0.2) / 0.1)', 1],
    ['calc(9999 * rem(var(--runtime), 2px) / 1px)', 1],
    ['calc(9999 * round(var(--runtime), 2px) / 1px)', 1],
    ['calc(9999 * mod(var(--runtime), 0px) / 1px)', 0],
    ['calc(9999 * rem(var(--runtime), 0px) / 1px)', 0],
    ['calc(9999 * round(var(--runtime), 0px) / 1px)', 0],
    ['calc(9999 * mod(1px, var(--runtime)) / 1px)', 1],
    ['calc(9999 * rem(1px, var(--runtime)) / 1px)', 1],
    ['calc(9999 * mod(var(--runtime), 2px) / 1deg)', 0],
    ['calc(0 * mod(var(--runtime), 2px) / 1px)', 0],
    ['min(1, calc(9999 * mod(var(--runtime), 2px) / 1px))', 0],
    ['clamp(0, calc(9999 * round(var(--runtime), 2px) / 1px), 1)', 0],
  ] as const)('tracks unresolved stepped-value functions: %s', async (fallback, count) => {
    expect(
      warnings(
        await lint(`
          .fixture {
            /* cinder-z-index-local: stepped-value runtime regression coverage. */
            z-index: var(--outer, ${fallback});
          }
        `),
      ),
    ).toHaveLength(count);
  });

  test.each([
    ['random(9999, 10000)', 1],
    ['random(-1, 1)', 1],
    ['calc(9999 * random(0, 1))', 1],
    ['calc(9999 * random(auto, 0, 1))', 1],
    ['calc(9999 * random(--shared, 0, 1))', 1],
    ['calc(9999 * random(--shared element-scoped, 0, 1))', 1],
    ['calc(9999 * random(fixed 0, 0, 1))', 0],
    ['calc(9999 * random(fixed .5, 0, 1))', 0],
    ['calc(9999 * random(fixed 1, 0, 1))', 1],
    ['random(var(--inner, 9999), 10000)', 1],
    ['random(0, var(--inner, 9999))', 1],
    ['random(--shared, var(--inner, 9999), 10000)', 1],
    ['random(0, 10000, 9999)', 1],
    ['calc(random(0px, 10000px, 9999px) / 1px)', 1],
    ['calc(random(0px, 10000px, 5000px) / 1px)', 0],
    ['calc(random(0px, 9999px) / 1px)', 1],
    ['calc(0 * random(0, 10000))', 0],
    ['min(1, random(0, 10000))', 0],
    ['clamp(0, random(0, 10000), 1)', 0],
    ['random(0, 1)', 0],
    ['random(10000, 9999)', 0],
    ['random(0, 9998)', 0],
    ['random(0, 10000, 10000)', 0],
    ['random(0, 10000, 10001)', 0],
    ['random(fixed 0, 0, 10000, 9999)', 0],
    ['random(fixed .5, 0, 10000, 9999)', 1],
    ['random(fixed 1, 0, 10000, 9999)', 1],
    ['random(0, 10000, infinity)', 0],
    ['random(0, 10000, 0)', 1],
    ['random(0, 10000, -1)', 1],
    ['random(infinity, 10000)', 0],
    ['random(0, infinity)', 0],
    ['random(0px, 1px)', 0],
    ['calc(random(fixed 0, 0px, 9999px) / 1px)', 0],
    ['calc(random(fixed 1, 0px, 9999px) / 1px)', 1],
    ['random(fixed .5, 10000, 9999)', 0],
    ['random()', 0],
    ['random(0)', 0],
    ['random(0, 1, 2, 3)', 0],
    ['random(0, 10000, by 1)', 0],
    ['random(50px, 180deg)', 0],
    ['random(0, 1px)', 0],
    ['random(foo, 0, 1)', 0],
    ['random(fixed 2, 0, 1)', 0],
    ['random(--shared, 0, 1, 2, 3)', 0],
  ] as const)('tracks CSS random() ranges: %s', async (fallback, count) => {
    expect(
      warnings(
        await lint(`
          .fixture {
            /* cinder-z-index-local: random() runtime regression coverage. */
            z-index: var(--outer, ${fallback});
          }
        `),
      ),
    ).toHaveLength(count);
  });

  test.each([
    ['random-item(9999, 1)', 0],
    ['random-item(auto, 9999, 1)', 1],
    ['random-item(--shared, 1, 9999)', 1],
    ['random-item(auto, {9999}, 1)', 1],
    ['random-item(auto, , 9999)', 1],
    ['random-item(auto, 1, 2)', 0],
    ['random-item(fixed 2, 9999, 1)', 0],
  ] as const)('tracks CSS random-item() choices: %s', async (fallback, count) => {
    expect(
      warnings(
        await lint(`
          .fixture {
            /* cinder-z-index-local: random-item() runtime regression coverage. */
            z-index: var(--outer, ${fallback});
          }
        `),
      ),
    ).toHaveLength(count);
  });

  test.each([
    ['calc(9999 * (random(--shared, 0, 1) - random(--shared, 0, 1)))', 0],
    ['calc(9999 * (random(--left, 0, 1) - random(--right, 0, 1)))', 1],
    ['calc(9999 * (random(0, 1) - random(0, 1)))', 1],
    [
      'calc(9999 * (random(--shared property-index-scoped, 0, 1) - random(--shared property-index-scoped, 0, 1)))',
      1,
    ],
    ['calc(9999 * (random(property-scoped, 0, 1) - random(property-scoped, 0, 1)))', 0],
    ['calc(9999 * (random(--shared, 0, 1) - random(--shared, 0, 2) / 2))', 0],
    ['calc(9999 * (random(--shared, 0, 1) - random(--shared, 0, 2)))', 1],
    ['calc(9999 * (random-item(--shared, 0, 1) - random-item(--shared, 0, 1)))', 0],
    ['calc(9999 * (random-item(--left, 0, 1) - random-item(--right, 0, 1)))', 1],
  ] as const)('correlates CSS random functions by cache key: %s', async (fallback, count) => {
    expect(
      warnings(
        await lint(`
          .fixture {
            /* cinder-z-index-local: shared random caches reuse one base value. */
            z-index: var(--outer, ${fallback});
          }
        `),
      ),
    ).toHaveLength(count);
  });

  test('fails closed for nonlinear reuse of a continuous random cache', async () => {
    const [warning] = warnings(
      await lint(`
        .fixture {
          /* cinder-z-index-local: nonlinear shared random output needs a complete range proof. */
          z-index: var(--outer, calc(4 * random(--shared, 0, 1) * (1 - random(--shared, 0, 1)) * 9999));
        }
      `),
    );

    expect(warning?.text).toContain('too complex to verify safely');
  });

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

  test.each(['-pi', '+pi', '-e', '+e', '-nan', '+nan', '+infinity'])(
    'discards nested candidates after the invalid signed calc keyword %s',
    async (keyword) => {
      const result = await lint(`
        .fixture {
          /* cinder-z-index-local: only -infinity is a signed calc keyword. */
          z-index: var(--outer, calc(${keyword} + var(--inner, -1)));
        }
      `);

      expect(warnings(result)).toEqual([]);
    },
  );

  test.each(['max(var(--inner, -1), / 1)', 'round(var(--inner, 9999), 1px, 2px)'])(
    'preserves a nested candidate from malformed recognized math: %s',
    async (fallback) => {
      const result = await lint(`
        .fixture {
          /* cinder-z-index-local: malformed math cannot prove a nested fallback safe. */
          z-index: var(--outer, ${fallback});
        }
      `);

      expect(warnings(result)).toHaveLength(1);
    },
  );

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
    ['up', '-0.4', 1],
    ['nearest', '-0.4', 1],
  ] as const)(
    'preserves written fallback and defined-path evidence through unresolved round(%s): %s',
    async (strategy, fallback, warningCount) => {
      const result = await lint(`
        .fixture {
          /* cinder-z-index-local: runtime zero preserves the written path; a defined value remains live. */
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

  test.each([
    ['`', '``'],
    ['``', '```'],
  ] as const)(
    'uses a Markdown code-span delimiter longer than embedded backticks: %s',
    async (backticks, delimiter) => {
      const deepStaticMath = `${'min('.repeat(513)}1${')'.repeat(513)}`;
      const fallback = `calc(var(--runtime, "${backticks}") + ${deepStaticMath})`;
      const css = `.fixture { /* cinder-z-index-local: test. */ z-index: var(--x, ${fallback}); }`;
      const [warning] = warnings(await lint(css));

      expect(warning?.text).toContain(
        `Offending expression: ${delimiter}var(--x, calc(var(--runtime, "${backticks}") + min(`,
      );
      expect(warning?.text).toContain(`…${delimiter}.`);
    },
  );

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

  test('anchors fallback warnings after leading declaration-value whitespace', async () => {
    const css = '.fixture { /* cinder-z-index-local: test. */ z-index:\t  var(--x, 9999); }';
    const [warning] = warnings(await lint(css));
    const fallbackIndex = css.lastIndexOf('9999');
    const start = sourceLocation(css, fallbackIndex);
    const end = sourceLocation(css, fallbackIndex + 4);

    expect(warning?.column).toBe(start.column);
    expect(warning?.endColumn).toBe(end.column);
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
    const { analyzeStaticLayerValue, haveCompatibleStaticDivisionTypes } = await import(
      valueAnalysisPath
    );
    const terms = Array.from({ length: 2_000 }, (_, index) => `max(1em, ${index}px) / 1rem`);
    const expression = `calc(${terms.join(' + ')})`;
    const startedAt = performance.now();

    expect(analyzeStaticLayerValue(expression)).toEqual({
      classification: 'too-complex',
      resultType: 'too-complex',
    });
    expect(haveCompatibleStaticDivisionTypes('0', expression)).toBe(true);
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

  test('merges wide progress degree maps without quadratic cloning', async () => {
    const { bannedFallback } = await import(fallbackAnalysisPath);
    const progressTerms = Array.from(
      { length: 20_000 },
      (_, index) => `progress(var(--runtime-${index}), 0, 1)`,
    );
    const startedAt = performance.now();
    const result = bannedFallback(`calc(${progressTerms.join(' + ')} + ${progressTerms[0]})`);

    expect(result === undefined || result.reason === 'too-complex').toBe(true);
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

  test('bounds exact rational growth in a long decimal product', async () => {
    const { bannedFallback } = await import(fallbackAnalysisPath);
    const product = Array.from({ length: 5_000 }, () => '1.001').join(' * ');
    const startedAt = performance.now();
    const result = bannedFallback(`var(--outer, calc(${product}))`);

    expect(result?.reason).toBe('too-complex');
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

  test('indexes nearest math parents for deeply nested unresolved substitutions', async () => {
    const { bannedFallback } = await import(fallbackAnalysisPath);
    const depth = 16_000;
    const nestedRuntime = `${'calc('.repeat(depth)}var(--runtime)${')'.repeat(depth)}`;
    const startedAt = performance.now();
    const result = bannedFallback(`var(--outer, calc(hypot(1px, ${nestedRuntime}) / 1px))`);

    expect(result?.reason).toBe('too-complex');
    expect(performance.now() - startedAt).toBeLessThan(2_000);
  });

  test('indexes typed hypot parents across wide additive expressions', async () => {
    const { bannedFallback } = await import(fallbackAnalysisPath);
    const terms = Array.from(
      { length: 8_000 },
      (_, index) => `hypot(1px, var(--runtime-${index})) / 1px`,
    );
    const startedAt = performance.now();
    const result = bannedFallback(`var(--outer, calc(${terms.join(' + ')}))`);

    expect(result?.reason).toBe('too-complex');
    expect(performance.now() - startedAt).toBeLessThan(2_000);
  });

  test('keeps exact-bound typed hypot workloads as too-complex warnings', async () => {
    const startedAt = performance.now();
    const terms = Array.from(
      { length: 2_048 },
      (_, index) => `hypot(1px, var(--runtime-${index})) / 1px`,
    );
    const result = await lint(`
      .fixture {
        /* cinder-z-index-local: typed hypot fallback cap stays visible. */
        z-index: var(--outer, calc(${terms.join(' + ')}));
      }
    `);
    const [warning] = warnings(result);

    expect(warning).toBeDefined();
    expect(warning?.text).toContain('too complex to verify safely');
    expect(performance.now() - startedAt).toBeLessThan(2_000);
  });

  test('bounds typed hypot parents cumulatively across fallback frames', async () => {
    const { bannedFallback } = await import(fallbackAnalysisPath);
    let fallback = '1';
    let runtimeIndex = 0;
    for (let frameIndex = 0; frameIndex < 256; frameIndex += 1) {
      const terms = Array.from(
        { length: 8 },
        () => `hypot(1px, var(--runtime-${runtimeIndex++})) / 1px`,
      );
      fallback = `var(--outer-${frameIndex}, calc(${terms.join(' + ')} + ${fallback}))`;
    }
    const startedAt = performance.now();
    const result = bannedFallback(fallback);

    expect(runtimeIndex).toBe(2_048);
    expect(result?.reason).toBe('too-complex');
    expect(performance.now() - startedAt).toBeLessThan(2_000);
  });

  test('indexes wide sibling CSS if() groups in linear time', async () => {
    const { bannedFallback } = await import(fallbackAnalysisPath);
    const terms = Array.from(
      { length: 16_000 },
      (_, index) => `if(style(--condition-${index}: yes): var(--runtime-${index}); else: 1)`,
    );
    const startedAt = performance.now();
    const result = bannedFallback(`var(--outer, calc(${terms.join(' + ')}))`);

    expect(result?.reason).toBe('too-complex');
    expect(performance.now() - startedAt).toBeLessThan(2_000);
  });

  test('indexes wide sibling random() groups in linear time', async () => {
    const { bannedFallback } = await import(fallbackAnalysisPath);
    const terms = Array.from({ length: 40_000 }, () => 'random(0, 1)');
    const startedAt = performance.now();
    const result = bannedFallback(`var(--outer, calc(${terms.join(' + ')}))`);

    expect(result?.reason).toBe('too-complex');
    expect(performance.now() - startedAt).toBeLessThan(2_000);
  });

  test('correlates wide repeated custom-property reads in linear time', async () => {
    const { bannedFallback } = await import(fallbackAnalysisPath);
    const terms = Array.from(
      { length: 4_000 },
      () => 'var(--runtime, 9999) - var(--runtime, 9999)',
    );
    const startedAt = performance.now();
    const result = bannedFallback(`var(--outer, calc(${terms.join(' + ')}))`);

    expect(result === undefined || result.reason === 'too-complex').toBe(true);
    expect(performance.now() - startedAt).toBeLessThan(2_000);
  });

  test('keeps sliced literal source ranges lazy for long escaped dimensions', async () => {
    const { normalizeCssEscapesForInspection } = await import(valueAnalysisPath);
    const value = `1\\g${'a'.repeat(500_000)}`;
    const startedAt = performance.now();
    const normalized = normalizeCssEscapesForInspection(value);

    expect(normalized.value).toBe('1\uE000');
    expect(normalized.sourceRanges).toEqual([
      { start: 0, end: 1 },
      { start: 1, end: value.length },
    ]);
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

    const fullyCancelledSum = await lint(`
      .fixture {
        /* cinder-z-index-local: an empty normalized sum is an exact typed zero. */
        z-index: var(--outer, calc(9999 + ((1em + 1rem) + (-1em + -1rem)) / 1px));
      }
    `);
    expect(warnings(fullyCancelledSum)).toHaveLength(1);

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
      ['calc(9998 + sign(sign(1em) * 1em))', 1],
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

    for (const fallback of ['calc(sign(1em) - sign(2em))', 'calc(sign(-1em) - sign(-2em))']) {
      const scaledCorrelatedSigns = await lint(`
        .fixture {
          /* cinder-z-index-local: coefficient magnitude does not change a shared sign endpoint. */
          z-index: var(--outer, ${fallback});
        }
      `);
      expect(warnings(scaledCorrelatedSigns)).toEqual([]);
    }

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

  test.each([
    ['max', '2em', '2em'],
    ['min', '2em', '1em'],
  ])(
    'reduces same-conversion %s coefficients without inventing a conversion value',
    async (functionName, secondArgument, divisor) => {
      const result = await lint(`
        .fixture {
          /* cinder-z-index-local: one positive conversion factor preserves coefficient ordering. */
          z-index: var(--outer, calc(9999 * ${functionName}(1em, ${secondArgument}) / ${divisor}));
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

  test.each([
    ['z-index', 1],
    ['Z-INDEX', 1],
    ['\\7a-index', 1],
    ['\\7A-index', 1],
    ['z\\2d index', 1],
    ['\\7a-\\69 ndex', 1],
    ['\\7a-indexx', 0],
    ['\\7z-index', 0],
  ] as const)('decodes escaped z-index property names: %s', async (property, warningCount) => {
    expect(
      warnings(
        await lint(`
          .fixture {
            /* cinder-z-index-local: escaped property identifiers cannot bypass policy. */
            ${property}: var(--outer, 9999);
          }
        `),
      ),
    ).toHaveLength(warningCount);
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
    'var(--item-layer, calc(exp(log(9903.4)) * 19997 / 19807))',
    'var(--item-layer, exp(log(9903.5, 10)))',
    'var(--item-layer, exp(log(-1)))',
    'var(--item-layer, calc(9999 * abs(-1em) / 1rem))',
    'var(--item-layer, calc(1 * progress(1, 0, 1)))',
    'var(--item-layer, calc(9999 * progress(-1, 0, 1)))',
    'var(--item-layer, calc(9999 * progress(2, 1, 0)))',
    'var(--item-layer, calc(9999 * progress(0, 1, 1)))',
    'var(--item-layer, calc(9999 * progress(2, 1, 1)))',
    'var(--item-layer, progress(no-clamp 2, 0, 1))',
    'var(--item-layer, progress(no-clamp 1, 1, 1))',
    'var(--item-layer, progress(no-clamp 2, 1, 1))',
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
    ['calc(1 +var(--inner, 9998))', 0],
    ['calc(1 + var(--inner, 9998))', 1],
    ['calc(var(--inner, 9998)+ 1)', 0],
    ['calc(var(--inner, 9998) + 1)', 1],
    ['calc(1/**/+/**/var(--inner, 9998))', 0],
    ['calc(1 /**/+/**/ var(--inner, 9998))', 1],
    ['calc(1 *var(--inner, 9999))', 1],
  ] as const)(
    'preserves original additive whitespace when substituting a fallback: %s',
    async (fallback, warningCount) => {
      expect(
        warnings(
          await lint(`
            .fixture {
              /* cinder-z-index-local: substitution must not invent additive whitespace. */
              z-index: var(--outer, ${fallback});
            }
          `),
        ),
      ).toHaveLength(warningCount);
    },
  );

  test.each([
    ['calc(25396.18cm / 1in)', 0],
    ['calc(25396.19cm / 1in)', 1],
    ['calc(25396.20cm / 1in)', 1],
    ['calc(25396.19cm / 2.54cm)', 1],
    ['calc(min(25396.19cm, 999999in) / 1in)', 1],
    ['calc(min(999999in, 25396.19cm) / 1in)', 1],
    ['calc(max(0cm, 25396.19cm) / 1in)', 1],
    ['calc(abs(-25396.19cm) / 1in)', 1],
    ['calc(clamp(0cm, 25396.19cm, 999999in) / 1in)', 1],
    ['calc(hypot(25396.19cm, 0cm) / 1in)', 1],
    ['calc(hypot(0cm, 25396.19cm) / 1in)', 1],
    ['calc(max(9998.499999999999999999in, 25396.19cm) / 1in)', 1],
    ['calc(clamp(9998.499999999999999999in, 25396.19cm, 999999in) / 1in)', 1],
    ['calc(clamp(0in, 9998.499999999999999999in, 25396.19cm) / 1in)', 0],
    ['calc(clamp(none, 9998.499999999999999999in, 25396.19cm) / 1in)', 0],
    ['calc(clamp(9998.499999999999999999in, 25396.19cm, none) / 1in)', 1],
    ['calc(clamp(none, 25396.19cm, none) / 1in)', 1],
    ['calc(mod(25396.19cm, 999999cm) / 1in)', 1],
    ['calc(rem(25396.19cm, 999999cm) / 1in)', 1],
    ['calc(hypot(15237.714cm, 20316.952cm) / 1in)', 1],
    ['calc(hypot(15237.714cm, 20316.951cm) / 1in)', 0],
    ['calc(round(719891.996pt, 0.01pt) / 1in)', 1],
    ['calc(round(nearest, 719891.996pt, 0.01pt) / 1in)', 1],
    ['calc(round(up, 719891.996pt, 0.01pt) / 1in)', 1],
    ['calc(round(down, 719891.996pt, 0.01pt) / 1in)', 0],
    ['calc(round(to-zero, 719891.996pt, 0.01pt) / 1in)', 0],
    ['pow(calc(25396.19cm / 1in), 1)', 1],
    ['pow(calc(25396.19cm / 1in), 1.0)', 1],
    ['pow(calc(25396.19cm / 1in), 2)', 0],
    ['sqrt(calc(calc(25396.19cm / 1in) * calc(25396.19cm / 1in)))', 1],
    ['sqrt(calc(25396.18cm / 1in))', 0],
    ['calc(sin(asin(calc(25396.19cm / 9998.5in))) * 9998.5)', 1],
    ['calc(cos(acos(calc(25396.19cm / 9998.5in))) * 9998.5)', 1],
    ['progress(no-clamp 25396.18cm, 0cm, 2.54cm)', 0],
    ['progress(no-clamp 25396.19cm, 0cm, 2.54cm)', 1],
    ['progress(25396.19cm, 0cm, 2.54cm)', 0],
  ] as const)(
    'classifies exact absolute-unit rounding boundaries: %s',
    async (fallback, warningCount) => {
      expect(
        warnings(
          await lint(`
            .fixture {
              /* cinder-z-index-local: exact unit ratios decide integer rounding. */
              z-index: var(--outer, ${fallback});
            }
          `),
        ),
      ).toHaveLength(warningCount);
    },
  );

  test('normalizes insignificant zero padding before bounding exact decimals', async () => {
    const zeroPaddedBoundary = `25396.19${'0'.repeat(130)}`;
    expect(
      warnings(
        await lint(`
          .fixture {
            /* cinder-z-index-local: token padding cannot bypass exact boundary analysis. */
            z-index: var(--outer, calc(${zeroPaddedBoundary}cm / 1in));
          }
        `),
      ),
    ).toHaveLength(1);
  });

  test('fails closed for an oversized significant decimal token', async () => {
    const { bannedFallback } = await import(fallbackAnalysisPath);
    const oversizedSignificand = `1.${'1'.repeat(130)}`;
    expect(bannedFallback(`var(--outer, calc(${oversizedSignificand}cm / 1in))`)?.reason).toBe(
      'too-complex',
    );
  });

  test.each(['1e129', '1e-129', `1e${'9'.repeat(20)}`])(
    'fails closed for an exact decimal exponent beyond the bounded range: %s',
    async (oversizedExponent) => {
      const { bannedFallback } = await import(fallbackAnalysisPath);
      expect(bannedFallback(`var(--outer, calc(${oversizedExponent}))`)?.reason).toBe(
        'too-complex',
      );
    },
  );

  test.each([
    ['calc(atan2(1em, 1em) / 45deg * 9999)', 1],
    ['calc(atan2(1em, -1em) / 45deg * 9999)', 0],
    ['calc(atan2(-1em, 1em) / 45deg * 9999)', 1],
    ['calc(atan2(-1em, -1em) / 45deg * 9999)', 1],
    ['calc(atan2(0em, 1em) / 45deg * 9999)', 0],
    ['calc(atan2(-1 * 0em, -1em) / 45deg * 9999)', 1],
    ['calc(atan2(0px, 1em) / 45deg * 9999)', 0],
    ['calc(atan2(1em, 0px) / 90deg * 9999)', 1],
    ['calc(atan2(1em, 1rem) / 45deg * 9999)', 0],
    ['calc(atan2(1em, 1px) / 45deg * 9999)', 0],
  ] as const)(
    'cancels only identical relative-length factors in atan2(): %s',
    async (fallback, warningCount) => {
      expect(
        warnings(
          await lint(`
            .fixture {
              /* cinder-z-index-local: shared relative factors cancel before atan2. */
              z-index: var(--outer, ${fallback});
            }
          `),
        ),
      ).toHaveLength(warningCount);
    },
  );

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
    'env(foo -1, 9999)',
    'env(foo -01, 9999)',
    'env(foo 1 -1, 9999)',
    'env(foo -0.0, 9999)',
    'env(foo - 0, 9999)',
    'attr(data-layer inherit, -1)',
    'attr(data-layer INITIAL, 9999)',
    'attr(data-layer unset, -1)',
    'attr(data-layer revert, 9999)',
    'attr(data-layer revert-layer, -1)',
    'attr(data-layer default, 9999)',
    'attr(data-layer type(<integer), -1)',
    'attr(data-layer type(!!!), -1)',
    'attr(data-layer type(<integer> <number>), -1)',
    'attr(data-layer type(<integer> +), -1)',
    'attr(data-layer type(<url>), -1)',
    'attr(data-layer type(<transform-list>+), -1)',
    'attr(data-layer type(<transform-list>#), -1)',
    'attr(data-layer type("foo\n), 9999)',
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
    'var(--outer, -1) /',
    'var(--outer, -1) +',
    'var(--outer, -1) -',
    'var(--outer, -1) *',
    '+ var(--outer, -1)',
    '/ var(--outer, -1)',
    'var(--outer, -1) / 1',
    'var(--outer, -1) + 0',
    'var(--outer, -1) **',
    'var(--outer, -1) ** 1',
    'calc(var(--outer, -1) **)',
    'var(--layer, 9999) garbage',
    'garbage var(--layer, 9999)',
  ])('does not propagate a fallback through an invalid root token stream: %s', async (value) => {
    expect(
      warnings(
        await lint(`
          .fixture {
            /* cinder-z-index-local: the complete declaration remains invalid. */
            z-index: ${value};
          }
        `),
      ),
    ).toEqual([]);
  });

  test.each([
    'var(--outer, var(--inner, -1) /)',
    'var(--outer, var(--inner, -1) +)',
    'var(--outer, + var(--inner, -1))',
    'var(--outer, calc(var(--inner, -1) /))',
    'var(--outer, calc(var(--inner, -1) ** 1))',
    'var(--outer, calc(var(--inner, -1) * * 1))',
  ])('does not propagate a fallback through an invalid nested edge operator: %s', async (value) => {
    expect(
      warnings(
        await lint(`
          .fixture {
            /* cinder-z-index-local: the selected nested fallback remains invalid. */
            z-index: ${value};
          }
        `),
      ),
    ).toEqual([]);
  });

  test.each([
    'calc(var(--outer, -1) + 0)',
    'calc(var(--outer, -1) / 1)',
    'var(--outer, calc(var(--inner, -1) + 0))',
  ])('keeps candidates inside a valid root math boundary: %s', async (value) => {
    expect(
      warnings(
        await lint(`
          .fixture {
            /* cinder-z-index-local: valid math can still produce the banned fallback. */
            z-index: ${value};
          }
        `),
      ),
    ).toHaveLength(1);
  });

  test.each([
    'var(--inner/**/, -1)',
    'env(viewport-segment-width 0 0, 9999)',
    'env(foo +1, -1)',
    'env(foo -0, 9999)',
    'env(foo -00, -1)',
    'env(foo -0 -0, 9999)',
    'env(foo +1 -0, 9999)',
    'attr(data-layer px, -1)',
    'attr(data-layer number, 9999)',
    'attr(data-layer unknown-unit, -1)',
    'attr(data-layer raw-string, -1)',
    'attr(data-layer type(<integer>), 9999)',
    'attr(data-layer type(<length>), 9999)',
    'attr(data-layer type(*), -1)',
    'attr(data-layer type(<integer> | <number>), 9999)',
    'attr(data-layer type(<integer>#), -1)',
    'attr(data-layer type(<integer>+), 9999)',
    'attr(data-layer type(<transform-list>), -1)',
    'attr(data-layer type(default), 9999)',
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
    ['first-valid(9999, 1)', 1],
    ['first-valid(-1, 9999)', 1],
    ['first-valid(foo, 9999, 1)', 1],
    ['first-valid(var(--runtime), 9999)', 1],
    ['first-valid(var(--runtime, -1), 1)', 1],
    ['first-valid(first-valid(foo, 9999), 1)', 1],
    ['first-valid(random(0px, 1px), 9999)', 1],
    ['first-valid(random(0, 10000), 1)', 1],
    ['first-valid(random-item(auto, 9999, 1), 1)', 1],
    ['first-valid(progress(var(--runtime), 0, 10000), 1)', 0],
    ['first-valid(sibling-index(1), 9999)', 1],
    ['first-valid(if(media(screen): foo; else: 2), 9999)', 1],
    ['first-valid(if(media(screen): 1), 9999)', 1],
    ['first-valid(if(media(foo): 1), 9999)', 1],
    ['first-valid(1.5, 9999)', 1],
    ['first-valid(1e0, 9999)', 1],
    ['first-valid(1, 9999)', 0],
    ['first-valid(+1, 9999)', 0],
    ['first-valid(calc(1.5), 9999)', 0],
    ['first-valid(auto, 9999)', 0],
    ['first-valid(inherit, 9999)', 0],
    ['first-valid(foo, 1, 9999)', 0],
    ['first-valid(random(0, 1), 9999)', 0],
    ['first-valid(progress(var(--runtime), 0, 1), 9999)', 0],
    ['first-valid(sibling-index(), 9999)', 1],
    ['first-valid(first-valid(var(--runtime), 1), 9999)', 0],
    ['first-valid(if(media(foo): 1; else: 2), 9999)', 0],
    ['first-valid(if(media(foo): auto; else: 2), 9999)', 0],
    ['first-valid(if(media(foo): 1; else: auto), 9999)', 0],
    ['first-valid(if(media(foo): foo; else: 2), 9999)', 0],
    ['first-valid(if(media(screen): 1; else: 2), 9999)', 0],
    ['first-valid(var(--inner, -1) foo, 1)', 0],
    ['first-valid()', 0],
    ['first-valid(, 9999)', 0],
    ['first-valid(9999,)', 0],
    ['first-valid(9999,, 1)', 0],
    ['calc(first-valid(9999, 1))', 0],
    ['calc(first-valid(var(--inner, 9999), 1))', 0],
  ] as const)('inspects the first supported first-valid() value: %s', async (fallback, count) => {
    expect(
      warnings(
        await lint(`
          .fixture {
            /* cinder-z-index-local: first-valid() whole-value regression coverage. */
            z-index: var(--outer, ${fallback});
          }
        `),
      ),
    ).toHaveLength(count);
  });

  test.each([
    ['first-valid(9999, 1)', 'banned'],
    ['first-valid(1, 9999)', undefined],
    ['random(9999, 10000)', 'banned'],
    ['if(style(--mode: x) and (not style(--mode: x)): 9999; else: 1)', undefined],
  ] as const)('inspects standalone runtime values: %s', async (value, reason) => {
    const { bannedFallback } = await import(fallbackAnalysisPath);

    expect(bannedFallback(value)?.reason).toBe(reason);
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
    'calc(0 * progress(no-clamp var(--runtime), 0, 1))',
    'calc(progress(no-clamp var(--runtime), 0, 1) * 0)',
    'calc(progress(no-clamp var(--runtime), 0, 1) - progress(no-clamp var(--runtime),0,1))',
  ])('accepts an exactly eliminated no-clamp progress range: %s', async (fallback) => {
    expect(
      warnings(
        await lint(`
          .fixture {
            /* cinder-z-index-local: exact algebra removes every unclamped runtime value. */
            z-index: var(--outer, ${fallback});
          }
        `),
      ),
    ).toEqual([]);
  });

  test('retains an eliminated no-clamp range when division can expose its sign', async () => {
    const result = warnings(
      await lint(`
        .fixture {
          /* cinder-z-index-local: reciprocal division can observe the generated zero sign. */
          z-index: var(--outer, calc(1 / (0 * progress(no-clamp var(--runtime), 0, 1))));
        }
      `),
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.text).toContain('too complex to verify');
  });

  test.each([
    'calc(progress(no-clamp var(--left, 10000), 1, 2) - progress(no-clamp var(--right, 0), 0, 1))',
    'calc(progress(no-clamp var(--left, 10000), 1, 2) + progress(no-clamp var(--right, 0), 0, 1))',
    'calc(progress(no-clamp var(--left, 0), 1, 2) - progress(no-clamp var(--right, 10000), 0, 1))',
  ])('keeps distinct no-clamp fallback ranges independent: %s', async (fallback) => {
    expect(
      warnings(
        await lint(`
          .fixture {
            /* cinder-z-index-local: distinct runtime ranges cannot share endpoint identity. */
            z-index: var(--outer, ${fallback});
          }
        `),
      ),
    ).toHaveLength(1);
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
    'round(9999, var(--runtime))',
    'round(nearest, 9999, var(--runtime))',
    'round(up, 9999, var(--runtime))',
    'round(down, 9999, var(--runtime))',
    'round(to-zero, 9999, var(--runtime))',
    'round(var(--runtime), 9999)',
    'round(to-zero, var(--runtime), -1)',
    'mod(9999, var(--runtime))',
    'rem(9999, var(--runtime))',
    'pow(9999, var(--runtime))',
    'log(9999, var(--runtime))',
    'log(var(--runtime), 9999)',
    'hypot(9999, var(--runtime))',
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
    ['calc(9999 * max(var(--runtime), 1))', 1],
    ['calc(9999 * max(1, var(--runtime)))', 1],
    ['calc(9999 * min(var(--runtime), 1))', 1],
    ['calc(9999 * clamp(0, var(--runtime), 1))', 1],
    ['calc(9999 * max(var(--left), 1) + max(var(--right), 0))', 1],
    ['calc(10 * max(var(--runtime), 1))', 1],
    ['calc(10000 * max(var(--runtime), 1))', 0],
    ['calc(max(var(--runtime), 0) + 2)', 1],
    ['calc(max(var(--runtime), 10000) + 2)', 0],
    ['calc(min(var(--runtime), 10000) - 1)', 1],
    ['calc(clamp(0, var(--runtime), 10000) + 0)', 1],
  ] as const)(
    'propagates reachable extrema endpoints through enclosing arithmetic: %s',
    async (fallback, warningCount) => {
      expect(
        warnings(
          await lint(`
            .fixture {
              /* cinder-z-index-local: enclosing arithmetic decides endpoint policy. */
              z-index: var(--outer, ${fallback});
            }
          `),
        ),
      ).toHaveLength(warningCount);
    },
  );

  test.each([
    'min(9999, sqrt(-1))',
    'max(-1, sqrt(-1))',
    'clamp(0, 9999, sqrt(-1))',
    'clamp(sqrt(-1), 9999, 10000)',
    'clamp(-1, sqrt(-1), 1)',
    'clamp(0, sqrt(-1), 9999)',
  ])('ignores extrema candidates with an invalid fixed sibling: %s', async (fallback) => {
    expect(
      warnings(
        await lint(`
          .fixture {
            /* cinder-z-index-local: invalid fixed math makes the declaration unusable. */
            z-index: var(--outer, ${fallback});
          }
        `),
      ),
    ).toHaveLength(0);
  });

  test.each([
    ['clamp(var(--minimum), 9999, var(--maximum))', 1],
    ['clamp(var(--minimum), -1, var(--maximum))', 1],
    ['clamp(10000, 9999, var(--maximum))', 0],
    ['clamp(0, -1, var(--maximum))', 0],
  ] as const)(
    'preserves only reachable static clamp centers with runtime bounds: %s',
    async (fallback, warningCount) => {
      expect(
        warnings(
          await lint(`
            .fixture {
              /* cinder-z-index-local: runtime bounds can select only reachable centers. */
              z-index: var(--outer, ${fallback});
            }
          `),
        ),
      ).toHaveLength(warningCount);
    },
  );

  test.each([
    ['hypot(-10000, var(--runtime))', 0],
    ['hypot(10000, var(--runtime))', 0],
    ['hypot(9999.5, var(--runtime))', 0],
    ['hypot(-1, var(--runtime))', 1],
    ['hypot(0, var(--runtime))', 1],
  ] as const)(
    'classifies the reachable nonnegative range of unresolved hypot: %s',
    async (fallback, warningCount) => {
      expect(
        warnings(
          await lint(`
            .fixture {
              /* cinder-z-index-local: hypot output is nonnegative and bounded by fixed operands. */
              z-index: var(--outer, ${fallback});
            }
          `),
        ),
      ).toHaveLength(warningCount);
    },
  );

  test.each([
    ['calc(9999 * sign(var(--runtime)))', 1],
    ['calc(9998 + sign(var(--runtime)))', 1],
    ['calc(-1 * sign(var(--runtime)))', 1],
    ['calc(10 + sign(var(--runtime)))', 0],
    ['calc(sign(var(--runtime)) - sign(var(--runtime)))', 0],
    ['calc(9998 + sign(var(--left)) + sign(var(--right)))', 1],
    ['calc(9999 * sign(var(--runtime)) + var(--offset, bogus))', 1],
    ['calc(9999 * sign(var(--runtime)) + var(--offset, 1px))', 1],
    ['calc(10 + sign(var(--runtime)) + var(--offset, bogus))', 0],
    ['calc(sign(var(--runtime)) - sign(var(--runtime)) + var(--offset, bogus))', 0],
    ['calc(9999 * sign(var(--runtime), 1))', 0],
    ['calc(9999 * sign(1px, var(--runtime)))', 0],
    ['sign(calc(abs(var(--runtime)) + 1))', 0],
    ['calc(-1 + sign(max(0, var(--runtime))))', 1],
    ['calc(-1 + sign(clamp(0, var(--runtime), 10)))', 1],
    ['calc(-1 + sign(max(1, var(--runtime))))', 0],
    ['calc(-1 + sign(min(0, var(--runtime))))', 1],
    ['calc(9998 + sign(max(0, var(--runtime))))', 1],
  ] as const)(
    'evaluates the discrete output range of unresolved sign: %s',
    async (fallback, warningCount) => {
      expect(
        warnings(
          await lint(`
            .fixture {
              /* cinder-z-index-local: every valid runtime sign endpoint stays in policy. */
              z-index: var(--outer, ${fallback});
            }
          `),
        ),
      ).toHaveLength(warningCount);
    },
  );

  test.each([
    ['calc(hypot(9999px, var(--runtime)) / 1px)', 1],
    ['calc(hypot(var(--runtime), 9999px) / 1px)', 1],
    ['calc(hypot(9999deg, var(--runtime)) / 1deg)', 1],
    ['calc(hypot(9999em, var(--runtime)) / 1em)', 1],
    ['calc(hypot(9999rem, var(--runtime)) / 1rem)', 1],
    ['calc(hypot(9999fr, var(--runtime)) / 1fr)', 1],
    ['calc(hypot(10000fr, var(--runtime)) / 1fr)', 0],
    ['calc(hypot(9999fr, var(--runtime)) / 1px)', 0],
    ['calc(hypot(9999px, var(--runtime)) / 1deg)', 0],
    ['calc(hypot(9999px, var(--runtime)) / 1px + var(--offset, 0))', 1],
    ['calc(0 * hypot(var(--ignored), 1px) + hypot(9999px, var(--runtime)) / 1px)', 1],
    ['calc(0 * hypot(var(--ignored), 1px) / 1px + hypot(9999px, var(--runtime)) / 1px)', 1],
    ['calc(hypot(9999px, var(--runtime)) / 1px + hypot(0px, var(--other)) / 1px)', 1],
    ['calc(hypot(9999px, var(--runtime)) / 1px + hypot(var(--other), 0px) / 1px)', 1],
    ['calc(hypot(9999px, var(--runtime)) / 1px + hypot(0deg, var(--other)) / 1deg)', 1],
    ['calc(20000 - hypot(10000px, var(--runtime)) / 1px)', 1],
    ['calc(9999px / hypot(var(--runtime)))', 1],
    ['calc(hypot(10000, var(--runtime)) - 1)', 1],
    ['calc(hypot(0, var(--runtime)) + 9998)', 1],
    ['calc(0 * hypot(var(--runtime)))', 0],
    ['max(10000, calc(9999px / hypot(var(--runtime))))', 0],
    ['clamp(0, calc(9999px / hypot(var(--runtime))), 1)', 0],
    ['hypot(9999px, var(--runtime))', 0],
    ['calc(hypot(10000px, var(--runtime)) / 1px)', 0],
    ['calc(hypot(9999px, var(--left)) + hypot(9999deg, var(--right)))', 0],
  ] as const)(
    'evaluates typed-zero witnesses for unresolved hypot(): %s',
    async (fallback, warningCount) => {
      expect(
        warnings(
          await lint(`
            .fixture {
              /* cinder-z-index-local: typed hypot witnesses preserve enclosing cancellation. */
              z-index: var(--outer, ${fallback});
            }
          `),
        ),
      ).toHaveLength(warningCount);
    },
  );

  test.each([
    'calc(9999 * sin(var(--runtime)))',
    'calc(9999 * cos(var(--runtime)))',
    'calc(9999 * tan(var(--runtime)))',
    'calc(9999 * asin(var(--runtime)) / 90deg)',
    'calc(9999 * acos(var(--runtime)) / 90deg)',
    'calc(9999 * atan(var(--runtime)) / 90deg)',
  ])('fails closed for an unresolved trigonometric range: %s', async (fallback) => {
    const [warning] = warnings(
      await lint(`
        .fixture {
          /* cinder-z-index-local: unresolved trigonometry cannot prove this layer safe. */
          z-index: var(--outer, ${fallback});
        }
      `),
    );

    expect(warning?.text).toContain('too complex to verify safely');
  });

  test.each([
    ['calc(9999 * atan2(var(--runtime), 1) / 45deg)', 1],
    ['calc(9999 * atan2(1, var(--runtime)) / 45deg)', 1],
    ['calc(0 * atan2(var(--runtime), 1))', 0],
    ['calc(9999 * atan2(var(--runtime)) / 45deg)', 0],
    ['calc(9999 * atan2(var(--runtime), 1, 2) / 45deg)', 0],
  ] as const)(
    'fails closed for a valid unresolved atan2 range: %s',
    async (fallback, warningCount) => {
      expect(
        warnings(
          await lint(`
            .fixture {
              /* cinder-z-index-local: unresolved atan2 output requires a proven safe range. */
              z-index: var(--outer, ${fallback});
            }
          `),
        ),
      ).toHaveLength(warningCount);
    },
  );

  test.each([
    ['calc(9999 * abs(var(--runtime)))', 1],
    ['calc(9998 + abs(var(--runtime)))', 1],
    ['calc(-1 + abs(var(--runtime)))', 1],
    ['abs(var(--runtime))', 1],
    ['calc(0 * abs(var(--runtime)))', 0],
    ['calc(9999 * abs(var(--runtime), 1))', 0],
  ] as const)(
    'fails closed for a valid unresolved abs range: %s',
    async (fallback, warningCount) => {
      expect(
        warnings(
          await lint(`
          .fixture {
            /* cinder-z-index-local: unresolved absolute values require a proven safe range. */
            z-index: var(--outer, ${fallback});
          }
        `),
        ),
      ).toHaveLength(warningCount);
    },
  );

  test.each(['sin', 'cos', 'tan', 'asin', 'acos', 'atan'])(
    'does not report a statically invalid unresolved trigonometric function: %s',
    async (functionName) => {
      expect(
        warnings(
          await lint(`
            .fixture {
              /* cinder-z-index-local: trigonometric functions accept exactly one argument. */
              z-index: var(--outer, calc(9999 * ${functionName}(var(--runtime), 1)));
            }
          `),
        ),
      ).toEqual([]);
    },
  );

  test.each([
    'calc(0 * sin(var(--runtime)))',
    'calc(cos(var(--runtime)) * 0)',
    'calc(0 * tan(var(--runtime)))',
  ])('accepts an exactly eliminated trigonometric range: %s', async (fallback) => {
    expect(
      warnings(
        await lint(`
          .fixture {
            /* cinder-z-index-local: the runtime trigonometric term is exactly eliminated. */
            z-index: var(--outer, ${fallback});
          }
        `),
      ),
    ).toEqual([]);
  });

  test('bounds independent unresolved sign ranges', async () => {
    const signTerms = Array.from({ length: 16 }, (_, index) => `sign(var(--runtime-${index}))`);
    const [warning] = warnings(
      await lint(`
        .fixture {
          /* cinder-z-index-local: independent sign combinations must stay bounded. */
          z-index: var(--outer, calc(${signTerms.join(' + ')}));
        }
      `),
    );

    expect(warning?.text).toContain('too complex to verify');
  });

  test.each([
    'max(var(--runtime), 9999, 1px)',
    'max(var(--inner, 9999), 1px)',
    'min(var(--inner, -1), 1px)',
    'clamp(0, var(--inner, 9999), 1px)',
    'round(9999, 1px)',
    'round(var(--inner, 9999), 1px)',
    'round(foo, 9999)',
    'mod(9999, var(--runtime), 1)',
    'rem(9999, var(--runtime), 1)',
    'pow(9999, var(--runtime), 1)',
    'pow(9999px, var(--runtime))',
    'log(9999)',
    'log(9999, var(--runtime), 1)',
    'log(9999px, var(--runtime))',
    'log(-1, var(--runtime))',
    'log(1, var(--runtime))',
    'log(var(--runtime), 1)',
    'hypot(9999, var(--runtime), 1px)',
  ])(
    'does not report candidates from a statically type-invalid math function: %s',
    async (fallback) => {
      expect(
        warnings(
          await lint(`
          .fixture {
            /* cinder-z-index-local: fixed number and length arguments cannot be combined. */
            z-index: var(--outer, ${fallback});
          }
        `),
        ),
      ).toEqual([]);
    },
  );

  test.each([
    ['calc(9999 * progress(var(--runtime), 1px, 1deg))', 0],
    ['calc(9999 * progress(var(--runtime), 1%, 2%))', 0],
    ['calc(9999 * progress(var(--runtime), 1fr, 2fr))', 0],
    ['calc(9999 * progress(var(--runtime), sqrt(-1), 1))', 0],
    ['calc(9999 * progress(var(--runtime), 0, 1))', 1],
    ['calc(9999 * progress(var(--runtime), 1px, 2px))', 1],
  ] as const)(
    'validates the static progress range types before preserving its bound: %s',
    async (fallback, warningCount) => {
      expect(
        warnings(
          await lint(`
            .fixture {
              /* cinder-z-index-local: only a valid progress range can expose the bound. */
              z-index: var(--outer, ${fallback});
            }
          `),
        ),
      ).toHaveLength(warningCount);
    },
  );

  test.each([
    'calc(9999 * progress(no-clamp var(--runtime), 0, 1))',
    'calc(-1 * progress(no-clamp var(--runtime), 0, 1))',
    'calc(0.1 + 0.1 * progress(no-clamp var(--runtime), 0, 1))',
    'calc(progress(no-clamp var(--runtime), 1, 1))',
    'calc(9999 * progress(/**/no-clamp/**/var(--runtime), 0, 1))',
  ])('fails closed for an unresolved no-clamp progress range: %s', async (fallback) => {
    const result = warnings(
      await lint(`
        .fixture {
          /* cinder-z-index-local: an unclamped runtime ratio can reach a banned layer. */
          z-index: var(--outer, ${fallback});
        }
      `),
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.text).toContain('too complex to verify');
  });

  test.each([
    'calc(9999 * progress(no-clamp var(--runtime), 0))',
    'calc(9999 * progress(no-clamp var(--runtime), 0, 1, 2))',
    'calc(9999 * progress(no-clamp var(--runtime), 1px, 1deg))',
  ])(
    'does not infer reachability from an invalid no-clamp progress range: %s',
    async (fallback) => {
      expect(
        warnings(
          await lint(`
          .fixture {
            /* cinder-z-index-local: invalid progress syntax cannot establish a runtime range. */
            z-index: var(--outer, ${fallback});
          }
        `),
        ),
      ).toEqual([]);
    },
  );

  test('keeps a candidate when a runtime sibling can still have a compatible type', async () => {
    for (const fallback of [
      'max(var(--inner, 9999), var(--other, 1px))',
      'round(var(--inner, 9999), var(--step, 1px))',
    ]) {
      expect(
        warnings(
          await lint(`
          .fixture {
            /* cinder-z-index-local: the runtime sibling can resolve to a number. */
            z-index: var(--outer, ${fallback});
          }
        `),
        ),
      ).toHaveLength(1);
    }
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

  test('resolves dimensioned zero numerators only across static nonzero divisors', async () => {
    for (const [fallback, warningCount] of [
      ['calc(9999 + 0em / 1px)', 1],
      ['calc(1 + 0em / 1px)', 0],
      ['calc(9999 + 0em / 0px)', 0],
      ['calc(9999 + 1em / 0px)', 0],
      ['calc(9999 + 0em / 1rem)', 1],
      ['calc(9999 + 0em / var(--divisor))', 1],
      ['calc(9999 + 0em / (var(--divisor)))', 1],
      ['calc(9999 + 0em / ((var(--divisor))))', 1],
      ['calc(9999 + 0em / calc(var(--divisor)))', 1],
      ['calc(9999 + 0em / var(--divisor, 0px))', 1],
      ['calc(9999 + 0em / var(invalid))', 0],
      ['calc(9999 + 0em / var(--divisor) + var(--other) * 0)', 1],
      ['calc(9999 + 0em / var(--first) / var(--second))', 1],
      ['calc(9999 + (0em / var(--first)) / var(--second))', 1],
      ['calc(9999 + 0em / var(--divisor) * var(--other))', 1],
      ['calc(9999 + var(--other) * (0em / var(--divisor)))', 1],
      ['calc(9999 + 0em / var(--divisor) / 0)', 0],
      ['calc(9999 + 0em / var(--divisor) / 1em)', 1],
      ['calc(1 + 0em / var(--divisor) / 1em)', 0],
      ['calc(9999 + 0em / var(--divisor) / 0em)', 0],
      ['calc(9999 + var(--zero, 0) / var(--divisor))', 1],
      ['calc(1 + var(--zero, 0) / var(--divisor))', 0],
      ['calc(9999 + var(--zero, 0) / 0)', 0],
      ['calc(9999 + 0 / max(var(--divisor), 1))', 1],
      ['calc(9999 + 0 / calc(var(--divisor) - 1))', 1],
      ['calc(9999 + 0 / calc((var(--divisor) - 1) * (var(--divisor) - 2)))', 1],
      ['calc(9999 + 0 / min(var(--divisor), 1))', 1],
      ['calc(9999 + 0 / clamp(1, var(--divisor), 2))', 1],
      ['calc(9999 + 0 / max(var(--divisor), 1px))', 0],
      ['calc(9999 + 0em / max(var(--divisor), 1px))', 1],
      ['calc(9999 + 0deg / max(var(--divisor), 1deg))', 1],
      ['calc(9999 + 0s / min(var(--divisor), 1s))', 1],
      ['calc(9999 + 0Hz / calc(var(--divisor) + 1Hz))', 1],
      ['calc(9999 + 0dppx / clamp(1dppx, var(--divisor), 2dppx))', 1],
      ['calc(9999 + 0% / max(var(--divisor), 1%))', 0],
      ['calc(9999 + 0fr / max(var(--divisor), 1fr))', 0],
      ['calc(0 / max(var(--divisor), 1deg) * var(--inner, -1))', 0],
      ['calc(0em / max(var(--divisor), 1deg) * var(--inner, -1))', 0],
      ['calc(9999 + 0 / max(var(--divisor), 1deg) * var(--inner, -1) + var(--other, -1))', 1],
      ['calc(0 / max(var(--divisor), 1deg) * var(--inner, -1) + var(--other, 9999))', 1],
      ['calc((0 / max(var(--divisor), 1deg) * var(--inner, -1)) * var(--other, 9999))', 0],
      ['calc((0deg / max(var(--divisor), 1deg) * var(--inner, -1)) * var(--other, 9999))', 0],
      ['calc((0deg / max(var(--divisor), 1deg)) / 0 * var(--inner, 9999))', 0],
      ['calc(sign((0 * -1) / var(--divisor)) / 0 * var(--inner, 9999))', 0],
      ['calc(sign((0 * -1) / var(--divisor)) / 1 * var(--inner, 9999))', 0],
      ['calc((0deg / max(var(--divisor), 1deg)) / 0 * var(--inner, 9999) + var(--other, -1))', 1],
      ['calc(9999 + 0 / var(--first-divisor) * 0 / var(--second-divisor))', 1],
      ['calc(9999 * max(0em, 0px) / max(0px, 0em))', 0],
      ['calc(9999 * max(-1em, 0px) / max(0px, -1em))', 0],
      ['calc(9999 * max(-1em, -2em) / max(-2em, -1em))', 1],
      ['calc(9999 * min(1em, 0px) / min(0px, 1em))', 0],
      ['calc(9999 * min(-1em, 0px) / min(0px, -1em))', 1],
      ['calc(9999 * hypot(-1em, 2em) / hypot(1em, -2em))', 1],
      ['calc(9999 * hypot(-1em, 2em) / hypot(1em, -3em))', 0],
    ] as const) {
      const result = await lint(`
        .fixture {
          /* cinder-z-index-local: zero division must retain CSS zero-divisor semantics. */
          z-index: var(--outer, ${fallback});
        }
      `);

      expect(warnings(result)).toHaveLength(warningCount);
    }
  });

  test.each(['sin', 'tan', 'sqrt'])(
    'preserves a negative-zero quotient through a signed-zero wrapper: %s',
    async (functionName) => {
      expect(
        warnings(
          await lint(`
            .fixture {
              /* cinder-z-index-local: the wrapper preserves negative zero for the reciprocal. */
              z-index: var(--outer, calc(1 / ${functionName}((0 * -1) / var(--divisor))));
            }
          `),
        ),
      ).toHaveLength(1);
    },
  );

  test.each(['asin', 'atan'])(
    'preserves a negative-zero quotient through an inverse trigonometric wrapper: %s',
    async (functionName) => {
      expect(
        warnings(
          await lint(`
            .fixture {
              /* cinder-z-index-local: the inverse trigonometric wrapper preserves negative zero. */
              z-index: var(--outer, calc(1deg / ${functionName}((0 * -1) / var(--divisor))));
            }
          `),
        ),
      ).toHaveLength(1);
    },
  );

  test.each([
    'calc(var(--inner, 9999) * 0em / var(--divisor))',
    'calc(var(--inner, -1) * 0em / 1em)',
    'calc((0em / var(--divisor)) * var(--inner, 9999))',
    'calc(var(--inner, 9999) * (0em / var(--divisor)))',
    'calc(0em / var(--divisor) * var(--inner, 9999))',
    'calc((0em / var(--divisor)) * var(--inner, -1))',
    'calc(-0em / 1em * var(--inner, -1))',
    'calc(0em / -1em * var(--inner, -1))',
    'calc(0em / calc(0px - var(--divisor)) * var(--inner, -1))',
    'calc(0em / calc(-1 * var(--divisor)) * var(--inner, -1))',
    'calc(0em / calc(var(--divisor) * -1) * var(--inner, -1))',
    'calc(0em / calc(var(--divisor) + 1px) * var(--inner, -1))',
    'calc(0em / calc(var(--divisor) / 1) * var(--inner, -1))',
    'calc(0em / calc(var(--first-divisor) + var(--second-divisor)) * var(--inner, -1))',
    'calc(0 / var(--first-divisor) * var(--inner, 9999) / var(--second-divisor))',
    'calc(1 + (0em / var(--divisor)) * calc(var(--inner, 9999) + 1) / 1em)',
    'calc(1 + (0em / var(--divisor)) * (var(--inner, 9999) + 1) / 1em)',
    'calc(1 + (0em / var(--divisor)) * calc(var(--magic, 9999) + var(--negative, -1)) / 1em)',
    'calc(0em / max(var(--divisor), 1em) * var(--inner, -1))',
    'calc(0em / min(var(--divisor), 1em) * var(--inner, -1))',
    'calc(0em / (var(--first-divisor) / var(--second-divisor)) * var(--inner, -1))',
  ])('eliminates a banned child from a dimensioned zero numerator: %s', async (fallback) => {
    const result = await lint(`
      .fixture {
        /* cinder-z-index-local: valid quotients are zero and zero divisors are invalid. */
        z-index: var(--outer, ${fallback});
      }
    `);

    expect(warnings(result)).toEqual([]);
  });

  test('suppresses nested candidates when static arithmetic produces NaN', async () => {
    const result = await lint(`
      .fixture {
        /* cinder-z-index-local: exact zero divided by exact zero invalidates every nested path. */
        z-index: var(--outer, calc(((1em + -1em) / 0em) * var(--inner, -1)));
      }
    `);

    expect(warnings(result)).toEqual([]);
  });

  test('preserves a typed negative-zero quotient inside a sign-sensitive function', async () => {
    const result = await lint(`
      .fixture {
        /* cinder-z-index-local: a positive runtime divisor preserves the negative angle zero. */
        z-index: var(--outer, calc(atan2((0deg * -1) / var(--divisor), -1deg) / 1deg));
      }
    `);

    expect(warnings(result)).toHaveLength(1);
  });

  test('preserves a negative-zero quotient consumed by sign inside a divisor', async () => {
    const result = await lint(`
      .fixture {
        /* cinder-z-index-local: sign preserves negative zero before reciprocal division. */
        z-index: var(--outer, calc(1 / sign((0 * -1) / var(--divisor))));
      }
    `);

    expect(warnings(result)).toHaveLength(1);
  });

  test.each([
    'calc(1 / (0em / var(--divisor)) * var(--inner, -1))',
    'calc(1 / ((0em / var(--divisor)) * var(--inner, -1)))',
    'calc(1 / (0em / calc(0px - var(--divisor)) * var(--inner, -1)))',
    'calc(1 / (0em / calc(-1 * var(--divisor)) * var(--inner, -1)))',
  ])(
    'preserves a negative fallback when a zero quotient can expose its sign: %s',
    async (fallback) => {
      const result = await lint(`
      .fixture {
        /* cinder-z-index-local: multiplying by -1 can expose a negative zero to reciprocal division. */
        z-index: var(--outer, ${fallback});
      }
    `);

      expect(warnings(result)).toHaveLength(1);
    },
  );

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

  test('bounds typed divisor witnesses across a wide substitution expression', async () => {
    const divisorTerms = Array.from({ length: 3_000 }, (_, index) => `var(--divisor-${index})`);
    const result = warnings(
      await lint(`
        .fixture {
          /* cinder-z-index-local: witness enumeration must consume the shared work budget. */
          z-index: var(--outer, calc(9999 + 0em / calc(${divisorTerms.join(' + ')})));
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

  test.each([
    ['calc(9999 * pow(var(--runtime), 0))', 1],
    ['calc(0 * pow(var(--runtime), 0))', 0],
    ['calc(9999 * pow(var(--runtime)))', 0],
    ['calc(9999 * pow(var(--runtime), 0, 1))', 0],
    ['calc(9999 * pow(1px, var(--runtime)))', 0],
  ] as const)('tracks unresolved pow arity and zero elimination: %s', async (fallback, count) => {
    expect(
      warnings(
        await lint(`
          .fixture {
            /* cinder-z-index-local: pow regression coverage. */
            z-index: var(--outer, ${fallback});
          }
        `),
      ),
    ).toHaveLength(count);
  });

  test.each([
    ['calc(9999 * exp(var(--runtime)))', 1],
    ['calc(0 * exp(var(--runtime)))', 0],
    ['calc(9999 * exp(var(--runtime), 0))', 0],
    ['calc(9998 + exp(var(--runtime)))', 1],
    ['calc(-1 + exp(var(--runtime)))', 1],
    ['min(1, exp(var(--runtime)))', 0],
    ['min(1, calc(exp(var(--runtime)) + 0))', 0],
    ['min(1, calc(0 + exp(var(--runtime))))', 0],
    ['min(1, calc(exp(var(--runtime)) * 1))', 0],
    ['min(1, calc(exp(var(--runtime)) / 2))', 0],
    ['min(1, calc(exp(var(--runtime)) + 1px))', 1],
    ['min(1, calc(exp(var(--runtime)) + var(--other)))', 1],
    ['min(1, pow(exp(var(--runtime)), 2))', 1],
    ['min(1, calc(exp(var(--runtime)) - 2))', 1],
    ['min(1, calc(2 - exp(var(--runtime))))', 1],
    ['min(1, calc(exp(var(--runtime)) * -1))', 1],
    ['min(1, calc(1e30 - exp(var(--runtime))))', 1],
    ['calc(9999 * exp(calc(var(--runtime) + 1px)))', 0],
    ['calc(9999 * exp(max(var(--runtime), 1px)))', 0],
    ['calc(9999 * exp(min(var(--runtime), 1px)))', 0],
    ['calc(9999 * exp(clamp(0px, var(--runtime), 10px)))', 0],
    ['calc(9999 * exp(hypot(var(--runtime), 1px)))', 0],
    ['calc(9999 * exp(abs(calc(var(--runtime) + 1px))))', 0],
    ['calc(9999 * exp(max(var(--runtime), 1px, 2)))', 0],
    ['calc(9999 * exp(max(var(--runtime), 1)))', 1],
    ['calc(9999 * sqrt(max(var(--runtime), 1px)))', 0],
    ['calc(9999 * sqrt(max(var(--runtime), 1)))', 1],
    ['calc(9999 * log(max(var(--runtime), 1px)))', 0],
    ['calc(9999 * log(max(var(--runtime), 2)))', 1],
    ['calc(9999 * pow(max(var(--runtime), 1px), var(--exponent)))', 0],
    ['calc(9999 * pow(max(var(--runtime), 1), var(--exponent)))', 1],
    ['min(-1, exp(var(--runtime)))', 1],
    ['min(9999, exp(var(--runtime)))', 1],
    ['clamp(0, exp(var(--runtime)), 1)', 0],
    ['max(0, exp(var(--runtime)))', 1],
  ] as const)('tracks unresolved exp arity and zero elimination: %s', async (fallback, count) => {
    expect(
      warnings(
        await lint(`
          .fixture {
            /* cinder-z-index-local: exp regression coverage. */
            z-index: var(--outer, ${fallback});
          }
        `),
      ),
    ).toHaveLength(count);
  });

  test.each([
    ['calc(9999 * log(var(--runtime)))', 1],
    ['calc(0 * log(var(--runtime)))', 0],
    ['calc(9999 * log(var(--runtime), 10))', 1],
    ['calc(9999 * log(var(--runtime), 1px))', 0],
    ['calc(9999 * log(var(--runtime), 1))', 0],
    ['calc(9999 * log(var(--runtime), -1))', 0],
    ['calc(9999 * log(-1, var(--runtime)))', 0],
    ['calc(9999 * log(1, var(--runtime)))', 0],
    ['calc(9999 + log(1, var(--runtime)))', 1],
    ['calc(9999 * log(var(--runtime), 1, 2))', 0],
  ] as const)('tracks unresolved log arity and zero elimination: %s', async (fallback, count) => {
    expect(
      warnings(
        await lint(`
          .fixture {
            /* cinder-z-index-local: log regression coverage. */
            z-index: var(--outer, ${fallback});
          }
        `),
      ),
    ).toHaveLength(count);
  });

  test.each([
    ['calc(9999 * sqrt(var(--runtime)))', 1],
    ['calc(0 * sqrt(var(--runtime)))', 0],
    ['calc(9999 * sqrt(var(--runtime), 1))', 0],
    ['calc(9999 * sqrt(calc(var(--runtime) + 1px)))', 0],
    ['calc(9998 + sqrt(var(--runtime)))', 1],
    ['min(1, sqrt(var(--runtime)))', 0],
    ['min(1, calc(1e30 - sqrt(var(--runtime))))', 1],
    ['max(0, sqrt(var(--runtime)))', 1],
  ] as const)('tracks unresolved sqrt arity and nonnegative range: %s', async (fallback, count) => {
    expect(
      warnings(
        await lint(`
          .fixture {
            /* cinder-z-index-local: sqrt regression coverage. */
            z-index: var(--outer, ${fallback});
          }
        `),
      ),
    ).toHaveLength(count);
  });

  test.each([
    ['calc(9999 * sibling-index() / sibling-index())', 1],
    ['calc(9999 * sibling-count() / sibling-count())', 1],
    ['calc(9999 * sibling-index() / sibling-count())', 1],
    ['calc(9999 * sibling-index())', 1],
    ['calc(0 * sibling-index())', 0],
    ['calc(9999 * sibling-index(1))', 0],
    ['calc(9999 * sibling-count(1))', 0],
  ] as const)('tracks CSS tree-counting functions: %s', async (fallback, count) => {
    expect(
      warnings(
        await lint(`
          .fixture {
            /* cinder-z-index-local: tree-counting regression coverage. */
            z-index: var(--outer, ${fallback});
          }
        `),
      ),
    ).toHaveLength(count);
  });

  test.each([
    ['calc(9999 * var(--runtime, 0))', 1],
    ['calc(9999 * env(foo, 0))', 1],
    ['calc(9999 * env(safe-area-inset-top, 0px))', 0],
    ['calc(9999 * env(safe-area-max-inset-left, 0px))', 0],
    ['calc(9999 * env(viewport-segment-width 0 0, 0px))', 0],
    ['calc(9999 * env(safe-area-inset-top, 0))', 0],
    ['calc(9999 * env(viewport-segment-width, 0))', 0],
    ['calc(9999 * env(viewport-segment-width 0 0, 1))', 1],
    ['calc(9999 * env(viewport-segment-width, 1))', 1],
    ['env(viewport-segment-width 0 0, 9999)', 1],
    ['calc(9999 * env(preferred-text-scale, 0))', 1],
    ['calc(9999 * env(foo, 0px))', 1],
    ['calc(9999 * attr(data-layer type(<number>), 0))', 1],
    ['calc(9999 * attr(data-layer type(<integer>), 0))', 1],
    ['calc(var(--runtime, 0) - var(--runtime, 0))', 0],
    ['calc(var(--runtime, 9999) - var(--runtime, 9999))', 0],
    ['calc(var(--runtime, 0) - var(--runtime, 1))', 1],
    ['calc(var(--runtime, 0) - var(--RUNTIME, 0))', 1],
    ['calc(0 * var(--runtime, 0))', 0],
    ['clamp(0, calc(9999 * var(--runtime, 0)), 1)', 0],
    ['calc(9999 * attr(data-layer type(<length>), 0px))', 0],
  ] as const)(
    'tracks the defined path of substitutions with safe fallbacks: %s',
    async (fallback, count) => {
      expect(
        warnings(
          await lint(`
          .fixture {
            /* cinder-z-index-local: defined substitution path regression coverage. */
            z-index: var(--outer, ${fallback});
          }
        `),
        ),
      ).toHaveLength(count);
    },
  );

  test.each([
    ['calc(9999 * exp(var(--runtime, 1)))', 1],
    ['calc(9999 * exp(var(--runtime, 1px)))', 1],
    ['calc(9999 * exp(attr(data-layer type(<number>), 1px)))', 1],
    ['calc(9999 * exp(max(attr(data-layer type(<number>), 1px), 1)))', 1],
    ['calc(9999 * exp(clamp(0, attr(data-layer type(<number>), 1px), 10)))', 1],
    ['calc(9999 * sqrt(var(--runtime, 0)))', 1],
    ['calc(9999 * sqrt(attr(data-layer type(<number>), 0)))', 1],
    ['calc(9999 * log(var(--runtime, 1)))', 1],
    ['calc(9999 * pow(var(--runtime, 0), 2))', 1],
    ['calc(9999 * log(1, var(--runtime, 0)))', 0],
    ['calc(0 * exp(var(--runtime, 1)))', 0],
    ['min(1, exp(var(--runtime, 1)))', 0],
    ['calc(9999 * exp(attr(data-layer type(<length>), 1px)))', 0],
    ['calc(9999 * exp(var(--runtime, 1), 2))', 0],
  ] as const)(
    'tracks defined substitutions inside number-only runtime functions: %s',
    async (fallback, count) => {
      expect(
        warnings(
          await lint(`
          .fixture {
            /* cinder-z-index-local: number-only defined path regression coverage. */
            z-index: var(--outer, ${fallback});
          }
        `),
        ),
      ).toHaveLength(count);
    },
  );

  test.each([
    ['if(style(--theme: dark): 9999; else: 1)', 1],
    ['if(style(--theme: dark): -1; else: 1)', 1],
    ['if(style(--theme: dark): 1; else: 9999)', 1],
    ['if(style(--theme: dark): var(--inner, 9999); else: 1)', 1],
    ['if(style(--theme: dark): 1; else: 2)', 0],
    ['if(style(--theme: dark): ; else: 9999)', 1],
    ['if(not style(--theme: dark): 9999; else: 1)', 1],
    ['if(not (style(--theme: dark)): 9999; else: 1)', 1],
    ['if(not (media(width > 10px)): 9999; else: 1)', 1],
    ['if(not (supports(display: grid)): 9999; else: 1)', 1],
    ['if(not ((style(--theme: dark) or supports(display: grid))): 9999; else: 1)', 1],
    ['if(style(--mode: x) and (not style(--mode: x)): 9999; else: 1)', 0],
    ['if(style(--mode: x) or (not style(--mode: x)): 1; else: 9999)', 0],
    ['if(STYLE(--mode: x) and (not style(--mode: x)): 9999; else: 1)', 0],
    ['if(style(--mode: x) and (not STYLE(--mode: x)): 9999; else: 1)', 0],
    ['if(style(--mode: x) and (not style( --mode: x )): 9999; else: 1)', 0],
    ['if(style(--mode: x) and (not style(--mode/**/: x)): 9999; else: 1)', 0],
    ['if(style(--mode: x) or (not STYLE(--mode: x)): 1; else: 9999)', 0],
    ['if(style(--theme: dark) and media(width > 10px): 9999; else: 1)', 1],
    ['if(media(10px < width < 20px): 9999; else: 1)', 1],
    ['if(media((width > 10px) and (height > 20px)): 9999; else: 1)', 1],
    ['if(media((width > 10px) or (height > 20px)): 9999; else: 1)', 1],
    ['if(media(not (width > 10px)): 9999; else: 1)', 1],
    ['if(media(screen and (width > 10px)): 9999; else: 1)', 1],
    ['if(media(screen and (width > 10px) and (height > 20px)): 9999; else: 1)', 1],
    ['if(media(only screen and (width > 10px)): 9999; else: 1)', 1],
    ['if(media(not screen and (width > 10px)): 9999; else: 1)', 1],
    ['if(media(not screen): 9999; else: 1)', 1],
    ['if(media(all and (width > 10px)): 9999; else: 1)', 1],
    ['if(media(print and (width > 10px)): 9999; else: 1)', 1],
    ['if(media(foo): 9999; else: 1)', 0],
    ['if(media(only foo): 9999; else: 1)', 0],
    ['if(media(foo and (width > 10px)): 9999; else: 1)', 0],
    ['if(media(foo \\61 nd (width > 10px)): 9999; else: 1)', 0],
    ['if(media(f\\6f o \\61 nd (width > 10px)): 9999; else: 1)', 0],
    ['if(media(o\\6e ly f\\6f o): 9999; else: 1)', 0],
    ['if(media(s\\63 reen \\61 nd (width > 10px)): 9999; else: 1)', 1],
    ['if(media(o\\6e ly s\\63 reen): 9999; else: 1)', 1],
    ['if(media(not foo): 9999; else: 1)', 1],
    ['if(media(not foo and (width > 10px)): 9999; else: 1)', 1],
    ['if(not media(foo): 9999; else: 1)', 1],
    ['if(media(foo) and style(--theme: dark): 9999; else: 1)', 0],
    ['if(media(foo) or style(--theme: dark): 9999; else: 1)', 1],
    ['if(media(all): 1; else: 9999)', 0],
    ['if(media(all): random(9999, 10000); else: 1)', 1],
    ['if(media(foo): random(9999, 10000); else: 1)', 0],
    ['if(media(not all): 1; else: random(9999, 10000))', 1],
    ['if(media(all): random(0, 1); else: 9999)', 0],
    ['if(media(all): random-item(auto, 9999, 1); else: 1)', 1],
    ['if(media(foo): random-item(auto, 9999, 1); else: 1)', 0],
    ['if(media(not all): 9999; else: 1)', 0],
    ['if(media(s\\63 reen): 9999; else: 1)', 1],
    ['if(media(screen and ((width > 10px) or (height > 20px))): 9999; else: 1)', 1],
    ['if(media(aspect-ratio > 16/9): 9999; else: 1)', 1],
    ['if(media(width > calc(10px + 1vw)): 9999; else: 1)', 1],
    ['if(media(width > min(10px, 20px)): 9999; else: 1)', 1],
    ['if(media(width > var(--breakpoint)): 9999; else: 1)', 1],
    [
      'if(media(width > var(--breakpoint)): calc(9999 * progress(var(--runtime), 0, 1)); else: 1)',
      1,
    ],
    ['if(media(width > var(--breakpoint)): calc(9999 * sign(var(--runtime))); else: 1)', 1],
    ['if(media(width > var(--breakpoint, 20px)): calc(9999 * sign(var(--runtime))); else: 1)', 1],
    [
      'if(media(width > min(var(--breakpoint, 20px), 30px)): calc(9999 * sign(var(--runtime))); else: 1)',
      1,
    ],
    ['if(media(width > env(foo, 20px)): calc(9999 * sign(var(--runtime))); else: 1)', 1],
    ['if(media(width > attr(data-width px, 20px)): calc(9999 * sign(var(--runtime))); else: 1)', 1],
    ['if(supports(selector(:is(.a, .b))): 9999; else: 1)', 1],
    ['if((style(--theme: dark) or supports(display: grid)): 9999; else: 1)', 1],
    ['if(else: 1; style(--theme: dark): 9999)', 0],
    ['if(else: 1; else: 9999)', 0],
    ['if(style(--theme: dark): 1; else: 2; style(--other: yes): 9999)', 0],
    ['if(else: 1; style(--theme: dark): var(--inner, 9999))', 0],
    ['calc(2 * if(style(--theme: dark): 4999.5; else: 1))', 1],
    ['calc(if(style(--theme: dark): 10000; else: 1) - 1)', 1],
    ['calc(0 * if(style(--theme: dark): 9999; else: 1))', 0],
    ['min(1, if(style(--theme: dark): 9999; else: 1))', 0],
    ['max(10000, if(style(--theme: dark): 9999; else: 1))', 0],
    ['clamp(0, if(style(--theme: dark): 9999; else: 1), 1)', 0],
    ['if(media(width > 10px): 9999; else: 1)', 1],
    ['if(supports(display: grid): 9999; else: 1)', 1],
    ['if(style(--theme: dark): 9999; unknown(display: grid): 1; else: 1)', 1],
    ['if(unknown(display: grid): 1; else: 9999)', 1],
    ['if(style(:): 1; else: 9999)', 1],
    ['if(unknown(display: grid): 9999; else: 1)', 0],
    ['if(style(--theme: dark): if(style(--nested: yes): 9999; else: 1); else: 2)', 1],
    ['if(style(--theme: dark): 1; else: if(style(--nested: yes): 9999; else: 2))', 1],
    [
      'if(style(--theme: dark): if(style(--first: yes): 9999; else: 1); else: if(style(--second: yes): 9999; else: 2))',
      1,
    ],
    ['calc(2 * if(style(--theme: dark): if(style(--nested: yes): 4999.5; else: 1); else: 2))', 1],
    ['if(style(--theme: dark): calc(if(style(--nested: yes): 10000; else: 1) - 1); else: 2)', 1],
    ['clamp(0, if(style(--theme: dark): if(style(--nested: yes): 9999; else: 1); else: 2), 1)', 0],
    ['max(10000, if(style(--theme: dark): if(style(--nested: yes): 9999; else: 1); else: 2))', 0],
  ] as const)('tracks CSS if() branches: %s', async (fallback, count) => {
    expect(
      warnings(
        await lint(`
          .fixture {
            /* cinder-z-index-local: if() branch regression coverage. */
            z-index: var(--outer, ${fallback});
          }
        `),
      ),
    ).toHaveLength(count);
  });

  test('does not report nested candidates from malformed CSS if() syntax', async () => {
    for (const conditional of [
      'if(not: var(--inner, 9999); else: 1)',
      'if(style(): 9999; else: 1)',
      'if(style(:): 9999; else: 1)',
      'if(style(--theme:): 9999; else: 1)',
      'if(media(): 9999; else: 1)',
      'if(media(:): 9999; else: 1)',
      'if(media(width >): 9999; else: 1)',
      'if(media(10px < < 20px): 9999; else: 1)',
      'if(media(width > 10px > 1px): 9999; else: 1)',
      'if(media(width > 10px foo): 9999; else: 1)',
      'if(media(width > 10px and): 9999; else: 1)',
      'if(media(and width > 10px): 9999; else: 1)',
      'if(media(width > 10px and height > 20px): 9999; else: 1)',
      'if(media(only (width > 10px)): 9999; else: 1)',
      'if(media(screen or (width > 10px)): 9999; else: 1)',
      'if(media(screen and width > 10px): 9999; else: 1)',
      'if(media(screen and (width > 10px) or (height > 20px)): 9999; else: 1)',
      'if(media(screen and): 9999; else: 1)',
      'if(media(and screen): 9999; else: 1)',
      'if(media(or and (width > 10px)): 9999; else: 1)',
      'if(media(only): 9999; else: 1)',
      'if(media(not): 9999; else: 1)',
      'if(media(and): 9999; else: 1)',
      'if(media(or): 9999; else: 1)',
      'if(media(layer): 9999; else: 1)',
      'if(media(width > calc()): 9999; else: 1)',
      'if(media(width > min(, 10px)): 9999; else: 1)',
      'if(media(width > min(10px,)): 9999; else: 1)',
      'if(media(width > var(, fallback)): 9999; else: 1)',
      'if(media(width > min(var(, fallback), 20px)): 9999; else: 1)',
      'if(media(width > min(env(, fallback), 20px)): 9999; else: 1)',
      'if(media(width > min(attr(, fallback), 20px)): 9999; else: 1)',
      'if(supports(): 9999; else: 1)',
      'if(supports(:): 9999; else: 1)',
      'if(supports(display: grid, color: red): 9999; else: 1)',
      'if(unknown(display: grid): 9999; else: 1)',
      'if(style(--theme), 9999, 1)',
      'if(foo style(--theme: dark): 9999; else: 1)',
      'if(style(--theme: dark) foo: 9999; else: 1)',
      'if(style(--theme: dark) andfoo media(width > 1px): 9999; else: 1)',
    ])
      expect(
        warnings(
          await lint(`
            .fixture {
              /* cinder-z-index-local: malformed condition is not a selectable branch. */
              z-index: var(--outer, ${conditional});
            }
          `),
        ),
      ).toEqual([]);
  });

  test.each([
    [128, 'Offending expression: `9999`'],
    [129, 'too complex to verify safely'],
  ] as const)(
    'fails closed at the CSS if() boolean condition depth boundary: %i',
    async (depth, text) => {
      const condition = `${'('.repeat(depth)}style(--mode: elevated)${')'.repeat(depth)}`;
      const [warning] = warnings(
        await lint(`
        .fixture {
          /* cinder-z-index-local: conditional depth must fail closed. */
          z-index: var(--outer, if(${condition}: 9999; else: 1));
        }
      `),
      );

      expect(warning?.text).toContain(text);
    },
  );

  test('bounds deeply nested CSS if() branch analysis', async () => {
    const nestedConditional = `${Array.from(
      { length: 130 },
      (_, index) => `if(style(--condition-${index}: yes): `,
    ).join('')}9999${'; else: 1)'.repeat(130)}`;
    const [warning] = warnings(
      await lint(`
        .fixture {
          /* cinder-z-index-local: conditional nesting must stay within the shared budget. */
          z-index: var(--outer, ${nestedConditional});
        }
      `),
    );

    expect(warning?.text).toContain('too complex to verify safely');
  });

  test('anchors a diagnostic after property-value separator comments', async () => {
    const css = '.x { z-index/*var(--x,9999)*/: var(--x,9999); }';
    const result = warnings(await lint(css));
    const warning = result[0];
    const start = sourceLocation(css, css.lastIndexOf('9999'));
    const end = sourceLocation(css, css.lastIndexOf('9999') + 4);
    expect(warning?.column).toBe(start.column);
    expect(warning?.endColumn).toBe(end.column);
  });

  test('anchors a sibling conditional diagnostic to the branch that contributes the ban', async () => {
    const css = `
      .fixture {
        z-index: var(--outer, calc(if(style(--a: x): 1; else: 2) * 0 + if(style(--b: x): 9999; else: 1)));
      }
    `;
    const [warning] = warnings(await lint(css));
    const bannedIndex = css.indexOf('9999');
    const start = sourceLocation(css, bannedIndex);
    const end = sourceLocation(css, bannedIndex + 4);

    expect(warning?.column).toBe(start.column);
    expect(warning?.endColumn).toBe(end.column);
  });

  test('does not anchor a sibling conditional diagnostic to an eliminated branch', async () => {
    const css = `
      .fixture {
        z-index: var(--outer, calc(if(style(--a: x): 9999; else: 1) * 0 + if(style(--b: x): 10000; else: 1) - 1));
      }
    `;
    const [warning] = warnings(await lint(css));
    const contributingIndex = css.indexOf('10000');
    const start = sourceLocation(css, contributingIndex);
    const end = sourceLocation(css, contributingIndex + 5);

    expect(warning?.column).toBe(start.column);
    expect(warning?.endColumn).toBe(end.column);
  });
});
