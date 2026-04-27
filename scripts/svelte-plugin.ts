import type { BunPlugin } from 'bun';
import { compile, compileModule } from 'svelte/compiler';

type GenerationTarget = 'client' | 'server';

/**
 * Bun plugin that compiles Svelte 5 components with `svelte/compiler`.
 *
 * - `generate`: chooses client-side or server-side rendering output.
 * - Rejects any component that carries a `<style>` block. Styles belong in
 *   `src/styles/` so the design system has a single CSS cascade surface.
 * - Compiles `.svelte.js` / `.svelte.ts` rune modules via `compileModule` so libraries
 *   like `@testing-library/svelte-core` that use runes in plain modules work at runtime.
 */
export function sveltePlugin(
  options: { generate: GenerationTarget } = { generate: 'client' },
): BunPlugin {
  return {
    name: `svelte-${options.generate}`,
    setup(builder) {
      builder.onLoad({ filter: /\.svelte$/ }, async ({ path }) => {
        const source = await Bun.file(path).text();
        const compileResult = compile(source, {
          filename: path,
          generate: options.generate,
          css: 'external',
          // Read the same environment source that `scripts/build.ts` writes before `Bun.build()`
          // runs so production builds and test/dev loads stay in sync.
          dev: process.env['NODE_ENV'] !== 'production',
        });
        if (compileResult.css?.code?.trim()) {
          throw new Error(
            `[svelte-plugin] <style> block in ${path} — not allowed. Put styles in src/styles/.`,
          );
        }
        return { contents: compileResult.js.code, loader: 'js' };
      });

      builder.onLoad({ filter: /\.svelte\.(js|ts)$/ }, async ({ path }) => {
        const source = await Bun.file(path).text();
        const compileResult = compileModule(source, {
          filename: path,
          generate: options.generate,
          // Read the same environment source that `scripts/build.ts` writes before `Bun.build()`
          // runs so production builds and test/dev loads stay in sync.
          dev: process.env['NODE_ENV'] !== 'production',
        });
        return { contents: compileResult.js.code, loader: 'js' };
      });
    },
  };
}
