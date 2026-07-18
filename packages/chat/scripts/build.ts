import type { BunPlugin } from 'bun';
import { Glob } from 'bun';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { sveltePlugin } from '../../components/scripts/svelte-plugin.ts';
import { parsePackageManifest, peerExternalSpecifiers } from './pack-for-publish.ts';

const PACKAGE_ROOT = join(import.meta.dir, '..');

const result = Bun.spawnSync(['svelte-package'], {
  cwd: PACKAGE_ROOT,
  stdout: 'inherit',
  stderr: 'inherit',
});
if (result.exitCode !== 0) process.exit(result.exitCode ?? 1);

const emittedSourceGlob = new Glob('dist/**/*.{js,ts,svelte}');
let rewrittenFiles = 0;
for await (const relativePath of emittedSourceGlob.scan({ cwd: PACKAGE_ROOT })) {
  const path = join(PACKAGE_ROOT, relativePath);
  const source = await Bun.file(path).text();
  const publishedSource = source.replace(/(['"])(\.\.?\/[^'"]+)\.ts\1/g, '$1$2.js$1');
  if (publishedSource === source) continue;
  await Bun.write(path, publishedSource);
  rewrittenFiles += 1;
}

process.stdout.write(
  `build — rewrote TypeScript import specifiers in ${rewrittenFiles} emitted files\n`,
);

for (const cssPath of [
  'dist/components/chat/chat.css',
  'dist/components/chat-composer-popover/chat-composer-popover.css',
  'dist/components/chat-conversation-header/chat-conversation-header.css',
  'dist/components/chat-conversation-list/chat-conversation-list.css',
]) {
  await Bun.write(join(PACKAGE_ROOT, `${cssPath}.d.ts`), 'export {};\n');
}

const sourceRoot = join(PACKAGE_ROOT, 'src', 'lib');
const serverOutputRoot = join(PACKAGE_ROOT, 'dist', 'server');
const serverEntrypoints = [
  join(sourceRoot, 'index.ts'),
  join(sourceRoot, 'components', 'chat-composer-popover', 'index.ts'),
  join(sourceRoot, 'components', 'chat-conversation-header', 'index.ts'),
  join(sourceRoot, 'components', 'chat-conversation-list', 'index.ts'),
];
const serverCssNoopPlugin: BunPlugin = {
  name: 'chat-server-css-noop',
  setup(builder) {
    builder.onResolve({ filter: /\.css$/ }, ({ path }) => ({ path, namespace: 'css-noop' }));
    builder.onLoad({ filter: /.*/, namespace: 'css-noop' }, () => ({ contents: '', loader: 'js' }));
  },
};
const packageManifest = parsePackageManifest(
  await Bun.file(join(PACKAGE_ROOT, 'package.json')).text(),
);
const peerExternals = peerExternalSpecifiers(packageManifest);
async function buildServerEntries() {
  const previousNodeEnvironment = process.env['NODE_ENV'];
  process.env['NODE_ENV'] = 'production';

  try {
    return await Bun.build({
      entrypoints: serverEntrypoints,
      outdir: serverOutputRoot,
      root: sourceRoot,
      target: 'node',
      format: 'esm',
      splitting: true,
      external: peerExternals,
      naming: {
        entry: '[dir]/[name].[ext]',
        chunk: '_chunks/[name]-[hash].[ext]',
        asset: '_assets/[name]-[hash].[ext]',
      },
      minify: false,
      plugins: [serverCssNoopPlugin, sveltePlugin({ generate: 'server' })],
    });
  } finally {
    if (previousNodeEnvironment === undefined) delete process.env['NODE_ENV'];
    else process.env['NODE_ENV'] = previousNodeEnvironment;
  }
}

const serverBuild = await buildServerEntries();
if (!serverBuild.success) {
  process.stderr.write(`Chat server build failed:\n${serverBuild.logs.map(String).join('\n')}\n`);
  process.exit(1);
}

for (const expectedPath of [
  join(serverOutputRoot, 'index.js'),
  join(serverOutputRoot, 'components', 'chat-composer-popover', 'index.js'),
  join(serverOutputRoot, 'components', 'chat-conversation-header', 'index.js'),
  join(serverOutputRoot, 'components', 'chat-conversation-list', 'index.js'),
]) {
  if (!existsSync(expectedPath)) throw new Error(`server build is missing ${expectedPath}`);
  const serverSource = await Bun.file(expectedPath).text();
  if (/from\s+['"][^'"]+\.(?:css|svelte)['"]/u.test(serverSource)) {
    throw new Error(`server build retained a CSS or Svelte import in ${expectedPath}`);
  }
}
process.stdout.write('build — emitted plain-Node server entries for 4 public exports\n');
