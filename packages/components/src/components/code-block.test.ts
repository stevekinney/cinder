/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../test/happy-dom.ts';

setupHappyDom();

const { render, waitFor } = await import('@testing-library/svelte');
const { default: CodeBlock } = await import('./code-block.svelte');

async function renderHighlightedCode(code: string, _lang: string): Promise<string> {
  return `<pre class="shiki"><code><span class="highlighted-token">${code}</span></code></pre>`;
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

  test('copyable=true renders the copy button in iconOnly mode (no text label)', () => {
    // The component hardcodes iconOnly={true} on its embedded CopyButton because
    // headers are space-constrained. This test guards against an accidental
    // change to that contract.
    const { container } = render(CodeBlock, { code: 'x', copyable: true });
    const button = container.querySelector('.cinder-copy-button');
    expect(button).not.toBeNull();
    expect(button?.querySelector('svg')).not.toBeNull();
    expect(button?.textContent?.trim()).toBe('');
  });

  test('no highlighter prop renders plain unhighlighted code', () => {
    const { container } = render(CodeBlock, { code: 'const x = 1;' });
    expect(container.querySelector('pre code')?.textContent).toBe('const x = 1;');
  });

  test('plain code path escapes HTML special characters', () => {
    // Svelte text interpolation `{code}` escapes by default. This regression test
    // catches a future refactor that accidentally moves the no-highlighter path
    // into an `{@html}` render and exposes XSS.
    const { container } = render(CodeBlock, { code: '<script>alert(1)</script>' });
    const code = container.querySelector('.cinder-code-block__code');
    expect(code?.textContent).toBe('<script>alert(1)</script>');
    // No actual <script> element should be present in the rendered DOM.
    expect(container.querySelector('script')).toBeNull();
  });

  test('highlighter output replaces the plain pre/code and renders verbatim', async () => {
    const { container } = render(CodeBlock, {
      code: 'const x = 1;',
      language: 'js',
      highlighter: renderHighlightedCode,
    });
    await waitFor(() => {
      const token = container.querySelector('.highlighted-token');
      expect(token).not.toBeNull();
      expect(token?.textContent).toBe('const x = 1;');
      // The Shiki-style <pre.shiki> replaces the default cinder-code-block__pre.
      expect(container.querySelector('.cinder-code-block__pre')).toBeNull();
    });
  });

  test('synchronous highlighter exception falls back to plain code', async () => {
    const { container } = render(CodeBlock, {
      code: 'const x = 1;',
      language: 'js',
      highlighter: () => {
        throw new Error('boom');
      },
    });
    // The async wrapper inside the effect catches sync throws and flips back to plain.
    await waitFor(() => {
      expect(container.querySelector('.cinder-code-block__code')?.textContent).toBe('const x = 1;');
    });
  });

  test('async highlighter rejection falls back to plain code', async () => {
    // Companion to the sync-throw test above. Verifies the async branch of the
    // catch handler — a highlighter that returns a rejected Promise must also
    // produce the graceful plain-code fallback.
    const { container } = render(CodeBlock, {
      code: 'const y = 2;',
      language: 'js',
      highlighter: async () => {
        throw new Error('async boom');
      },
    });
    await waitFor(() => {
      expect(container.querySelector('.cinder-code-block__code')?.textContent).toBe('const y = 2;');
    });
  });
});
