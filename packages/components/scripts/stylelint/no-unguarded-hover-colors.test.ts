import { describe, expect, it } from 'bun:test';
import { fileURLToPath } from 'node:url';
import stylelint from 'stylelint';

const pluginPath = fileURLToPath(new URL('./no-unguarded-hover-colors.cjs', import.meta.url));

type LintOptions = {
  code: string;
  codeFilename?: string;
  customSyntax?: string;
};

async function lint({ code, codeFilename, customSyntax }: LintOptions) {
  const baseOptions = {
    code,
    codeFilename: codeFilename ?? '/virtual/example/component.css',
    config: {
      plugins: [pluginPath],
      rules: {
        'cinder/no-unguarded-hover-colors': true,
      },
    },
  };
  return customSyntax
    ? stylelint.lint({ ...baseOptions, customSyntax })
    : stylelint.lint(baseOptions);
}

function warningsOf(result: Awaited<ReturnType<typeof stylelint.lint>>) {
  const lintResult = result.results[0];
  return lintResult ? lintResult.warnings : [];
}

describe('cinder/no-unguarded-hover-colors', () => {
  it('rejects unguarded :hover { background: ... }', async () => {
    const result = await lint({
      code: `.cinder-example:hover { background: red; }`,
    });
    const warnings = warningsOf(result);
    expect(warnings).toHaveLength(1);
    const first = warnings[0]!;
    expect(first.rule).toBe('cinder/no-unguarded-hover-colors');
    expect(first.text).toContain('.cinder-example:hover');
    expect(first.text).toContain('background');
  });

  it('rejects unguarded :hover { background-color: ... }', async () => {
    const result = await lint({
      code: `.cinder-example:hover { background-color: red; }`,
    });
    expect(warningsOf(result)).toHaveLength(1);
  });

  it('rejects unguarded :hover { border-color: ... }', async () => {
    const result = await lint({
      code: `.cinder-example:hover { border-color: red; }`,
    });
    expect(warningsOf(result)).toHaveLength(1);
  });

  it('rejects unguarded :hover { border: shorthand }', async () => {
    const result = await lint({
      code: `.cinder-example:hover { border: 1px solid red; }`,
    });
    expect(warningsOf(result)).toHaveLength(1);
  });

  it('rejects unguarded :hover { border-inline-start-color: ... }', async () => {
    const result = await lint({
      code: `.cinder-example:hover { border-inline-start-color: red; }`,
    });
    expect(warningsOf(result)).toHaveLength(1);
  });

  it('accepts @media (hover: hover) wrapping the :hover rule', async () => {
    const result = await lint({
      code: `@media (hover: hover) { .cinder-example:hover { background: red; } }`,
    });
    expect(warningsOf(result)).toHaveLength(0);
  });

  it('accepts conjunctive media (forced-colors: active) and (hover: hover)', async () => {
    const result = await lint({
      code: `@media (forced-colors: active) and (hover: hover) { .cinder-example:hover { border-color: ButtonText; } }`,
    });
    expect(warningsOf(result)).toHaveLength(0);
  });

  it('accepts nested media where ancestor satisfies the guard', async () => {
    const result = await lint({
      code: `@media (hover: hover) { @media (prefers-reduced-motion: no-preference) { .cinder-example:hover { background: red; } } }`,
    });
    expect(warningsOf(result)).toHaveLength(0);
  });

  it('rejects comma-separated media list even when one branch is (hover: hover)', async () => {
    const result = await lint({
      code: `@media (hover: hover), (min-width: 1px) { .cinder-example:hover { background: red; } }`,
    });
    expect(warningsOf(result)).toHaveLength(1);
  });

  it('rejects negated media @media not (hover: hover)', async () => {
    const result = await lint({
      code: `@media not (hover: hover) { .cinder-example:hover { background: red; } }`,
    });
    expect(warningsOf(result)).toHaveLength(1);
  });

  it('passes :hover that only changes non-target properties', async () => {
    const result = await lint({
      code: `.cinder-example:hover { color: red; text-decoration: underline; z-index: 1; }`,
    });
    expect(warningsOf(result)).toHaveLength(0);
  });

  it('passes :focus-visible rules that change background/border', async () => {
    const result = await lint({
      code: `.cinder-example:focus-visible { background: red; border-color: blue; }`,
    });
    expect(warningsOf(result)).toHaveLength(0);
  });

  it('rejects :where(:hover, :focus-visible) when unguarded', async () => {
    const result = await lint({
      code: `.cinder-example:where(:hover, :focus-visible) { background: red; }`,
    });
    expect(warningsOf(result)).toHaveLength(1);
  });

  it('rejects (any-hover: hover) — only (hover: hover) is accepted', async () => {
    const result = await lint({
      code: `@media (any-hover: hover) { .cinder-example:hover { background: red; } }`,
    });
    expect(warningsOf(result)).toHaveLength(1);
  });

  it('rejects Svelte <style> block with unguarded :hover background', async () => {
    const result = await lint({
      code: `<style>.cinder-example:hover { background: red; }</style>`,
      codeFilename: '/virtual/example/component.svelte',
      customSyntax: 'postcss-html',
    });
    expect(warningsOf(result)).toHaveLength(1);
  });

  it('skips ::-webkit-scrollbar pseudo-elements (real cursor hover, not touch-synthesized)', async () => {
    const result = await lint({
      code: `.area::-webkit-scrollbar-thumb:hover { background: red; }`,
    });
    expect(warningsOf(result)).toHaveLength(0);
  });

  it('skips scrollbar thumb hover inside @media (forced-colors: active)', async () => {
    const result = await lint({
      code: `@media (forced-colors: active) { .area::-webkit-scrollbar-thumb:hover { background: ButtonText; } }`,
    });
    expect(warningsOf(result)).toHaveLength(0);
  });

  it('rejects unguarded :hover inside @supports (no hover guard ancestor)', async () => {
    const result = await lint({
      code: `@supports (display: grid) { .cinder-example:hover { background: red; } }`,
    });
    expect(warningsOf(result)).toHaveLength(1);
  });

  it('rejects @media not print and (hover: hover) — `not` modifier disqualifies', async () => {
    const result = await lint({
      code: `@media not print and (hover: hover) { .cinder-example:hover { background: red; } }`,
    });
    expect(warningsOf(result)).toHaveLength(1);
  });

  it('does not flag custom-property declarations in :hover (intentional — outside target set)', async () => {
    const result = await lint({
      code: `.cinder-example:hover { --cinder-surface-hover: red; }`,
    });
    expect(warningsOf(result)).toHaveLength(0);
  });

  it('emits one warning per offending declaration', async () => {
    const result = await lint({
      code: `.cinder-example:hover { background: red; border-color: blue; }`,
    });
    const warnings = warningsOf(result);
    expect(warnings).toHaveLength(2);
    const props = warnings.map((w) => w.text);
    expect(props.some((t) => t.includes('background'))).toBe(true);
    expect(props.some((t) => t.includes('border-color'))).toBe(true);
  });
});
