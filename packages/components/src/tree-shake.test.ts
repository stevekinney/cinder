import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

import { describe, expect, test } from 'bun:test';

import { sveltePlugin } from '../scripts/svelte-plugin.ts';

const FORBIDDEN_BUTTON_BUNDLE_STRINGS = [
  'shiki',
  'unified',
  '@milkdown/kit',
  'diff-match-patch',
  'prosemirror',
  '--depict-',
];

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
];

const CHAT_SERVER_TEST_EXTERNALS: string[] = [
  'svelte',
  'svelte/*',
  '@lostgradient/cinder',
  '@lostgradient/cinder/*',
  '@modelcontextprotocol/sdk',
  '@modelcontextprotocol/sdk/*',
  '@shikijs/rehype',
  '@milkdown/kit',
  '@milkdown/kit/*',
  '@milkdown/prose',
  '@milkdown/prose/*',
  'ajv',
  'ajv/*',
  'comlink',
  'diff-match-patch',
  'hast-util-sanitize',
  'js-yaml',
  'prosemirror-inputrules',
  'prosemirror-model',
  'prosemirror-state',
  'prosemirror-view',
  'rehype-katex',
  'rehype-sanitize',
  'rehype-stringify',
  'remark-gfm',
  'remark-html',
  'remark-math',
  'remark-parse',
  'remark-rehype',
  'remark-stringify',
  'shiki',
  'unified',
  'unist-util-remove',
  'unist-util-visit',
  'zod',
  'zod/*',
];

const serverCssNoopPlugin = {
  name: 'server-css-noop',
  setup(build: Bun.PluginBuilder): void {
    build.onLoad({ filter: /\.css$/ }, () => ({
      contents: '',
      loader: 'js',
    }));
  },
};

async function collectRelativeJavaScriptGraph(entrypoint: string): Promise<string[]> {
  const visited = new Set<string>();
  const texts: string[] = [];
  const pending = [entrypoint];
  const relativeImportPattern =
    /(?:import\s*(?:[^'"]*?\sfrom\s*)?|export\s*[^'"]*?\sfrom\s*)["'](\.{1,2}\/[^"']+\.js)["']/g;

  while (pending.length > 0) {
    const filePath = pending.pop();
    if (filePath === undefined || visited.has(filePath)) continue;
    visited.add(filePath);

    const text = await Bun.file(filePath).text();
    texts.push(text);

    for (const match of text.matchAll(relativeImportPattern)) {
      const specifier = match[1];
      if (specifier === undefined) continue;
      pending.push(resolve(dirname(filePath), specifier));
    }
  }

  return texts;
}

describe('tree-shake contract', () => {
  async function createTemporaryFixtureDirectory(prefix: string): Promise<string> {
    const temporaryRoot = join(process.cwd(), '.tmp');
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

  test('a minimal cinder/chat SSR bundle does not include editor or markdown rendering peers', async () => {
    const temporaryDirectory = await createTemporaryFixtureDirectory('cinder-chat-server-');
    const packageManifest = (await Bun.file(join(process.cwd(), 'package.json')).json()) as {
      exports?: Record<string, { node?: string }>;
    };
    const chatNodeExport = packageManifest.exports?.['./chat']?.node;
    expect(chatNodeExport).toBe('./dist/server/components/chat/index.js');

    try {
      const result = await Bun.build({
        entrypoints: [join(process.cwd(), 'src/components/chat/index.ts')],
        outdir: join(temporaryDirectory, 'dist/server'),
        root: join(process.cwd(), 'src'),
        target: 'node',
        format: 'esm',
        splitting: true,
        external: CHAT_SERVER_TEST_EXTERNALS,
        naming: {
          entry: '[dir]/[name].[ext]',
          chunk: '[name]-[hash].[ext]',
          asset: '[name]-[hash].[ext]',
        },
        sourcemap: 'external',
        minify: false,
        plugins: [serverCssNoopPlugin, sveltePlugin({ generate: 'server' })],
      });

      expect(result.success).toBe(true);

      const entrypoint = join(temporaryDirectory, chatNodeExport ?? '');
      const outputTexts = await collectRelativeJavaScriptGraph(entrypoint);
      const bundledText = outputTexts.join('\n');

      for (const forbidden of FORBIDDEN_CHAT_SERVER_BUNDLE_STRINGS) {
        expect(bundledText).not.toContain(forbidden);
      }
    } finally {
      await rm(temporaryDirectory, { recursive: true, force: true });
    }
  });
});
