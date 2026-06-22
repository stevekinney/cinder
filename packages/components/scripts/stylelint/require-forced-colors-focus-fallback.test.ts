import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'bun:test';

import stylelint from 'stylelint';

const ruleName = 'cinder/require-forced-colors-focus-fallback';
// `fileURLToPath` (not `.pathname`) so the path is correct on Windows and when
// the repo path contains spaces or URL-encoded characters.
const pluginPath = fileURLToPath(
  new URL('./require-forced-colors-focus-fallback.mjs', import.meta.url),
);

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
    // Bordered control pattern: 3px offset (matches button.css precedent —
    // 3px separates the ring from ButtonBorder in HCM), explicit box-shadow:none.
    const result = await lintWithDirectRule(`
      .x:focus-visible {
        outline: var(--cinder-ring-width) solid transparent;
        box-shadow: var(--_cinder-focus-ring-shadow);
      }
      @media (forced-colors: active) {
        .x:focus-visible {
          outline: var(--cinder-ring-width) solid ButtonText;
          outline-offset: 3px;
          box-shadow: none;
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

  test('a :focus-visible rule whose box-shadow is `none` does not require a fallback', async () => {
    // `box-shadow: none` cannot render a ring, so it needs no forced-colors
    // fallback. A suppressor (e.g. stripping a decorative pill shadow on a
    // selected-but-unfocused state) must not be flagged.
    const result = await lintWithDirectRule(`
      .x:focus-visible {
        box-shadow: none;
      }
    `);
    expect(warningsFor(result)).toEqual([]);
  });

  test('a `:not(:focus-visible)` rule with box-shadow is NOT treated as a focus ring', async () => {
    // The `:focus-visible` here is negated — the rule matches elements that are
    // NOT focus-visible, so it can never be a focus ring and needs no fallback.
    const result = await lintWithDirectRule(`
      .x[data-selected]:not(:focus-visible) {
        box-shadow: 0 0 0 2px blue;
      }
    `);
    expect(warningsFor(result)).toEqual([]);
  });

  test('a `:focus-visible::before` ring is covered by a forced-colors fallback on the same pseudo selector', async () => {
    // When the visible ring is painted on a `::before` pseudo, the forced-colors
    // fallback must repaint on that SAME selector (an outline on the parent would
    // depend on fragile geometry and not hug the visible chip).
    const result = await lintWithDirectRule(`
      .x:focus-visible::before {
        box-shadow: inset 0 0 0 var(--cinder-ring-width) var(--cinder-ring-color);
      }
      @media (forced-colors: active) {
        .x:focus-visible::before {
          box-shadow: none;
          outline: var(--cinder-ring-width) solid ButtonText;
          outline-offset: var(--cinder-ring-offset);
        }
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

  test('a forced-colors fallback using the `outline-color` longhand is accepted', async () => {
    const result = await lintWithDirectRule(`
      .y:focus-visible {
        outline: var(--cinder-ring-width) solid transparent;
        box-shadow: var(--_cinder-focus-ring-shadow);
      }
      @media (forced-colors: active) {
        .y:focus-visible {
          outline-style: solid;
          outline-color: ButtonText;
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
          outline-offset: 3px;
          box-shadow: none;
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

  test('a forced-colors block with `outline: none` does not count as a fallback', async () => {
    // A no-op outline must not satisfy the rule — that would silently leave the
    // control with no visible focus ring in forced-colors mode.
    const result = await lintWithDirectRule(`
      .none-fallback:focus-visible {
        outline: var(--cinder-ring-width) solid transparent;
        box-shadow: var(--_cinder-focus-ring-shadow);
      }
      @media (forced-colors: active) {
        .none-fallback:focus-visible {
          outline: none;
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
  // The rule is wired into .stylelintrc.json so it runs during `bun run lint`.
  // The default stylelint severity for `true` is `error`.
  // This prevents future adoption of the rule at warning level instead.
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
          outline-offset: 3px;
          box-shadow: none;
        }
      }
    `);
    expect(warningsFor(result)).toEqual([]);
  });
});
