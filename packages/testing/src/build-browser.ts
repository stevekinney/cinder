import { join } from 'node:path';
import { sveltePlugin } from './svelte-plugin.ts';

// The unwasm condition exposes binary modules. Bun emits their bytes as assets;
// the module's default export supplies the instantiator expected by consumers.
const wasmPlugin: Bun.BunPlugin = {
  name: 'browser-wasm',
  setup(builder) {
    builder.onLoad({ filter: /\.wasm$/, namespace: 'file' }, ({ path }) => ({
      loader: 'js',
      contents: `import url from ${JSON.stringify(`wasm-asset:${path}`)};
export default (imports) => WebAssembly.instantiateStreaming(fetch(url), imports);`,
    }));
    builder.onResolve({ filter: /^wasm-asset:/ }, ({ path }) => ({
      // Keep the binary and its JavaScript module distinct in Bun's module graph.
      path: `${path.slice('wasm-asset:'.length)}.binary.wasm`,
      namespace: 'wasm-asset',
    }));
    builder.onLoad({ filter: /.*/, namespace: 'wasm-asset' }, async ({ path }) => ({
      contents: await Bun.file(path.slice(0, -'.binary.wasm'.length)).bytes(),
      loader: 'file',
    }));
  },
};

/** Compile the real Svelte source used by the browser integration tests. */
export async function buildBrowser(options: {
  entrypoints: string[];
  outdir: string;
  development: boolean;
}): Promise<Bun.BuildOutput> {
  const result = await Bun.build({
    entrypoints: options.entrypoints,
    outdir: options.outdir,
    conditions: ['browser', 'svelte', 'unwasm'],
    define: {
      'process.env.NODE_ENV': JSON.stringify(options.development ? 'development' : 'production'),
    },
    format: 'esm',
    publicPath: '/',
    target: 'browser',
    plugins: [
      wasmPlugin,
      sveltePlugin({ generate: 'client', injectCss: true, development: options.development }),
    ],
    optimizeImports: ['@lostgradient/cinder'],
    sourcemap: 'none',
    splitting: true,
    metafile: true,
  });
  if (!result.success) throw new AggregateError(result.logs, 'Browser compilation failed');
  const warnings = result.logs.filter((message) => message.level === 'warning');
  if (warnings.length > 0)
    throw new AggregateError(warnings, 'Browser compilation emitted warnings');
  if (result.metafile === undefined)
    throw new Error('Browser compilation did not emit module provenance');
  await Bun.write(join(options.outdir, 'metafile.json'), JSON.stringify(result.metafile));
  return result;
}
