import { describe, expect, test } from 'bun:test';

import { splitReadmeHtml } from './split-readme-html.ts';

describe('splitReadmeHtml', () => {
  test('returns single html segment when no <pre> blocks present', () => {
    const html = '<h1>Title</h1><p>Some prose.</p>';
    expect(splitReadmeHtml(html)).toEqual([{ type: 'html', content: html }]);
  });

  test('returns empty array for empty string', () => {
    expect(splitReadmeHtml('')).toEqual([]);
  });

  test('splits a single <pre> block with surrounding prose', () => {
    const html = '<p>Before</p><pre class="shiki"><code>foo</code></pre><p>After</p>';
    expect(splitReadmeHtml(html)).toEqual([
      { type: 'html', content: '<p>Before</p>' },
      {
        type: 'code',
        index: 0,
        fallbackHtml: '<pre class="shiki"><code>foo</code></pre>',
      },
      { type: 'html', content: '<p>After</p>' },
    ]);
  });

  test('splits multiple <pre> blocks and increments index', () => {
    const html = '<pre><code>a</code></pre><p>middle</p><pre><code>b</code></pre>';
    expect(splitReadmeHtml(html)).toEqual([
      { type: 'code', index: 0, fallbackHtml: '<pre><code>a</code></pre>' },
      { type: 'html', content: '<p>middle</p>' },
      { type: 'code', index: 1, fallbackHtml: '<pre><code>b</code></pre>' },
    ]);
  });

  test('handles adjacent <pre> blocks with no intervening HTML', () => {
    const html = '<pre><code>a</code></pre><pre><code>b</code></pre>';
    expect(splitReadmeHtml(html)).toEqual([
      { type: 'code', index: 0, fallbackHtml: '<pre><code>a</code></pre>' },
      { type: 'code', index: 1, fallbackHtml: '<pre><code>b</code></pre>' },
    ]);
  });

  test('treats unclosed <pre> (no </pre>) as trailing html segment', () => {
    const html = '<p>Before</p><pre><code>unclosed';
    expect(splitReadmeHtml(html)).toEqual([
      { type: 'html', content: '<p>Before</p>' },
      { type: 'html', content: '<pre><code>unclosed' },
    ]);
  });

  test('handles leading <pre> with no preceding prose', () => {
    const html = '<pre><code>first</code></pre><p>after</p>';
    expect(splitReadmeHtml(html)).toEqual([
      { type: 'code', index: 0, fallbackHtml: '<pre><code>first</code></pre>' },
      { type: 'html', content: '<p>after</p>' },
    ]);
  });

  test('handles trailing <pre> with no following prose', () => {
    const html = '<p>before</p><pre><code>last</code></pre>';
    expect(splitReadmeHtml(html)).toEqual([
      { type: 'html', content: '<p>before</p>' },
      { type: 'code', index: 0, fallbackHtml: '<pre><code>last</code></pre>' },
    ]);
  });

  test('fallbackHtml captures the exact <pre>...</pre> slice', () => {
    const preBlock =
      '<pre class="shiki" style="background:#fff"><code><span>hello</span></code></pre>';
    const html = `<p>intro</p>${preBlock}<p>outro</p>`;
    const segments = splitReadmeHtml(html);
    const codeSegment = segments.find((s) => s.type === 'code');
    expect(codeSegment).toBeDefined();
    if (codeSegment?.type === 'code') {
      expect(codeSegment.fallbackHtml).toBe(preBlock);
    }
  });
});
