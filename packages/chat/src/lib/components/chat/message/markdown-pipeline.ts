type MarkdownPipeline = {
  renderMarkdownWithMath: (content: string) => Promise<{ html: string }>;
};

type MarkdownPipelineLoader = () => Promise<MarkdownPipeline>;

let pipelinePromise: Promise<MarkdownPipeline | undefined> | undefined;

/** Start loading the markdown renderer before the first streamed token arrives. */
export function preloadMarkdownPipeline(
  loadPipeline?: MarkdownPipelineLoader,
): Promise<MarkdownPipeline | undefined> | undefined {
  // Only preload in a real browser realm. This also keeps SSR and DOM-test
  // harnesses from evaluating the browser-only rendering graph.
  if (typeof window === 'undefined' || window !== globalThis) return undefined;

  return (pipelinePromise ??= (loadPipeline?.() ?? import('@lostgradient/markdown/rendering'))
    .then(({ renderMarkdownWithMath }) => ({ renderMarkdownWithMath }))
    .catch(() => {
      // Allow a later stream to retry after a transient chunk-load failure.
      pipelinePromise = undefined;
      return undefined;
    }));
}
