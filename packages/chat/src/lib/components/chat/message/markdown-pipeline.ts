type MarkdownPipeline = {
  renderMarkdownWithMath: (content: string) => Promise<{ html: string }>;
};

let pipelinePromise: Promise<MarkdownPipeline | undefined> | undefined;

/** Start loading the markdown renderer before the first streamed token arrives. */
export function preloadMarkdownPipeline(): Promise<MarkdownPipeline | undefined> | undefined {
  if (typeof window === 'undefined') return undefined;
  return (pipelinePromise ??= import('@lostgradient/markdown/rendering' as string).catch(() => {
    // Allow a later stream to retry after a transient chunk-load failure.
    pipelinePromise = undefined;
    return undefined;
  }));
}
