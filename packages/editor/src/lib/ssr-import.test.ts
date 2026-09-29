import { afterAll, describe, expect, it } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const packageRoot = resolve(import.meta.dir, '../..');

// Compile the complete public source graph in a separate server process before
// the timed assertion. The import assertion below still runs in a fresh process
// so it cannot inherit browser conditions, DOM globals, or cached modules.
const serverCompileProbe = `
import { sveltePlugin } from '@lostgradient/testing';
import { dirname } from 'node:path';
if (typeof document !== 'undefined' || typeof window !== 'undefined') {
  throw new Error('The SSR compilation process unexpectedly has DOM globals.');
}
const result = await Bun.build({
  entrypoints: ['./src/index.ts'],
  target: 'bun',
  plugins: [sveltePlugin({ generate: 'server' }), {
    name: 'preserve-source-dependency-ownership',
    setup(builder) {
      builder.onResolve({ filter: /^[^./]/ }, (arguments_) => {
        if (arguments_.path.startsWith('@lostgradient/')) return undefined;
        if (/^(node|bun):/.test(arguments_.path)) return { path: arguments_.path, external: true };
        const directory = arguments_.importer ? dirname(arguments_.importer) : arguments_.resolveDir;
        return { path: Bun.resolveSync(arguments_.path, directory), external: true };
      });
    },
  }],
});
if (!result.success) throw new AggregateError(result.logs, 'Public editor SSR compilation failed');
const output = result.outputs.find((artifact) => artifact.kind === 'entry-point');
if (!output) throw new Error('SSR compilation emitted no entry point');
process.stdout.write(JSON.stringify(await output.text()));
`;

// A fresh server process must load the prepared public surface without
// inheriting browser export conditions, DOM globals, or cached modules.
const serverImportProbe = `
import { pathToFileURL } from 'node:url';
const { entryPath } = await Bun.stdin.json();
if (typeof document !== 'undefined' || typeof window !== 'undefined') {
  throw new Error('The SSR import process unexpectedly has DOM globals.');
}
const editor = await import(pathToFileURL(entryPath).href);
const functions = ['generateBlockId', 'createAnchorPlugin', 'extractMentions',
  'createSession', 'generateMarkdownSummary', 'createEditor', 'destroyEditor',
  'MarkdownEditor', 'ReviewEditor', 'DiffViewer'];
for (const name of functions) {
  if (typeof editor[name] !== 'function') throw new Error('Missing public API: ' + name);
}
if (typeof document !== 'undefined' || typeof window !== 'undefined') {
  throw new Error('The public editor import installed browser globals on the server.');
}
process.stdout.write(JSON.stringify(functions));
`;

async function runServerProbe(
  source: string,
  input: Record<string, string> | undefined,
): Promise<{ status: number; output: string; errors: string }> {
  const child = Bun.spawn([process.execPath, '--eval', source], {
    cwd: packageRoot,
    stdin: input ? new TextEncoder().encode(JSON.stringify(input)) : undefined,
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [status, output, errors] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  return { status, output, errors };
}

const preparedDirectory = await mkdtemp(join(packageRoot, 'node_modules/.corvidae-ssr-'));
const preparedEntryPath = join(preparedDirectory, 'editor.ts');
try {
  const compilation = await runServerProbe(serverCompileProbe, undefined);
  if (compilation.status !== 0 || compilation.errors !== '') {
    throw new Error(
      `Server compilation failed (${compilation.status}): ${compilation.errors || compilation.output}`,
    );
  }
  await Bun.write(preparedEntryPath, JSON.parse(compilation.output));
} catch (error) {
  await rm(preparedDirectory, { recursive: true });
  throw error;
}
afterAll(async () => {
  await rm(preparedDirectory, { recursive: true });
});

describe('@lostgradient/editor public source entry point', () => {
  it('imports on a fresh server with the real server export conditions and no DOM', async () => {
    const result = await runServerProbe(serverImportProbe, { entryPath: preparedEntryPath });
    expect(result.status, result.errors).toBe(0);
    expect(result.errors).toBe('');
    expect(JSON.parse(result.output)).toContain('ReviewEditor');
  });
});
