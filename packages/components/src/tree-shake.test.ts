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

const FORBIDDEN_CHAT_SERVER_BUNDLE_STRINGS = [
  '@cinder/markdown/rendering',
  '@lostgradient/cinder/markdown/rendering',
  '@milkdown/kit',
  'comlink',
  'hast-util-sanitize',
  'prosemirror',
  'rehype-sanitize',
  'remark-gfm',
  'shiki/wasm',
] as const;

describe('tree-shake contract', () => {
  test('a cinder/button-only bundle does not include domain-suite dependencies or legacy tokens', async () => {
    const temporaryDirectory = await mkdtemp(join(tmpdir(), 'cinder-tree-shake-'));
    const entrypoint = join(import.meta.dir, '.tree-shake-button-fixture.ts');

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

  test('a minimal cinder/chat SSR bundle does not include editor or markdown rendering peers', async () => {
    const temporaryDirectory = await mkdtemp(join(tmpdir(), 'cinder-chat-ssr-'));
    const entrypoint = join(import.meta.dir, '.tree-shake-chat-ssr-fixture.ts');

    await Bun.write(
      entrypoint,
      [
        "import Chat from '@lostgradient/cinder/chat';",
        'const componentReference = Chat;',
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
        plugins: [sveltePlugin({ generate: 'server' })],
      });

      expect(result.success).toBe(true);

      const outputTexts = await Promise.all(result.outputs.map(async (output) => output.text()));
      const bundledText = outputTexts.join('\n');

      for (const forbidden of FORBIDDEN_CHAT_SERVER_BUNDLE_STRINGS) {
        expect(bundledText).not.toContain(forbidden);
      }
    } finally {
      await Bun.file(entrypoint).delete();
      await rm(temporaryDirectory, { recursive: true, force: true });
    }
  });
});
