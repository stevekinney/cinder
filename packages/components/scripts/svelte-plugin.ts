import type { BunPlugin } from 'bun';
import { compile, compileModule } from 'svelte/compiler';

type GenerationTarget = 'client' | 'server';

const DOMAIN_SUITE_STYLE_COMPONENTS = new Set([
  'chat',
  'diff-viewer',
  'markdown-editor',
  'review-editor',
]);

function allowsStyleBlock(path: string): boolean {
  const normalizedPath = path.replaceAll('\\', '/');

  // Playground chrome is not part of the design-system cascade — the no-style
  // rule exists to keep the shipped component library on a single CSS surface.
  // Files under packages/playground/ are dev-only scaffolding and may co-locate
  // their styles with their markup.
  if (normalizedPath.includes('/packages/playground/')) return true;

  const componentPathMatch = normalizedPath.match(/\/src\/components\/([^/]+)(?:\/|\.svelte$)/);
  const componentName = componentPathMatch?.[1];
  return componentName !== undefined && DOMAIN_SUITE_STYLE_COMPONENTS.has(componentName);
}

/**
 * Bun plugin that compiles Svelte 5 components with `svelte/compiler`.
 *
 * - `generate`: chooses client-side or server-side rendering output.
 * - Rejects any component that carries a `<style>` block, except for files
 *   under `packages/playground/` and the domain-suite components allowlisted
 *   above. Styles belong in `src/styles/` so the design system has a single
 *   CSS cascade surface; the playground is dev-only chrome and not part of it.
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
        // Playground files inject their styles at runtime so dev-only chrome
        // renders without depending on the design-system CSS surface. Library
        // components keep `external` so their CSS flows through `src/styles/`.
        const isPlaygroundFile = path.replaceAll('\\', '/').includes('/packages/playground/');
        const compileResult = compile(source, {
          filename: path,
          generate: options.generate,
          css: isPlaygroundFile ? 'injected' : 'external',
          // Read the same environment source that `scripts/build.ts` writes before `Bun.build()`
          // runs so production builds and test/dev loads stay in sync.
          dev: process.env['NODE_ENV'] !== 'production',
        });
        if (!isPlaygroundFile && compileResult.css?.code?.trim() && !allowsStyleBlock(path)) {
          throw new Error(
            `[svelte-plugin] <style> block in ${path} — not allowed. Put styles in src/styles/.`,
          );
        }
        return { contents: compileResult.js.code, loader: 'js' };
      });

      builder.onLoad({ filter: /\.svelte\.(js|ts)$/ }, async ({ path }) => {
        const source = await Bun.file(path).text();
        const moduleSource = path.endsWith('.ts')
          ? new Bun.Transpiler({ loader: 'ts' }).transformSync(source)
          : source;
        const compileResult = compileModule(moduleSource, {
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
