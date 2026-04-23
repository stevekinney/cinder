import { $ } from 'bun';
import { emitDts } from 'svelte2tsx';

import { sveltePlugin } from './svelte-plugin.ts';

const ROOT = process.cwd();
const DIST = `${ROOT}/dist`;

await $`rm -rf dist`;

process.env['NODE_ENV'] = 'production';

const serverBuild = await Bun.build({
  entrypoints: [`${ROOT}/src/index.ts`],
  outdir: `${DIST}/server`,
  target: 'node',
  format: 'esm',
  naming: '[dir]/[name].js',
  sourcemap: 'external',
  minify: false,
  plugins: [sveltePlugin({ generate: 'server' })],
});

if (!serverBuild.success) {
  const messages = ['Server build failed:', ...serverBuild.logs.map(String)].join('\n');
  process.stderr.write(`${messages}\n`);
  process.exit(1);
}

await emitDts({
  declarationDir: DIST,
  svelteShimsPath: require.resolve('svelte2tsx/svelte-shims-v4.d.ts'),
  libRoot: `${ROOT}/src`,
  tsconfig: `${ROOT}/tsconfig.build.json`,
});

const expectedComponentDts = `${DIST}/components/button.svelte.d.ts`;
const expectedBarrelDts = `${DIST}/index.d.ts`;

for (const path of [expectedComponentDts, expectedBarrelDts]) {
  if (!(await Bun.file(path).exists())) {
    process.stderr.write(`Missing declaration output: ${path}\n`);
    process.exit(1);
  }
}

process.stdout.write('Build complete.\n');
