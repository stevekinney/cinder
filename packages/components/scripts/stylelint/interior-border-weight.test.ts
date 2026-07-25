import { describe, expect, test } from 'bun:test';
import stylelint from 'stylelint';

const ruleName = 'cinder/interior-border-weight';
const pluginPath = new URL('./interior-border-weight.mjs', import.meta.url).pathname;

async function lint(code: string) {
  return stylelint.lint({ code, config: { plugins: [pluginPath], rules: { [ruleName]: true } } });
}

function warnings(result: Awaited<ReturnType<typeof stylelint.lint>>) {
  return result.results
    .flatMap((file) => file.warnings ?? [])
    .filter((warning) => warning.rule === ruleName);
}

describe(ruleName, () => {
  test('rejects a full-strength interior divider', async () => {
    expect(
      warnings(
        await lint('.cinder-card__header { border-block-end: 1px solid var(--cinder-border); }'),
      ),
    ).toHaveLength(1);
  });

  test('allows muted interior and full-strength outer borders', async () => {
    expect(
      warnings(
        await lint(
          '.cinder-card__header { border-block-end: 1px solid var(--cinder-border-muted); }',
        ),
      ),
    ).toEqual([]);
    expect(
      warnings(await lint('.cinder-card { border: 1px solid var(--cinder-border); }')),
    ).toEqual([]);
  });
});
