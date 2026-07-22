import type { BunPlugin } from 'bun';
import { Glob } from 'bun';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { sveltePlugin } from '../../components/scripts/svelte-plugin.ts';
import { parsePackageManifest, runtimeExternalSpecifiers } from './pack-for-publish.ts';

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
  'dist/components/markdown-editor/markdown-editor.css',
  'dist/components/review-editor/review-editor.css',
  'dist/components/diff-viewer/diff-viewer.css',
]) {
  await Bun.write(join(PACKAGE_ROOT, `${cssPath}.d.ts`), 'export {};\n');
}

const sourceRoot = join(PACKAGE_ROOT, 'src', 'lib');
const serverOutputRoot = join(PACKAGE_ROOT, 'dist', 'server');
// The root export (`.`) is plain TypeScript — comments, sessions, export, and
// the ProseMirror/Milkdown runtime, no Svelte — so it needs no server-target
// Svelte compilation, only the three real components do.
const serverEntrypoints = [
  join(sourceRoot, 'index.ts'),
  join(sourceRoot, 'components', 'markdown-editor', 'index.ts'),
  join(sourceRoot, 'components', 'review-editor', 'index.ts'),
  join(sourceRoot, 'components', 'diff-viewer', 'index.ts'),
];
const serverCssNoopPlugin: BunPlugin = {
  name: 'editor-server-css-noop',
  setup(builder) {
    builder.onResolve({ filter: /\.css$/ }, ({ path }) => ({ path, namespace: 'css-noop' }));
    builder.onLoad({ filter: /.*/, namespace: 'css-noop' }, () => ({ contents: '', loader: 'js' }));
  },
};
const packageManifest = parsePackageManifest(
  await Bun.file(join(PACKAGE_ROOT, 'package.json')).text(),
);
const runtimeExternals = runtimeExternalSpecifiers(packageManifest);
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
      external: runtimeExternals,
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
  process.stderr.write(`Editor server build failed:\n${serverBuild.logs.map(String).join('\n')}\n`);
  process.exit(1);
}

for (const expectedPath of [
  join(serverOutputRoot, 'index.js'),
  join(serverOutputRoot, 'components', 'markdown-editor', 'index.js'),
  join(serverOutputRoot, 'components', 'review-editor', 'index.js'),
  join(serverOutputRoot, 'components', 'diff-viewer', 'index.js'),
]) {
  if (!existsSync(expectedPath)) throw new Error(`server build is missing ${expectedPath}`);
  const serverSource = await Bun.file(expectedPath).text();
  if (/from\s+['"][^'"]+\.(?:css|svelte)['"]/u.test(serverSource)) {
    throw new Error(`server build retained a CSS or Svelte import in ${expectedPath}`);
  }
}
process.stdout.write('build — emitted plain-Node server entries for 4 public exports\n');
