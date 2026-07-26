import { describe, expect, test } from 'bun:test';
import stylelint from 'stylelint';

const ruleName = 'cinder/no-surface-on-form-control';
const pluginPath = new URL('./no-surface-on-form-control.mjs', import.meta.url).pathname;

async function lint(code: string, codeFilename?: string) {
  return stylelint.lint({
    code,
    ...(codeFilename ? { codeFilename } : {}),
    config: { plugins: [pluginPath], rules: { [ruleName]: true } },
  });
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

  test('resolves local aliases and fallbacks', async () => {
    expect(
      warnings(
        await lint(
          ':root { --control-bg: var(--cinder-surface); } .cinder-input { background: var(--control-bg); }',
        ),
      ),
    ).toHaveLength(1);
    expect(
      warnings(
        await lint(
          ':root { --control-bg: var(--missing, var(--cinder-surface)); } .cinder-input { background: linear-gradient(red, var(--control-bg)); }',
        ),
      ),
    ).toHaveLength(1);
  });

  test('checks the shared input frame recipe in the component styles directory', async () => {
    expect(
      warnings(
        await lint(
          '.cinder-_input-frame { background: var(--cinder-surface); }',
          '/workspace/packages/components/src/styles/components/_input-frame.css',
        ),
      ),
    ).toHaveLength(1);
  });
});
