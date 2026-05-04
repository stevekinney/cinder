/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../test/happy-dom.ts';

setupHappyDom();

const { render, waitFor } = await import('@testing-library/svelte');
const { default: CodeBlock } = await import('./code-block.svelte');

async function renderHighlightedCode() {
  return '<pre><code class="highlighted">const x = 1;</code></pre>';
}

describe('CodeBlock', () => {
  test('renders code in a <pre><code> pair', () => {
    const { container } = render(CodeBlock, { code: 'const x = 1;' });
    const pre = container.querySelector('pre');
    expect(pre).not.toBeNull();
    expect(pre?.querySelector('code')?.textContent).toBe('const x = 1;');
  });

  test('language prop renders an uppercase language label', () => {
    const { container } = render(CodeBlock, { code: 'const x', language: 'ts' });
    const label = container.querySelector('.cinder-code-block__language');
    expect(label?.textContent?.trim()).toBe('ts');
  });

  test('header is omitted when neither language nor copyable is set', () => {
    const { container } = render(CodeBlock, { code: 'plain' });
    expect(container.querySelector('.cinder-code-block__header')).toBeNull();
  });

  test('copyable=true renders a copy button in the header', () => {
    const { container } = render(CodeBlock, { code: 'x', copyable: true });
    expect(container.querySelector('.cinder-code-block__header')).not.toBeNull();
    expect(container.querySelector('.cinder-copy-button')).not.toBeNull();
  });

  test('no highlighter prop renders plain unhighlighted code', () => {
    const { container } = render(CodeBlock, { code: 'const x = 1;' });
    expect(container.querySelector('pre code')?.textContent).toBe('const x = 1;');
  });

  test('highlighter prop output is rendered verbatim via html', async () => {
    const { container } = render(CodeBlock, {
      code: 'const x = 1;',
      language: 'js',
      highlighter: renderHighlightedCode,
    });
    await waitFor(() => {
      expect(container.querySelector('.highlighted')).not.toBeNull();
    });
  });

  test('highlighter prop documents the trust boundary in source', async () => {
    // The component renders highlighter output via {@html} without sanitization.
    // The JSDoc comment on the highlighter prop is the contract that tells
    // consumers they own the safety boundary. If this comment goes missing,
    // a future contributor might forget the trust boundary and add a "sanitize
    // before render" path that would silently break Shiki's spans.
    const source = await Bun.file(new URL('./code-block.svelte', import.meta.url).pathname).text();
    expect(source).toContain('rendered with `{@html}`');
    expect(source).toContain("caller's responsibility");
  });
});
