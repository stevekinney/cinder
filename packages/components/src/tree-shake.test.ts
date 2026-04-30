import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, test } from 'bun:test';

import { sveltePlugin } from '../scripts/svelte-plugin.ts';

const FORBIDDEN_BUTTON_BUNDLE_STRINGS = [
  'shiki',
  'unified',
  '@milkdown/kit',
  'diff-match-patch',
  'prosemirror',
  '--depict-',
] as const;

describe('tree-shake contract', () => {
  test('a cinder/button-only bundle does not include domain-suite dependencies or legacy tokens', async () => {
    const temporaryDirectory = await mkdtemp(join(tmpdir(), 'cinder-tree-shake-'));
    const entrypoint = join(import.meta.dir, '.tree-shake-button-fixture.ts');

    await Bun.write(
      entrypoint,
      [
        "import Button from 'cinder/button';",
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
