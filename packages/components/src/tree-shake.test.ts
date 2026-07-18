import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { describe, expect, test } from 'bun:test';

import { sveltePlugin } from '../scripts/svelte-plugin.ts';

const packageRoot = resolve(import.meta.dir, '..');

const FORBIDDEN_BUTTON_BUNDLE_STRINGS = [
  'shiki',
  'unified',
  '@milkdown/kit',
  'diff-match-patch',
  'prosemirror',
  '--depict-',
];

describe('tree-shake contract', () => {
  async function createTemporaryFixtureDirectory(prefix: string): Promise<string> {
    const temporaryRoot = join(packageRoot, '.tmp');
    await mkdir(temporaryRoot, { recursive: true });
    return mkdtemp(join(temporaryRoot, prefix));
  }

  test('a cinder/button-only bundle does not include domain-suite dependencies or legacy tokens', async () => {
    const temporaryDirectory = await createTemporaryFixtureDirectory('cinder-tree-shake-');
    const entrypoint = join(temporaryDirectory, 'tree-shake-button-fixture.ts');

    await Bun.write(
      entrypoint,
      [
        "import Button from '@lostgradient/cinder/button';",
        'const componentReference = Button;',
        'console.log(typeof componentReference);',
        '',
      ].join('\n'),
    );

    try {
      const result = await Bun.build({
        entrypoints: [entrypoint],
        target: 'browser',
        format: 'esm',
        conditions: ['svelte'],
        plugins: [sveltePlugin({ generate: 'client' })],
      });

      expect(result.success).toBe(true);

      const outputTexts = await Promise.all(result.outputs.map(async (output) => output.text()));
      const bundledText = outputTexts.join('\n');

      for (const forbidden of FORBIDDEN_BUTTON_BUNDLE_STRINGS) {
        expect(bundledText).not.toContain(forbidden);
      }
    } finally {
      await Bun.file(entrypoint).delete();
      await rm(temporaryDirectory, { recursive: true, force: true });
    }
  });
});
