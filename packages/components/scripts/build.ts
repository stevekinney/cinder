import { $ } from 'bun';
import { emitDts } from 'svelte2tsx';

import { sveltePlugin } from './svelte-plugin.ts';

const repositoryRoot = process.cwd();
const distributionDirectory = `${repositoryRoot}/dist`;
const svelteShimsPath = Bun.resolveSync('svelte2tsx/svelte-shims-v4.d.ts', repositoryRoot);

async function createServerEntry(): Promise<string> {
  const sourcePath = `${repositoryRoot}/src/index.ts`;
  const serverEntryPath = `${repositoryRoot}/node_modules/.cache/server-entry.ts`;
  const source = await Bun.file(sourcePath).text();
  const imports: string[] = [];
  const exportNames: string[] = [];

  for (const line of source.split('\n')) {
    const defaultExportMatch = /^export \{ default as ([A-Za-z0-9_]+) \} from '(\.[^']+)';$/.exec(
      line,
    );
    if (defaultExportMatch) {
      const [, name, importPath] = defaultExportMatch;
      if (name && importPath) {
        imports.push(`import ${name} from '../../src/${importPath.slice(2)}';`);
        exportNames.push(name);
      }
      continue;
    }

    const namedExportMatch = /^export \{ ([A-Za-z0-9_,\s]+) \} from '(\.[^']+)';$/.exec(line);
    if (namedExportMatch) {
      const [, names, importPath] = namedExportMatch;
      if (names && importPath) {
        imports.push(`import { ${names} } from '../../src/${importPath.slice(2)}';`);
        exportNames.push(
          ...names
            .split(',')
            .map((name) => name.trim())
            .filter(Boolean),
        );
      }
    }
  }

  await Bun.write(
    serverEntryPath,
    [
      imports.join('\n'),
      '',
      exportNames.map((name) => `const ${name}Export = ${name};`).join('\n'),
      '',
      `export {\n  ${exportNames.map((name) => `${name}Export as ${name}`).join(',\n  ')},\n};`,
      '',
    ].join('\n'),
  );

  return serverEntryPath;
}

// Fail fast if package.json#exports has drifted from the component file system.
// Run `bun run exports:generate` to fix drift.
const checkResult = await $`bun run exports:check`.nothrow();
if (checkResult.exitCode !== 0) {
  process.stderr.write('Build aborted: exports are out of sync. Run `bun run exports:generate`.\n');
  process.exit(1);
}

await $`rm -rf dist`;

process.env['NODE_ENV'] = 'production';

const serverEntryPath = await createServerEntry();

const serverBuildResult = await Bun.build({
  entrypoints: [serverEntryPath],
  outdir: `${distributionDirectory}/server`,
  target: 'node',
  format: 'esm',
  naming: 'index.js',
  sourcemap: 'external',
  minify: false,
  plugins: [sveltePlugin({ generate: 'server' })],
});

if (!serverBuildResult.success) {
  const messages = ['Server build failed:', ...serverBuildResult.logs.map(String)].join('\n');
  process.stderr.write(`${messages}\n`);
  process.exit(1);
}

await emitDts({
  declarationDir: distributionDirectory,
  svelteShimsPath,
  libRoot: `${repositoryRoot}/src`,
  tsconfig: `${repositoryRoot}/tsconfig.build.json`,
});

const expectedComponentDeclarations = `${distributionDirectory}/components/button.svelte.d.ts`;
const expectedBarrelDeclarations = `${distributionDirectory}/index.d.ts`;

for (const declarationPath of [expectedComponentDeclarations, expectedBarrelDeclarations]) {
  if (!(await Bun.file(declarationPath).exists())) {
    process.stderr.write(`Missing declaration output: ${declarationPath}\n`);
    process.exit(1);
  }
}

process.stdout.write('Build complete.\n');
