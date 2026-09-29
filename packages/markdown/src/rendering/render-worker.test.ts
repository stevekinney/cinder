import { expect, it } from 'bun:test';
import { wrap } from 'comlink';
import type { MarkdownWorkerApi } from './render-worker.ts';

it('renders math and sanitizes HTML in a real source worker without a DOM', async () => {
  const worker = new Worker(new URL('./render-worker.ts', import.meta.url), { type: 'module' });
  try {
    const renderer = wrap<MarkdownWorkerApi>(worker);
    const result = await renderer.renderMarkdown('$x^2$\n\n<script>alert(1)</script>');
    expect(result.html).toContain('katex');
    expect(result.html).not.toContain('<script>');
    expect(result.hadUnsafeContent).toBe(true);
  } finally {
    worker.terminate();
  }
});
