import { describe, expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { throwingRejectionOf } from '@lostgradient/testing';
import { formatGenerated } from './component-artifact-operations.ts';
import { assertPrettierResolvesToRoot } from './lib/prettier-resolution.ts';

const repositoryRoot = resolve(import.meta.dirname, '../../..');
const packageRoot = resolve(import.meta.dirname, '..');

/**
 * The happy path -- `formatGenerated` producing correctly formatted artifacts --
 * is deliberately NOT asserted here. This suite runs under
 * `--conditions browser --conditions svelte`, which resolves `prettier` to its
 * `standalone.mjs` build: no `resolveConfig`, no parsers. The real pipeline runs
 * under plain Bun and is gated by `components:check` in CI's `static-artifact`
 * lane, which regenerates every artifact and diffs it against the committed
 * copy. A formatting test that passed here would be testing a different prettier
 * than the one that ships. What CAN be pinned here is what CIN-456 asks for:
 * which prettier the pipeline resolves, and that failures are no longer silent.
 */
describe('formatGenerated prettier resolution', () => {
  /**
   * The regression this pins: adding a workspace member with a different
   * `prettier` range once made bun nest a newer prettier under this package, and
   * the artifact pipeline formatted with it while the root stayed locked on
   * another version -- ~150 READMEs reported stale on a branch that never
   * touched `components/cinder`. The pipeline must format with the root's copy.
   */
  test('resolves prettier to the version the repository root locks', () => {
    const parsed: unknown = JSON.parse(
      readFileSync(join(repositoryRoot, 'node_modules', 'prettier', 'package.json'), 'utf8'),
    );
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('version' in parsed) ||
      typeof parsed.version !== 'string'
    ) {
      throw new Error('root prettier package.json has no string version');
    }
    const rootVersion: string = parsed.version;

    const { version, resolvedFrom } = assertPrettierResolvesToRoot();

    expect(version).toBe(rootVersion);
    expect(resolvedFrom).toContain('/node_modules/prettier/');
    // A copy nested under this package would resolve from a different tree.
    expect(resolvedFrom).not.toContain(`${packageRoot}/node_modules/`);
  });

  /**
   * Previously ANY failure returned `content` unchanged. Under this very harness
   * that meant `formatGenerated` silently no-op'd -- `resolveConfig` is absent from
   * the standalone build -- and nothing ever said so. The error must now name the
   * file and where prettier was resolved from, whichever build is loaded.
   */
  test('surfaces a formatting failure naming the file and the resolved prettier', async () => {
    const attempt = formatGenerated('export const = ;', '/generated/broken.ts');

    expect(await throwingRejectionOf(attempt)).toThrow(/failed to format \/generated\/broken\.ts/);
    expect(await throwingRejectionOf(attempt)).toThrow(
      /prettier \d+\.\d+\.\d+ \(file:.*\/node_modules\/prettier\//,
    );
    // The underlying error's own message is in the string, not only in `cause`,
    // because components:check logs only `err.message` for a stage failure.
    // (Under the test harness that underlying error is the standalone build's
    // missing `resolveConfig`, not a parser error -- the guard on the message
    // shape is what matters, not which failure it carried.)
    const thrown: unknown = await attempt.catch((error: unknown) => error);
    expect(thrown).toBeInstanceOf(Error);
    if (!(thrown instanceof Error)) return;
    expect(thrown.cause).toBeInstanceOf(Error);
    if (!(thrown.cause instanceof Error)) return;
    expect(thrown.cause.message.length).toBeGreaterThan(0);
    expect(thrown.message).toEndWith(
      `failed to format /generated/broken.ts: ${thrown.cause.message}`,
    );
  });

  test('does not return unformatted content on failure', async () => {
    const content = 'export const = ;';
    let result: string | undefined;
    try {
      result = await formatGenerated(content, '/generated/broken.ts');
    } catch {
      // expected
    }
    expect(result).toBeUndefined();
  });

  test('resolves prettier overrides per generated file in one component directory', async () => {
    const temporaryDirectory = mkdtempSync(join(tmpdir(), 'cinder-format-generated-'));
    const scriptPath = join(temporaryDirectory, 'probe.ts');
    const operationsPath = join(packageRoot, 'scripts/component-artifact-operations.ts');
    const componentDirectory = join(packageRoot, 'src/components/run-step-timeline');
    const markdownInput =
      '| Name | Description |\n' +
      '| --- | --- |\n' +
      '| `RunStepDetail` | A detail with enough prose to make Prettier want to wrap the table cell when proseWrap is not never. |\n';

    writeFileSync(
      scriptPath,
      [
        "import * as prettier from 'prettier';",
        `import { formatGenerated } from ${JSON.stringify(operationsPath)};`,
        `const componentDirectory = ${JSON.stringify(componentDirectory)};`,
        `const markdownInput = ${JSON.stringify(markdownInput)};`,
        'const jsonPath = `${componentDirectory}/run-step-timeline.schema.json`;',
        'const markdownPath = `${componentDirectory}/README.md`;',
        'await formatGenerated(\'{"b":2,"a":1}\', jsonPath);',
        'const formattedMarkdown = await formatGenerated(markdownInput, markdownPath);',
        'const markdownOptions = await prettier.resolveConfig(markdownPath);',
        'const freshMarkdown = await prettier.format(markdownInput, { ...markdownOptions, filepath: markdownPath });',
        'console.log(JSON.stringify({ formattedMarkdown, freshMarkdown, proseWrap: markdownOptions?.proseWrap }));',
      ].join('\n'),
    );

    try {
      const subprocess = Bun.spawn({
        cmd: [process.execPath, scriptPath],
        cwd: repositoryRoot,
        stdout: 'pipe',
        stderr: 'pipe',
        env: process.env,
      });
      const [stdout, stderr, exitCode] = await Promise.all([
        new Response(subprocess.stdout).text(),
        new Response(subprocess.stderr).text(),
        subprocess.exited,
      ]);

      expect(stderr).toBe('');
      expect(exitCode).toBe(0);
      const parsed = JSON.parse(stdout) as {
        formattedMarkdown: string;
        freshMarkdown: string;
        proseWrap?: string;
      };
      expect(parsed.formattedMarkdown).toBe(parsed.freshMarkdown);
      expect(parsed.formattedMarkdown).toMatch(/\|\s*`RunStepDetail`\s*\|/);
      if (parsed.proseWrap === 'never') {
        expect(parsed.formattedMarkdown).toContain('| Name | Description |');
      } else {
        expect(parsed.formattedMarkdown).toContain('| Name            | Description');
      }
    } finally {
      rmSync(temporaryDirectory, { recursive: true, force: true });
    }
  });
});
