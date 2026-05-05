/**
 * Tests for async markdown rendering fallback path.
 *
 * DEP-687: Move rendering pipeline to a Web Worker.
 *
 * Worker is not available in the test environment, so these tests
 * verify the synchronous fallback path. The baseline for comparison is
 * `renderMarkdownWithMath` (not `renderMarkdown`) because the fallback
 * calls `renderMarkdownWithMath` — for math-containing input the two
 * functions produce different output and only `renderMarkdownWithMath`
 * matches what users will see in production.
 */

import { beforeEach, describe, expect, it } from 'bun:test';
import {
  initializeWorkerHighlighter,
  renderMarkdownAsync,
  terminateMarkdownWorker,
} from './render-async.js';
import { clearRenderCache, renderMarkdownWithMath } from './render.js';

describe('renderMarkdownAsync', () => {
  beforeEach(() => {
    terminateMarkdownWorker();
    clearRenderCache();
  });

  it('falls back to synchronous rendering when Worker is unavailable', async () => {
    const result = await renderMarkdownAsync('# Hello World');
    const expected = await renderMarkdownWithMath('# Hello World');

    expect(result.html).toBe(expected.html);
    expect(result.rawMarkdown).toBe(expected.rawMarkdown);
    expect(result.codeBlocks).toEqual(expected.codeBlocks);
    expect(result.hadUnsafeContent).toBe(expected.hadUnsafeContent);
  });

  it('produces identical output for GFM content', async () => {
    const markdown = '| A | B |\n|---|---|\n| 1 | 2 |\n\n- [x] done\n- [ ] todo';
    const result = await renderMarkdownAsync(markdown);
    const expected = await renderMarkdownWithMath(markdown);

    expect(result.html).toBe(expected.html);
  });

  it('produces identical output for code blocks', async () => {
    const markdown = '```typescript\nconst x: number = 1;\n```';
    const result = await renderMarkdownAsync(markdown);
    const expected = await renderMarkdownWithMath(markdown);

    expect(result.html).toBe(expected.html);
    expect(result.codeBlocks).toEqual(expected.codeBlocks);
  });

  it('handles empty input', async () => {
    const result = await renderMarkdownAsync('');
    const expected = await renderMarkdownWithMath('');

    expect(result.html).toBe(expected.html);
    expect(result.rawMarkdown).toBe('');
  });

  it('forwards render options to fallback', async () => {
    const markdown = '[link](https://example.com)';
    const result = await renderMarkdownAsync(markdown, { stripLinks: true });
    const expected = await renderMarkdownWithMath(markdown, { stripLinks: true });

    expect(result.html).toBe(expected.html);
  });

  it('detects unsafe content in fallback path', async () => {
    const markdown = '<script>alert("xss")</script>\n\nSafe text';
    const result = await renderMarkdownAsync(markdown);
    const expected = await renderMarkdownWithMath(markdown);

    expect(result.hadUnsafeContent).toBe(expected.hadUnsafeContent);
    expect(result.hadUnsafeContent).toBe(true);
  });
});

describe('initializeWorkerHighlighter', () => {
  beforeEach(() => {
    terminateMarkdownWorker();
  });

  it('returns false when Worker is unavailable', async () => {
    await expect(initializeWorkerHighlighter()).resolves.toBe(false);
  });
});

describe('terminateMarkdownWorker', () => {
  it('can be called multiple times safely', () => {
    terminateMarkdownWorker();
    terminateMarkdownWorker();
    terminateMarkdownWorker();
  });

  it('resets state so next call creates a fresh attempt', async () => {
    // First call — Worker unavailable, marks as failed
    await renderMarkdownAsync('# test');

    // Reset
    terminateMarkdownWorker();

    // Second call — should attempt Worker creation again (and fall back)
    const result = await renderMarkdownAsync('# test');
    expect(result.html).toContain('<h1>');
  });
});
