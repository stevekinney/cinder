import { describe, expect, test } from 'bun:test';

import stylelint from 'stylelint';

const ruleName = 'cinder/no-focus-visible-colored-outline';

const pluginPath = new URL('./no-focus-visible-colored-outline.mjs', import.meta.url).pathname;

async function lintWithDirectRule(css: string) {
  const result = await stylelint.lint({
    code: css,
    config: {
      plugins: [pluginPath],
      rules: { [ruleName]: true },
    },
  });
  return result;
}

async function lintWithProjectConfig(css: string, codeFilename?: string) {
  const result = await stylelint.lint({
    code: css,
    ...(codeFilename === undefined ? {} : { codeFilename }),
    configFile: new URL('../../../../.stylelintrc.json', import.meta.url).pathname,
  });
  return result;
}

function warningsFor(result: Awaited<ReturnType<typeof stylelint.lint>>, rule = ruleName) {
  const all = result.results.flatMap((file) => file.warnings ?? []);
  return all.filter((warning) => warning.rule === rule);
}

describe('cinder/no-focus-visible-colored-outline — allowed patterns', () => {
  test('canonical transparent-outline + box-shadow recipe passes', async () => {
    const result = await lintWithDirectRule(`
      .x:focus-visible {
        outline: var(--cinder-ring-width) solid transparent;
        box-shadow: var(--_cinder-focus-ring-shadow);
      }
    `);
    expect(warningsFor(result)).toEqual([]);
  });

  test('hardcoded width with transparent color is allowed (preferred form is var(--cinder-ring-width))', async () => {
    const result = await lintWithDirectRule(`
      .x:focus-visible {
        outline: 2px solid transparent;
        box-shadow: var(--_cinder-focus-ring-shadow);
      }
    `);
    expect(warningsFor(result)).toEqual([]);
  });

  test('outline-offset is permitted in :focus-visible', async () => {
    const result = await lintWithDirectRule(`
      .x:focus-visible {
        outline: var(--cinder-ring-width) solid transparent;
        outline-offset: 2px;
        box-shadow: var(--_cinder-focus-ring-shadow);
      }
    `);
    expect(warningsFor(result)).toEqual([]);
  });

  test('forced-colors fallback may use a colored system-color outline', async () => {
    const result = await lintWithDirectRule(`
      @media (forced-colors: active) {
        .x:focus-visible {
          outline: var(--cinder-ring-width) solid CanvasText;
          outline-offset: 1px;
        }
      }
    `);
    expect(warningsFor(result)).toEqual([]);
  });

  test('forced-colors fallback is allowed when nested inside another non-forced-colors @media', async () => {
    const result = await lintWithDirectRule(`
      @media (hover: hover) {
        @media (forced-colors: active) {
          .x:focus-visible {
            outline: var(--cinder-ring-width) solid Highlight;
          }
        }
      }
    `);
    expect(warningsFor(result)).toEqual([]);
  });

  test('comma-separated media query is allowed when EVERY branch includes forced-colors: active', async () => {
    const result = await lintWithDirectRule(`
      @media (forced-colors: active), (forced-colors: active) and (max-width: 47.99rem) {
        .x:focus-visible {
          outline: var(--cinder-ring-width) solid Highlight;
        }
      }
    `);
    expect(warningsFor(result)).toEqual([]);
  });

  test('outline: none with an owner-parent comment is permitted', async () => {
    const result = await lintWithDirectRule(`
      .x:focus-visible {
        /* cinder-focus-ring-owner: parent */
        outline: none;
      }
    `);
    expect(warningsFor(result)).toEqual([]);
  });

  test('selectors that merely contain :focus-visible-related text are untouched outside :focus-visible', async () => {
    const result = await lintWithDirectRule(`
      .x:hover {
        outline: 2px solid red;
      }
    `);
    expect(warningsFor(result)).toEqual([]);
  });
});

describe('cinder/no-focus-visible-colored-outline — rejected patterns', () => {
  test('colored outline shorthand with token color is rejected', async () => {
    const result = await lintWithDirectRule(`
      .x:focus-visible {
        outline: var(--cinder-ring-width) solid var(--cinder-ring-color);
      }
    `);
    expect(warningsFor(result).length).toBe(1);
  });

  test('colored outline shorthand expressed through a token alias is rejected', async () => {
    const result = await lintWithDirectRule(`
      .x:focus-visible {
        outline: var(--bad-focus-outline);
      }
    `);
    expect(warningsFor(result).length).toBe(1);
  });

  test('outline-color longhand is rejected', async () => {
    const result = await lintWithDirectRule(`
      .x:focus-visible {
        outline-color: var(--cinder-ring-color);
      }
    `);
    expect(warningsFor(result).length).toBe(1);
  });

  test('outline-style longhand is rejected', async () => {
    const result = await lintWithDirectRule(`
      .x:focus-visible {
        outline-style: solid;
      }
    `);
    expect(warningsFor(result).length).toBe(1);
  });

  test('outline-width longhand is rejected', async () => {
    const result = await lintWithDirectRule(`
      .x:focus-visible {
        outline-width: 3px;
      }
    `);
    expect(warningsFor(result).length).toBe(1);
  });

  test('CanvasText / system-color outlines outside forced-colors are rejected', async () => {
    const result = await lintWithDirectRule(`
      .x:focus-visible {
        outline: var(--cinder-ring-width) solid CanvasText;
      }
    `);
    expect(warningsFor(result).length).toBe(1);
  });

  test('currentColor outline outside forced-colors is rejected', async () => {
    const result = await lintWithDirectRule(`
      .x:focus-visible {
        outline: 2px solid currentColor;
      }
    `);
    expect(warningsFor(result).length).toBe(1);
  });

  test('outline: revert in :focus-visible is rejected (not the transparent placeholder)', async () => {
    const result = await lintWithDirectRule(`
      .x:focus-visible {
        outline: revert;
      }
    `);
    expect(warningsFor(result).length).toBe(1);
  });

  test('outline: auto in :focus-visible is rejected', async () => {
    const result = await lintWithDirectRule(`
      .x:focus-visible {
        outline: auto;
      }
    `);
    expect(warningsFor(result).length).toBe(1);
  });

  test('outline: none without owner comment is rejected', async () => {
    const result = await lintWithDirectRule(`
      .x:focus-visible {
        outline: none;
      }
    `);
    expect(warningsFor(result).length).toBe(1);
  });

  test('media query with the feature reversed is NOT treated as forced-colors', async () => {
    const result = await lintWithDirectRule(`
      @media (active: forced-colors) {
        .x:focus-visible {
          outline: 2px solid CanvasText;
        }
      }
    `);
    expect(warningsFor(result).length).toBe(1);
  });

  test('comma-separated media query is rejected when only one branch is forced-colors', async () => {
    const result = await lintWithDirectRule(`
      @media (forced-colors: active), (hover: hover) {
        .x:focus-visible {
          outline: var(--cinder-ring-width) solid CanvasText;
        }
      }
    `);
    expect(warningsFor(result).length).toBe(1);
  });
});

describe('cinder/no-focus-visible-colored-outline — loaded through .stylelintrc.json', () => {
  test('canonical recipe passes when linted through the project config', async () => {
    const result = await lintWithProjectConfig(`
      .demo:focus-visible {
        outline: var(--cinder-ring-width) solid transparent;
        box-shadow: var(--_cinder-focus-ring-shadow);
      }
    `);
    expect(warningsFor(result)).toEqual([]);
  });

  test('colored outline is rejected when linted through the project config', async () => {
    const result = await lintWithProjectConfig(`
      .demo:focus-visible {
        outline: var(--cinder-ring-width) solid var(--cinder-ring-color);
      }
    `);
    expect(warningsFor(result).length).toBe(1);
  });

  test('colored outline inside a Svelte style block is rejected through the project config', async () => {
    const result = await lintWithProjectConfig(
      `
        <button class="demo">Demo</button>

        <style>
          .demo:focus-visible {
            outline: var(--cinder-ring-width) solid var(--cinder-ring-color);
          }
        </style>
      `,
      'fixture.svelte',
    );
    const hits = warningsFor(result);
    expect(hits.length).toBe(1);
    expect(hits[0]?.severity).toBe('error');
    expect(result.errored).toBe(true);
  });

  test('canonical recipe inside a Svelte style block passes through the project config', async () => {
    const result = await lintWithProjectConfig(
      `
        <button class="demo">Demo</button>

        <style>
          .demo:focus-visible {
            outline: var(--cinder-ring-width) solid transparent;
            box-shadow: var(--_cinder-focus-ring-shadow);
          }
        </style>
      `,
      'fixture.svelte',
    );
    expect(warningsFor(result)).toEqual([]);
  });
});
