/// <reference lib="dom" />
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { createRawSnippet, mount, unmount } from 'svelte';

import { setupHappyDom } from '../../test/happy-dom.ts';
import type { Highlighter } from '../../utilities/highlighter.ts';

setupHappyDom();

const originalConsoleWarn = console.warn;

beforeEach(() => {
  console.warn = () => {};
});

afterEach(() => {
  console.warn = originalConsoleWarn;
});

const { render, waitFor } = await import('@testing-library/svelte');
const { default: CinderProvider } = await import('../cinder-provider/cinder-provider.svelte');
const { default: CodeBlock } = await import('./code-block.svelte');

type CodeBlockTestProps = {
  code: string;
  language?: string;
  copyable?: boolean;
  class?: string;
};

async function renderHighlightedCode(code: string, _lang: string): Promise<string> {
  return `<pre class="shiki"><code><span class="highlighted-token">${code}</span></code></pre>`;
}

/**
 * Render a CodeBlock inside a CinderProvider so the highlighter context is
 * established before CodeBlock calls `getHighlighterContext()`. Mirrors the
 * accordion-item test helper pattern: `createRawSnippet` returns a wrapper
 * `<div>`, then we mount the CodeBlock into it via Svelte's `mount`.
 *
 * Returns the @testing-library/svelte container (the provider root), which
 * includes the rendered CodeBlock in its subtree.
 */
function renderWithProvider(
  props: CodeBlockTestProps,
  options: { highlighter?: Highlighter } = {},
) {
  return render(CinderProvider, {
    props: {
      ...(options.highlighter !== undefined ? { highlighter: options.highlighter } : {}),
      children: createRawSnippet(() => ({
        render: () => `<div class="code-block-mount"></div>`,
        setup: (node: Element) => {
          const instance = mount(CodeBlock, {
            target: node,
            props,
          });
          return () => {
            unmount(instance);
          };
        },
      })),
    },
  });
}

describe('CodeBlock (no provider in scope)', () => {
  // The "no provider" path is a first-class state: CodeBlock renders the
  // unhighlighted fallback. `render()` calls without a wrapping provider
  // exercise that branch.

  test('renders code in a <pre><code> pair', () => {
    const { container } = render(CodeBlock, { code: 'const x = 1;' });
    const pre = container.querySelector('pre');
    expect(pre).not.toBeNull();
    expect(pre?.querySelector('code')?.textContent).toBe('const x = 1;');
  });

  test('language prop renders a language label in the header', () => {
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
    const { container } = render(CodeBlock, { code: 'x', copyable: true });
    const button = container.querySelector('.cinder-copy-button');
    expect(button).not.toBeNull();
    expect(button?.querySelector('svg')).not.toBeNull();
    expect(button?.textContent?.trim()).toBe('');
  });

  test('copy button focus ring is inset inside the overflow-hidden shell', async () => {
    const css = await Bun.file(new URL('./code-block.css', import.meta.url)).text();

    expect(css).toContain(
      '.cinder-code-block .cinder-code-block__header .cinder-copy-button:focus-visible',
    );
    expect(css).toContain(
      'box-shadow: inset 0 0 0 var(--cinder-ring-width) var(--cinder-ring-color);',
    );
  });

  test('copy button focus ring remains visible in forced-colors mode', async () => {
    const css = await Bun.file(new URL('./code-block.css', import.meta.url)).text();

    expect(css).toContain('@media (forced-colors: active)');
    expect(css).toContain('outline-color: CanvasText;');
    expect(css).toContain('box-shadow: none;');
  });

  test('renders the unhighlighted fallback even when language is set', () => {
    // No provider in scope → no highlighter → plain `<pre><code>{code}</code></pre>`
    // regardless of whether `language` is provided.
    const { container } = render(CodeBlock, { code: 'const x = 1;', language: 'js' });
    expect(container.querySelector('pre.cinder-code-block__pre')).not.toBeNull();
    expect(container.querySelector('.highlighted-token')).toBeNull();
  });

  test('plain code path escapes HTML special characters (XSS fallback)', () => {
    // Svelte text interpolation `{code}` escapes by default. This regression
    // test catches a future refactor that accidentally moves the
    // no-highlighter path into an `{@html}` render and exposes XSS.
    const { container } = render(CodeBlock, { code: '<script>alert(1)</script>' });
    const code = container.querySelector('.cinder-code-block__code');
    expect(code?.textContent).toBe('<script>alert(1)</script>');
    // No actual <script> element should be present in the rendered DOM.
    expect(container.querySelector('script')).toBeNull();
  });
});

describe('CodeBlock (CinderProvider in scope)', () => {
  test('highlighter output replaces the plain pre/code and renders verbatim', async () => {
    const { container } = renderWithProvider(
      { code: 'const x = 1;', language: 'js' },
      { highlighter: renderHighlightedCode },
    );
    await waitFor(() => {
      const token = container.querySelector('.highlighted-token');
      expect(token).not.toBeNull();
      expect(token?.textContent).toBe('const x = 1;');
      // The Shiki-style <pre.shiki> replaces the default cinder-code-block__pre.
      expect(container.querySelector('.cinder-code-block__pre')).toBeNull();
    });
  });

  test('synchronous highlighter exception falls back to plain code', async () => {
    const { container } = renderWithProvider(
      { code: 'const x = 1;', language: 'js' },
      {
        highlighter: () => {
          throw new Error('boom');
        },
      },
    );
    await waitFor(() => {
      expect(container.querySelector('.cinder-code-block__code')?.textContent).toBe('const x = 1;');
    });
  });

  test('async highlighter rejection falls back to plain code', async () => {
    const { container } = renderWithProvider(
      { code: 'const y = 2;', language: 'js' },
      {
        highlighter: async () => {
          throw new Error('async boom');
        },
      },
    );
    await waitFor(() => {
      expect(container.querySelector('.cinder-code-block__code')?.textContent).toBe('const y = 2;');
    });
  });

  test('empty highlighter output falls back to plain code', async () => {
    let resolveHighlightedCode: ((html: string) => void) | undefined;
    const { container } = renderWithProvider(
      { code: 'const visible = true;', language: 'js' },
      {
        highlighter: async () => {
          return await new Promise<string>((resolve) => {
            resolveHighlightedCode = resolve;
          });
        },
      },
    );

    await waitFor(() => {
      expect(resolveHighlightedCode).toBeDefined();
    });
    resolveHighlightedCode?.('');

    await waitFor(() => {
      expect(container.querySelector('.cinder-code-block__code')?.textContent).toBe(
        'const visible = true;',
      );
    });
  });

  test('provider with no highlighter prop renders the unhighlighted fallback', () => {
    // Mounting `<CinderProvider>` without a highlighter is equivalent to no
    // provider at all — every descendant CodeBlock falls back to plain text.
    const { container } = renderWithProvider({ code: 'const a = 1;', language: 'js' });
    expect(container.querySelector('.cinder-code-block__pre')).not.toBeNull();
    expect(container.querySelector('.highlighted-token')).toBeNull();
  });

  test('header is structurally present on the code-block when copyable', () => {
    const { container } = renderWithProvider({ code: 'x', copyable: true, language: 'sql' });
    const block = container.querySelector('.cinder-code-block');
    expect(block?.querySelector('.cinder-code-block__header')).not.toBeNull();
    expect(block?.querySelector('.cinder-code-block__pre')).not.toBeNull();
  });
});
