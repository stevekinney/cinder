export type ReadmeSegment =
  | { type: 'html'; content: string }
  | { type: 'code'; index: number; fallbackHtml: string };

/**
 * Split rendered README HTML into alternating prose and code segments.
 *
 * Each `<pre>...</pre>` block is replaced by a `{ type: 'code' }` entry whose
 * `index` corresponds to the matching entry in `readme.codeBlocks[]`. If no
 * matching `codeBlocks` entry exists at render time, `fallbackHtml` contains
 * the original `<pre>` HTML so the content is preserved rather than silently
 * dropped.
 *
 * The split is string-based and assumes each `<pre>` in the rendered HTML
 * corresponds one-to-one in order with the `codeBlocks[]` array — which holds
 * for markdown-rendered READMEs where Shiki generates all `<pre>` blocks.
 */
export function splitReadmeHtml(html: string): ReadmeSegment[] {
  const segments: ReadmeSegment[] = [];
  let codeIndex = 0;
  let remaining = html;

  while (remaining.length > 0) {
    const preStart = remaining.indexOf('<pre');
    if (preStart === -1) {
      segments.push({ type: 'html', content: remaining });
      break;
    }
    if (preStart > 0) {
      segments.push({ type: 'html', content: remaining.slice(0, preStart) });
    }
    const preEnd = remaining.indexOf('</pre>', preStart);
    if (preEnd === -1) {
      segments.push({ type: 'html', content: remaining.slice(preStart) });
      break;
    }
    const closeTag = '</pre>';
    const fallbackHtml = remaining.slice(preStart, preEnd + closeTag.length);
    segments.push({ type: 'code', index: codeIndex++, fallbackHtml });
    remaining = remaining.slice(preEnd + closeTag.length);
  }

  return segments;
}
