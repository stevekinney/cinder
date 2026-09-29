import type { Root as MdastRoot } from 'mdast';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { remarkGithubCallouts } from './remark-github-callouts.js';

function createBaseProcessor() {
  return unified().use(remarkParse).use(remarkGfm).use(remarkGithubCallouts);
}

type MarkdownProcessor = ReturnType<typeof createBaseProcessor>;
let baseProcessor: MarkdownProcessor | null = null;

export function getBaseProcessor(): MarkdownProcessor {
  baseProcessor ??= createBaseProcessor();
  return baseProcessor;
}

/**
 * Lazy math-plugin loader and the cached math-aware processor.
 *
 * These exist so that markdown without `$` or `$$` never imports
 * `remark-math` or `rehype-katex` — both are >100 KB once their
 * dependencies are resolved. The loader is module-scoped so the chunk
 * is fetched at most once per page-lifetime; subsequent math renders
 * reuse the cached processor.
 *
 * For test injection, see `setMathPluginLoaderForTests` below.
 */
export type RehypeKatexPlugin = typeof import('rehype-katex').default;
type MathPluginLoader = () => Promise<{
  remarkMath: typeof import('remark-math').default;
  rehypeKatex: RehypeKatexPlugin;
}>;
/** Resolved return type of MathPluginLoader, for the cached-promise annotation. */
type MathPlugins = Awaited<ReturnType<MathPluginLoader>>;
let mathPluginLoader: MathPluginLoader = async () => {
  const [remarkMathModule, rehypeKatexModule] = await Promise.all([
    import('remark-math'),
    import('rehype-katex'),
  ]);
  return {
    remarkMath: remarkMathModule.default,
    rehypeKatex: rehypeKatexModule.default,
  };
};
let mathPluginsPromise: Promise<MathPlugins> | null = null;
let mathProcessor: MarkdownProcessor | null = null;

export async function ensureMathPipeline(): Promise<{
  processor: MarkdownProcessor;
  rehypeKatex: RehypeKatexPlugin;
}> {
  // Guard against caching a rejected promise. Without this, a transient
  // network error on the first dynamic import would permanently prevent
  // math rendering for the page lifetime, because a rejected Promise is
  // not null and ??= would never attempt a retry.
  if (!mathPluginsPromise) {
    mathPluginsPromise = mathPluginLoader().catch((error) => {
      mathPluginsPromise = null; // allow retry on next render
      throw error;
    });
  }
  const { remarkMath, rehypeKatex } = await mathPluginsPromise;
  if (!mathProcessor) {
    mathProcessor = unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkGithubCallouts)
      .use(remarkMath);
  }
  return { processor: mathProcessor, rehypeKatex };
}

/**
 * Test-only override of the math-plugin loader.
 *
 * Replaces `mathPluginLoader` AND clears the dependent singleton state
 * (`mathPluginsPromise`, `mathProcessor`). Without
 * the singleton reset, a stub installed after a real load would never
 * be called because the cached promise would already be resolved.
 *
 * Returns a cleanup function that restores the previous loader and
 * clears the singleton state again, so subsequent tests start fresh.
 *
 * Internal tests import this module directly; it is not a public package export.
 */
export function setMathPluginLoaderForTests(loader: MathPluginLoader): () => void {
  const previous = mathPluginLoader;
  mathPluginLoader = loader;
  mathPluginsPromise = null;
  mathProcessor = null;
  return () => {
    mathPluginLoader = previous;
    mathPluginsPromise = null;
    mathProcessor = null;
  };
}

/**
 * Parse markdown AND run the processor's mdast transformers.
 *
 * `processor.parse()` alone runs only the parser — unified never invokes
 * transformers during `parse`, they belong to the `run` phase. Both entry
 * points used to call bare `parse()`, which was harmless while every remark
 * plugin in these pipelines (`remark-gfm`, `remark-math`) contributed nothing
 * but micromark extensions. `remarkGithubCallouts` is a real transformer, so
 * the `run` phase has to happen or the plugin is registered-but-never-called —
 * a failure mode that looks exactly like the plugin not matching.
 *
 * `runSync` is safe here: these processors hold only synchronous transformers,
 * and none of them is a compiler, so no stringification is triggered.
 */
export function parseMarkdown(processor: MarkdownProcessor, markdown: string): MdastRoot {
  return processor.runSync(processor.parse(markdown));
}
