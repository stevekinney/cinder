import type { BunPlugin } from 'bun';
import { Glob } from 'bun';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import {
  findExtensionlessDeclarationSpecifiers,
  findSelfReferentialTypeImports,
  findUnresolvedArbitraryExtensionImports,
} from '../../components/scripts/lib/dist-relative-imports.ts';
import { emitArbitraryExtensionDeclarations } from '../../components/scripts/lib/emit-arbitrary-extension-declarations.ts';
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

// `pack-for-publish.ts` requires every `package.json#exports` `types` target to exist on disk —
// including each component's own `./<name>/styles` subpath, which points at this legacy
// `<base>.css.d.ts` name (not the Node16-correct one the step below adds). `svelte-package` never
// generates this file itself (unlike cinder's `emitDts()`), so it stays a hardcoded stub list.
for (const cssPath of [
  'dist/components/chat/chat.css',
  'dist/components/chat-composer-popover/chat-composer-popover.css',
  'dist/components/chat-conversation-header/chat-conversation-header.css',
  'dist/components/chat-conversation-list/chat-conversation-list.css',
  'dist/components/chat-navigation-rail/chat-navigation-rail.css',
  'dist/components/chat-sub-session/chat-sub-session.css',
]) {
  await Bun.write(join(PACKAGE_ROOT, `${cssPath}.d.ts`), 'export {};\n');
}

// Node16/bundler ESM resolution (what a real consumer's `"types"` condition uses, and what
// `attw` checks) ADDITIONALLY needs a `<base>.d.svelte.ts` / `<base>.d.css.ts` companion — using
// the extension-before-`.ts` naming above, not the extension-after-`.ts` naming the stub loop just
// wrote — for every `.svelte`/`.css` specifier a `.d.ts` file references. Neither `svelte-package`
// nor the stub loop above emits that naming; that mode does not accept the other one (see
// `emit-arbitrary-extension-declarations.ts`'s module doc for the `tsc --traceResolution` proof).
// This is driven by the specifiers a `.d.ts` file actually references, so it covers every current
// CSS/Svelte import and keeps covering one a future component adds without another hardcoded path.
const arbitraryExtensionResult = await emitArbitraryExtensionDeclarations(join(PACKAGE_ROOT, 'dist'));
process.stdout.write(
  `build — created ${arbitraryExtensionResult.createdDeclarations.length} arbitrary-extension declaration(s), rewrote ${arbitraryExtensionResult.rewrittenSpecifiers.length} extensionless specifier(s)\n`,
);

// Dist relative-import guard: fail the build if a `.d.ts` file still references a `.svelte`/`.css`
// specifier with no Node16-correct declaration companion, or a bare extensionless relative
// specifier — the two classes `attw` flags under Node16/bundler resolution. The step above should
// have already fixed every instance of both; this is the regression gate.
{
  const declarationGlob = new Glob('dist/**/*.d.ts');
  const unresolvedArbitraryExtensionImports: ReturnType<typeof findUnresolvedArbitraryExtensionImports> =
    [];
  const extensionlessDeclarationSpecifiers: ReturnType<typeof findExtensionlessDeclarationSpecifiers> =
    [];
  const selfReferentialTypeImports: ReturnType<typeof findSelfReferentialTypeImports> = [];
  for await (const relative of declarationGlob.scan({ cwd: PACKAGE_ROOT })) {
    const distRelative = relative.slice('dist/'.length);
    const content = await Bun.file(join(PACKAGE_ROOT, relative)).text();
    unresolvedArbitraryExtensionImports.push(
      ...findUnresolvedArbitraryExtensionImports(distRelative, content, (distRelativePath) =>
        existsSync(join(PACKAGE_ROOT, 'dist', distRelativePath)),
      ),
    );
    extensionlessDeclarationSpecifiers.push(
      ...findExtensionlessDeclarationSpecifiers(distRelative, content),
    );
    selfReferentialTypeImports.push(...findSelfReferentialTypeImports(distRelative, content));
  }
  if (
    unresolvedArbitraryExtensionImports.length > 0 ||
    extensionlessDeclarationSpecifiers.length > 0 ||
    selfReferentialTypeImports.length > 0
  ) {
    process.stderr.write(
      'Build aborted: relative import(s) in compiled output do not resolve under Node16:\n' +
        unresolvedArbitraryExtensionImports
          .map((offender) => `  ${offender.file} -> ${offender.specifier} (needs ${offender.requiredDeclarationPath})`)
          .join('\n') +
        extensionlessDeclarationSpecifiers
          .map((offender) => `  ${offender.file} -> ${offender.specifier}`)
          .join('\n') +
        selfReferentialTypeImports
          .map((offender) => `  ${offender.file} -> import(".").${offender.typeName}`)
          .join('\n') +
        '\n',
    );
    process.exit(1);
  }
}

const sourceRoot = join(PACKAGE_ROOT, 'src', 'lib');
const serverOutputRoot = join(PACKAGE_ROOT, 'dist', 'server');
const serverEntrypoints = [
  join(sourceRoot, 'index.ts'),
  join(sourceRoot, 'components', 'chat-composer-popover', 'index.ts'),
  join(sourceRoot, 'components', 'chat-conversation-header', 'index.ts'),
  join(sourceRoot, 'components', 'chat-conversation-list', 'index.ts'),
  join(sourceRoot, 'components', 'chat-navigation-rail', 'index.ts'),
  join(sourceRoot, 'components', 'chat-sub-session', 'index.ts'),
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
  process.stderr.write(`Chat server build failed:\n${serverBuild.logs.map(String).join('\n')}\n`);
  process.exit(1);
}

for (const expectedPath of [
  join(serverOutputRoot, 'index.js'),
  join(serverOutputRoot, 'components', 'chat-composer-popover', 'index.js'),
  join(serverOutputRoot, 'components', 'chat-conversation-header', 'index.js'),
  join(serverOutputRoot, 'components', 'chat-conversation-list', 'index.js'),
  join(serverOutputRoot, 'components', 'chat-navigation-rail', 'index.js'),
  join(serverOutputRoot, 'components', 'chat-sub-session', 'index.js'),
]) {
  if (!existsSync(expectedPath)) throw new Error(`server build is missing ${expectedPath}`);
  const serverSource = await Bun.file(expectedPath).text();
  if (/from\s+['"][^'"]+\.(?:css|svelte)['"]/u.test(serverSource)) {
    throw new Error(`server build retained a CSS or Svelte import in ${expectedPath}`);
  }
}
process.stdout.write('build — emitted plain-Node server entries for 6 public exports\n');
