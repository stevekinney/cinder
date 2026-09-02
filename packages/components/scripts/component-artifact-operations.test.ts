import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { formatGenerated } from './component-artifact-operations.ts';
import { assertPrettierResolvesToRoot } from './lib/prettier-resolution.ts';

const repositoryRoot = resolve(import.meta.dirname, '../../..');

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
   * touched `packages/components`. The pipeline must format with the root's copy.
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
    expect(resolvedFrom).not.toContain('/packages/components/node_modules/');
  });

  /**
   * Previously ANY failure returned `content` unchanged. Under this very harness
   * that meant `formatGenerated` silently no-op'd -- `resolveConfig` is absent from
   * the standalone build -- and nothing ever said so. The error must now name the
   * file and where prettier was resolved from, whichever build is loaded.
   */
  test('surfaces a formatting failure naming the file and the resolved prettier', async () => {
    const attempt = formatGenerated('export const = ;', '/generated/broken.ts');

    await expect(attempt).rejects.toThrow(/failed to format \/generated\/broken\.ts/);
    await expect(attempt).rejects.toThrow(
      /prettier \d+\.\d+\.\d+ \(file:.*\/node_modules\/prettier\//,
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
});
