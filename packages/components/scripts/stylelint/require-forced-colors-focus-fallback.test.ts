import { describe, expect, test } from 'bun:test';

import stylelint from 'stylelint';

const ruleName = 'cinder/require-forced-colors-focus-fallback';
const pluginPath = new URL('./require-forced-colors-focus-fallback.mjs', import.meta.url).pathname;

async function lintWithDirectRule(css: string) {
  return stylelint.lint({
    code: css,
    config: {
      plugins: [pluginPath],
      rules: { [ruleName]: true },
    },
  });
}

function warningsFor(result: Awaited<ReturnType<typeof stylelint.lint>>, rule = ruleName) {
  return result.results.flatMap((file) => file.warnings ?? []).filter((w) => w.rule === rule);
}

describe('cinder/require-forced-colors-focus-fallback — passing fixtures', () => {
  test('a :focus-visible rule with box-shadow AND a forced-colors outline fallback passes', async () => {
    const result = await lintWithDirectRule(`
      .x:focus-visible {
        outline: var(--cinder-ring-width) solid transparent;
        box-shadow: var(--_cinder-focus-ring-shadow);
      }
      @media (forced-colors: active) {
        .x:focus-visible {
          outline: var(--cinder-ring-width) solid ButtonText;
          outline-offset: 2px;
        }
      }
    `);
    expect(warningsFor(result)).toEqual([]);
  });

  test('a :focus-visible rule with no box-shadow does not require a forced-colors fallback', async () => {
    const result = await lintWithDirectRule(`
      .x:focus-visible {
        outline: var(--cinder-ring-width) solid transparent;
      }
    `);
    expect(warningsFor(result)).toEqual([]);
  });

  test('a non-:focus-visible rule with box-shadow does not trigger the check', async () => {
    const result = await lintWithDirectRule(`
      .x:hover {
        box-shadow: 0 0 0 2px blue;
      }
    `);
    expect(warningsFor(result)).toEqual([]);
  });

  test('a forced-colors fallback using CanvasText is accepted', async () => {
    const result = await lintWithDirectRule(`
      .y:focus-visible {
        outline: var(--cinder-ring-width) solid transparent;
        box-shadow: var(--_cinder-focus-ring-shadow);
      }
      @media (forced-colors: active) {
        .y:focus-visible {
          outline: var(--cinder-ring-width) solid CanvasText;
        }
      }
    `);
    expect(warningsFor(result)).toEqual([]);
  });

  test('multiple selectors are each covered by their own forced-colors block', async () => {
    const result = await lintWithDirectRule(`
      .a:focus-visible,
      .b:focus-visible {
        outline: var(--cinder-ring-width) solid transparent;
        box-shadow: var(--_cinder-focus-ring-shadow);
      }
      @media (forced-colors: active) {
        .a:focus-visible,
        .b:focus-visible {
          outline: var(--cinder-ring-width) solid ButtonText;
          outline-offset: 2px;
        }
      }
    `);
    expect(warningsFor(result)).toEqual([]);
  });
});

describe('cinder/require-forced-colors-focus-fallback — negative fixture (catches missing fallback)', () => {
  test('a :focus-visible rule with box-shadow but NO forced-colors fallback is reported', async () => {
    const result = await lintWithDirectRule(`
      .missing-fallback:focus-visible {
        outline: var(--cinder-ring-width) solid transparent;
        box-shadow: var(--_cinder-focus-ring-shadow);
      }
    `);
    const hits = warningsFor(result);
    expect(hits.length).toBe(1);
    expect(hits[0]?.text).toContain('.missing-fallback:focus-visible');
  });

  test('a forced-colors block with transparent outline does not count as a fallback', async () => {
    const result = await lintWithDirectRule(`
      .transparent-fallback:focus-visible {
        outline: var(--cinder-ring-width) solid transparent;
        box-shadow: var(--_cinder-focus-ring-shadow);
      }
      @media (forced-colors: active) {
        .transparent-fallback:focus-visible {
          outline: var(--cinder-ring-width) solid transparent;
        }
      }
    `);
    const hits = warningsFor(result);
    expect(hits.length).toBe(1);
  });

  test('a forced-colors block covering only one selector does not exempt a second uncovered selector', async () => {
    const result = await lintWithDirectRule(`
      .covered:focus-visible {
        outline: var(--cinder-ring-width) solid transparent;
        box-shadow: var(--_cinder-focus-ring-shadow);
      }
      .uncovered:focus-visible {
        outline: var(--cinder-ring-width) solid transparent;
        box-shadow: var(--_cinder-focus-ring-shadow);
      }
      @media (forced-colors: active) {
        .covered:focus-visible {
          outline: var(--cinder-ring-width) solid ButtonText;
        }
      }
    `);
    const hits = warningsFor(result);
    expect(hits.length).toBe(1);
    expect(hits[0]?.text).toContain('.uncovered:focus-visible');
  });
});

describe('cinder/require-forced-colors-focus-fallback — severity matches policy', () => {
  // When the rule is loaded directly (not through .stylelintrc.json which does
  // not enable it globally to avoid a mass-fix of pre-existing violations in
  // other components), the default stylelint severity for `true` is `error`.
  // This prevents any future adoption of the rule at warning level instead.
  test('a missing forced-colors fallback is reported at error severity when the rule is active', async () => {
    const result = await lintWithDirectRule(`
      .unguarded:focus-visible {
        outline: var(--cinder-ring-width) solid transparent;
        box-shadow: var(--_cinder-focus-ring-shadow);
      }
    `);
    const hits = warningsFor(result);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]?.severity).toBe('error');
  });

  test('a guarded selector with forced-colors fallback reports no violations', async () => {
    const result = await lintWithDirectRule(`
      .guarded:focus-visible {
        outline: var(--cinder-ring-width) solid transparent;
        box-shadow: var(--_cinder-focus-ring-shadow);
      }
      @media (forced-colors: active) {
        .guarded:focus-visible {
          outline: var(--cinder-ring-width) solid ButtonText;
          outline-offset: 2px;
        }
      }
    `);
    expect(warningsFor(result)).toEqual([]);
  });
});
