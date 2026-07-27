import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'bun:test';
import stylelint from 'stylelint';

const ruleName = 'cinder/z-index-scale';
const pluginPath = fileURLToPath(new URL('./z-index-scale.mjs', import.meta.url));

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
  test.each([
    'auto',
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

  test('rejects an undeclared token even with a local reason', async () => {
    const result = warnings(
      await lint(
        '.fixture { /* cinder-z-index-local: local layer. */ z-index: var(--cinder-z-popvoer); }',
      ),
    );
    expect(result).toHaveLength(1);
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
