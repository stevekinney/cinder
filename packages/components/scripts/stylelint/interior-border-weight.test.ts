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
    expect(
      warnings(
        await lint(
          '.cinder-card__header { border-bottom: 1px solid var(--cinder-border, transparent); }',
        ),
      ),
    ).toHaveLength(1);
    expect(
      warnings(
        await lint('.cinder-table__cell { border-bottom: 1px solid var(--cinder-border); }'),
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
    expect(
      warnings(
        await lint(
          ".cinder-stat-group[data-cinder-variant='cards'] > .cinder-stat { border: 1px solid var(--cinder-border); }",
        ),
      ),
    ).toEqual([]);
    expect(
      warnings(
        await lint(
          '.cinder-checkbox-group__items > .cinder-checkbox-field { border: 1px solid var(--cinder-border); }',
        ),
      ),
    ).toEqual([]);
    expect(
      warnings(await lint('.modal-fixture__trigger { border: 1px solid var(--cinder-border); }')),
    ).toEqual([]);
  });

  test('rejects a muted full border around a raised surface', async () => {
    for (const raisedSurface of [
      '--cinder-surface-raised',
      '--cinder-surface-raised-hover',
      '--cinder-surface-raised-pressed',
    ]) {
      expect(
        warnings(
          await lint(
            `.cinder-card { background: var(${raisedSurface}); border: 1px solid var(--cinder-border-muted); }`,
          ),
        ),
      ).toHaveLength(1);
    }
  });

  test('resolves local aliases to raised surfaces', async () => {
    expect(
      warnings(
        await lint(
          ':root { --local-raised: var(--cinder-surface-raised); } .cinder-card { background: var(--local-raised); border: 1px solid var(--cinder-border-muted); }',
        ),
      ),
    ).toHaveLength(1);
  });

  test('checks shared component and Chat source files', async () => {
    expect(
      warnings(
        await stylelint.lint({
          code: '.cinder-card__header { border-bottom: 1px solid var(--cinder-border); }',
          codeFilename: '/workspace/packages/components/src/styles/components/card.css',
          config: { plugins: [pluginPath], rules: { [ruleName]: true } },
        }),
      ),
    ).toHaveLength(1);
    expect(
      warnings(
        await stylelint.lint({
          code: '.chat-card__header { border-bottom: 1px solid var(--cinder-border); }',
          codeFilename: '/workspace/packages/chat/src/lib/card.css',
          config: { plugins: [pluginPath], rules: { [ruleName]: true } },
        }),
      ),
    ).toHaveLength(1);
  });

  test('matches interior BEM elements at a name boundary', async () => {
    expect(
      warnings(
        await lint(
          '.cinder-card__header-actions { border-block-end: 1px solid var(--cinder-border); }',
        ),
      ),
    ).toEqual([]);
    expect(
      warnings(
        await lint(
          '.cinder-navigation__trigger { border-block-end: 1px solid var(--cinder-border); }',
        ),
      ),
    ).toHaveLength(1);
    expect(
      warnings(
        await lint(
          '.cinder-number-input__stepper { border-inline-start: 1px solid var(--cinder-border); }',
        ),
      ),
    ).toHaveLength(1);
    expect(
      warnings(
        await lint(
          '.cinder-table__row-header { border-block-end: 1px solid var(--cinder-border); }',
        ),
      ),
    ).toHaveLength(1);
    expect(
      warnings(
        await lint(
          '.cinder-table__column-header { border-inline-end: 1px solid var(--cinder-border); }',
        ),
      ),
    ).toHaveLength(1);
  });

  test('resolves border aliases before checking interior dividers', async () => {
    expect(
      warnings(
        await lint(
          ':root { --full-divider: var(--cinder-border); } .cinder-card__header { border-block-end: 1px solid var(--full-divider); }',
        ),
      ),
    ).toHaveLength(1);
  });

  test('resolves aliases in the declaration scope instead of later variants', async () => {
    expect(
      warnings(
        await lint(
          ':root { --divider: var(--cinder-border); } .cinder-card__header { border-block-end: 1px solid var(--divider); } .compact .cinder-card__header { --divider: var(--cinder-border-muted); }',
        ),
      ),
    ).toHaveLength(1);
  });
});
