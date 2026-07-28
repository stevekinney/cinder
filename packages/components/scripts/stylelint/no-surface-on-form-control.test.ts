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
    const [warning] = warnings(await lint('.cinder-input { background: var(--cinder-surface); }'));
    expect(warning?.text).toContain(
      'must not use `--cinder-surface` for their background; the default control fill is `--cinder-surface-raised`',
    );
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

  test('checks the published Chat composer source', async () => {
    expect(
      warnings(
        await lint(
          '.chat-input { background: var(--cinder-surface); }',
          '/workspace/packages/chat/src/lib/components/chat/input/chat-input.svelte',
        ),
      ),
    ).toHaveLength(1);
    expect(
      warnings(
        await lint(
          '.chat-input { background: var(--cinder-surface-raised); }',
          '/workspace/packages/chat/src/lib/components/chat/input/chat-input.svelte',
        ),
      ),
    ).toEqual([]);
  });

  test('checks the published Chat message edit textarea', async () => {
    expect(
      warnings(
        await lint(
          '.chat-message-edit-textarea { background: var(--cinder-surface); }',
          '/workspace/packages/chat/src/lib/components/chat/message/chat-message.svelte',
        ),
      ),
    ).toHaveLength(1);
    expect(
      warnings(
        await lint(
          '.chat-message-edit-textarea { background: var(--cinder-surface-raised); }',
          '/workspace/packages/chat/src/lib/components/chat/message/chat-message.svelte',
        ),
      ),
    ).toEqual([]);
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
      warnings(await lint('.cinder-input { background: var(--cinder-surface, white); }')),
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

  test('recognizes PinInput segment controls', async () => {
    expect(
      warnings(
        await lint(
          '.cinder-pin-input__segment { background: var(--cinder-surface); }',
          '/workspace/packages/components/src/components/pin-input/pin-input.css',
        ),
      ),
    ).toHaveLength(1);
  });

  test('recognizes native checkbox and radio controls', async () => {
    for (const selector of ['.cinder-checkbox', '.cinder-radio']) {
      expect(
        warnings(await lint(`${selector} { background: var(--cinder-surface); }`)),
      ).toHaveLength(1);
    }
  });

  test('recognizes PhoneInput native country and national controls', async () => {
    for (const selector of ['.cinder-phone-input__country', '.cinder-phone-input__national']) {
      expect(
        warnings(await lint(`${selector} { background: var(--cinder-surface); }`)),
      ).toHaveLength(1);
    }
  });

  test('recognizes InvocationRuleBuilder native controls', async () => {
    for (const selector of [
      '.cinder-invocation-rule-builder__rule-label-input',
      '.cinder-invocation-rule-builder__condition-select',
      '.cinder-invocation-rule-builder__condition-value',
      '.cinder-invocation-rule-builder__action-select',
    ]) {
      expect(
        warnings(await lint(`${selector} { background: var(--cinder-surface); }`)),
      ).toHaveLength(1);
    }
  });
});
