type MarkdownPipeline = {
  renderMarkdownWithMath: (content: string) => Promise<{ html: string }>;
};

let pipelinePromise: Promise<MarkdownPipeline> | undefined;

/** Start loading the markdown renderer before the first streamed token arrives. */
export function preloadMarkdownPipeline(): Promise<MarkdownPipeline> | undefined {
  if (typeof window === 'undefined') return undefined;
  return (pipelinePromise ??= import('@lostgradient/markdown/rendering' as string));
}
