import { describe, expect, test } from 'bun:test';
import stylelint from 'stylelint';

const ruleName = 'cinder/no-surface-on-form-control';
const pluginPath = new URL('./no-surface-on-form-control.mjs', import.meta.url).pathname;

async function lint(code: string) {
  return stylelint.lint({ code, config: { plugins: [pluginPath], rules: { [ruleName]: true } } });
}

function warnings(result: Awaited<ReturnType<typeof stylelint.lint>>) {
  return result.results
    .flatMap((file) => file.warnings ?? [])
    .filter((warning) => warning.rule === ruleName);
}

describe(ruleName, () => {
  test('rejects the page surface on a form control', async () => {
    expect(
      warnings(await lint('.cinder-input { background: var(--cinder-surface); }')),
    ).toHaveLength(1);
  });

  test('allows the raised surface and non-form surfaces', async () => {
    expect(
      warnings(await lint('.cinder-input { background: var(--cinder-surface-raised); }')),
    ).toEqual([]);
    expect(warnings(await lint('.cinder-card { background: var(--cinder-surface); }'))).toEqual([]);
  });

  test('checks background-color and does not match compound class names', async () => {
    expect(
      warnings(await lint('.cinder-input { background-color: var(--cinder-surface); }')),
    ).toHaveLength(1);
    expect(warnings(await lint('.chat-input-area { background: var(--cinder-surface); }'))).toEqual(
      [],
    );
  });
});
