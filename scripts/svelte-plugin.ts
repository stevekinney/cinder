import type { BunPlugin } from 'bun';
import { compile } from 'svelte/compiler';

type GenerationTarget = 'client' | 'server';

/**
 * Bun plugin that compiles Svelte 5 components with `svelte/compiler`.
 *
 * - `generate`: chooses client-side or server-side rendering output.
 * - Rejects any component that carries a `<style>` block. Styles belong in
 *   `src/styles/` so the design system has a single CSS cascade surface.
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
          dev: Bun.env.NODE_ENV !== 'production',
        });
        if (compileResult.css?.code?.trim()) {
          throw new Error(
            `[svelte-plugin] <style> block in ${path} — not allowed. Put styles in src/styles/.`,
          );
        }
        return { contents: compileResult.js.code, loader: 'js' };
      });
    },
  };
}

export default sveltePlugin;
