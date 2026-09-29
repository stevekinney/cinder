import { mkdtemp, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const compileProgram = `
import { sveltePlugin } from '@lostgradient/testing';
import { dirname, join } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
const { sourcePath, conditions = ['svelte'] } = await Bun.stdin.json();
if (typeof document !== 'undefined' || typeof window !== 'undefined') {
  throw new Error('Server rendering must start without DOM globals');
}
const sveltePackageDirectories = new Map();
function requiresSvelteCompilation(resolved) {
  if (/\\.svelte(?:\\.[jt]s)?$/.test(resolved)) return true;
  let directory = dirname(resolved);
  if (sveltePackageDirectories.has(directory)) return sveltePackageDirectories.get(directory);
  const initialDirectory = directory;
  while (directory !== dirname(directory)) {
    const manifestPath = join(directory, 'package.json');
    if (existsSync(manifestPath)) {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
      const compile = manifest.name !== 'svelte' && Boolean(manifest.svelte || manifest.peerDependencies?.svelte);
      sveltePackageDirectories.set(initialDirectory, compile);
      return compile;
    }
    directory = dirname(directory);
  }
  return false;
}
const result = await Bun.build({
  entrypoints: [sourcePath],
  target: 'bun',
  conditions,
  plugins: [sveltePlugin({ generate: 'server' }), {
    name: 'preserve-source-dependency-ownership',
    setup(builder) {
      builder.onResolve({ filter: /^[^./]/ }, ({ path, importer, resolveDir }) => {
        if (path.startsWith('@lostgradient/')) return undefined;
        if (path === 'esm-env' || path.startsWith('esm-env/')) return undefined;
        if (/^(node|bun):/.test(path)) return { path, external: true };
        const resolved = Bun.resolveSync(path, importer ? dirname(importer) : resolveDir);
        return { path: resolved, external: !requiresSvelteCompilation(resolved) };
      });
    },
  }],
});
if (!result.success) throw new AggregateError(result.logs, 'Server component compilation failed');
const artifact = result.outputs.find((output) => output.kind === 'entry-point');
if (!artifact) throw new Error('Missing server component artifact');
process.stdout.write(JSON.stringify(await artifact.text()));
`;

const renderProgram = `
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { render } from 'svelte/server';
import { fork } from 'svelte';
const { code, props, directory, importOnly } = await Bun.stdin.json();
if (typeof document !== 'undefined' || typeof window !== 'undefined') {
  throw new Error('Server rendering must start without DOM globals');
}
let forkRejected = false;
try { fork(() => {}); } catch { forkRejected = true; }
if (!forkRejected) throw new Error('Expected the real Svelte server runtime');
const entry = join(directory, 'component.ts');
await Bun.write(entry, code);
const component = await import(pathToFileURL(entry).href);
const output = importOnly ? '' : render(component.default, { props }).body;
if (typeof document !== 'undefined' || typeof window !== 'undefined') {
  throw new Error('Server component import installed DOM globals');
}
process.stdout.write(JSON.stringify(output));
`;

const packageRoot = resolve(import.meta.dir, '../..');
// Test source is immutable during a run. Cache compilation, never component instances or renders.
const serverSources = new Map<string, Promise<string>>();

function serializeServerInput(payload: Record<string, unknown>): string {
  return JSON.stringify(payload, (_key, value: unknown) => {
    if (typeof value === 'function' || typeof value === 'symbol') {
      throw new TypeError(
        'Server props must contain data; define callbacks and snippets in a Svelte fixture.',
      );
    }
    return value;
  });
}

async function runServerProgram(
  program: string,
  payload: Record<string, unknown>,
): Promise<string> {
  const child = Bun.spawn([process.execPath, '--eval', program], {
    cwd: packageRoot,
    stdin: new TextEncoder().encode(serializeServerInput(payload)),
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [status, output, errors] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  if (status !== 0 || errors !== '')
    throw new Error(`Server execution failed (${status}): ${errors}`);
  const result: unknown = JSON.parse(output);
  if (typeof result !== 'string') throw new Error('Server process returned invalid output');
  return result;
}

type SvelteServerOptions = {
  conditions?: readonly string[];
};

function serverSourceKey(sourcePath: string, conditions: readonly string[]): string {
  return `${sourcePath}\u0000${JSON.stringify(conditions)}`;
}

async function compiledServerSource(
  sourcePath: string,
  conditions: readonly string[],
): Promise<string> {
  const key = serverSourceKey(sourcePath, conditions);
  let compilation = serverSources.get(key);
  if (!compilation) {
    compilation = runServerProgram(compileProgram, { sourcePath, conditions });
    serverSources.set(key, compilation);
  }
  try {
    return await compilation;
  } catch (error) {
    serverSources.delete(key);
    throw error;
  }
}

/**
 * Compile an immutable fixture once during test setup, before timed assertions.
 *
 * Pass the same `conditions` the timed render will use: compilation is cached per condition set,
 * so preparing under the default conditions does nothing for a render under `browser`.
 */
export async function prepareSvelteServerSource(
  sourcePath: string,
  options: SvelteServerOptions = {},
): Promise<void> {
  await compiledServerSource(sourcePath, [...(options.conditions ?? ['svelte'])]);
}

async function runServerComponent(
  sourcePath: string,
  props: Record<string, unknown>,
  importOnly: boolean,
  options: SvelteServerOptions,
): Promise<string> {
  const conditions = [...(options.conditions ?? ['svelte'])];
  const code = await compiledServerSource(sourcePath, conditions);
  const directory = await mkdtemp(join(packageRoot, 'node_modules/.svelte-ssr-'));
  try {
    return await runServerProgram(renderProgram, { code, props, directory, importOnly });
  } finally {
    await rm(directory, { recursive: true });
  }
}

/** Compile and render source with the real server runtime in an isolated Bun process. */
export function renderSvelteOnServer(
  sourcePath: string,
  props: Record<string, unknown> = {},
  options: SvelteServerOptions = {},
): Promise<string> {
  return runServerComponent(sourcePath, props, false, options);
}

/** Evaluate the complete server component graph without installing DOM globals. */
export async function importSvelteOnServer(sourcePath: string): Promise<void> {
  await runServerComponent(sourcePath, {}, true, {});
}
