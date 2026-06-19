/// <reference lib="dom" />
import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';
import type { Highlighter } from '../../utilities/highlighter.ts';

setupHappyDom();

// The default-highlighter seam is the single module CodeBlock imports to reach
// Shiki. Mocking THIS exact specifier (never the public `@lostgradient/cinder/highlighters/shiki`
// subpath, which CodeBlock does not import directly) is what makes the
// "default loader is NOT invoked when an explicit highlighter is provided"
// assertion real instead of false-confidence.
//
// `defaultHighlighterImpl` is swapped per-test; `loadDefaultHighlighter` is a
// spy so tests can assert whether the default path fired at all.
let defaultHighlighterImpl: Highlighter = (code) =>
  `<pre class="shiki shiki-default"><code>${code}</code></pre>`;

const loadDefaultHighlighter = mock(async (): Promise<Highlighter> => defaultHighlighterImpl);

mock.module('./code-block-default-highlighter.ts', () => ({
  loadDefaultHighlighter,
}));

const { cleanup, render, waitFor } = await import('@testing-library/svelte');
const { default: CodeBlock } = await import('./code-block.svelte');

// CodeBlock emits a dev warning when a highlighter throws / fails to load (it
// then falls back to escaped plain code). Several tests exercise that path on
// purpose, so we spy (rather than blanket-silence) and assert in afterEach that
// every warning is that known fallback message — any UNEXPECTED warning fails.
const KNOWN_CODE_BLOCK_WARNING = '[cinder/CodeBlock] highlight failed';
let warnSpy: ReturnType<typeof spyOn<typeof console, 'warn'>>;

beforeEach(() => {
  loadDefaultHighlighter.mockClear();
  defaultHighlighterImpl = (code) => `<pre class="shiki shiki-default"><code>${code}</code></pre>`;
  warnSpy = spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  // Unmount rendered components BEFORE the warning assertion: component teardown
  // may emit console.warn, so cleanup must run while warnSpy is still installed.
  // @testing-library/svelte v5's auto-cleanup does not register under bun:test, so
  // without this the mounted code blocks leak into the shared happy-dom
  // document.body and later sibling files (e.g. copy-button) see duplicate elements.
  cleanup();
  const unexpected = warnSpy.mock.calls
    .map((args) => args.map(String).join(' '))
    .filter((message) => !message.includes(KNOWN_CODE_BLOCK_WARNING));
  // Restore in `finally` so an unexpected-warning failure can't leave
  // `console.warn` patched for every subsequent test in the suite.
  try {
    expect(unexpected).toEqual([]);
  } finally {
    warnSpy.mockRestore();
  }
});

/** A custom highlighter that tags its output so we can assert it ran. */
function customHighlighter(code: string, _lang: string): string {
  return `<pre class="shiki"><code><span class="custom-token">${code}</span></code></pre>`;
}

describe('CodeBlock — static structure', () => {
  test('renders code in a <pre><code> pair (no language → no highlight)', () => {
    const { container } = render(CodeBlock, { code: 'const x = 1;' });
    const pre = container.querySelector('pre');
    expect(pre).not.toBeNull();
    expect(pre?.querySelector('code')?.textContent).toBe('const x = 1;');
    // With no language, the default highlighter must never load.
    expect(loadDefaultHighlighter).not.toHaveBeenCalled();
  });

  test('stable viewport has tabindex="0" for keyboard scroll access', () => {
    const { container } = render(CodeBlock, { code: 'const x = 1;' });
    const viewport = container.querySelector('.cinder-code-block__viewport');
    const pre = container.querySelector('pre.cinder-code-block__pre');
    expect(viewport).not.toBeNull();
    expect(viewport?.getAttribute('tabindex')).toBe('0');
    expect(pre).not.toBeNull();
    expect(pre?.hasAttribute('tabindex')).toBe(false);
  });

  test('language prop renders a language label in the header', () => {
    const { container } = render(CodeBlock, { code: 'const x', language: 'ts', highlight: false });
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

  test('CSS contains dark-theme rule that overrides shiki span color with --shiki-dark', async () => {
    const css = await Bun.file(new URL('./code-block.css', import.meta.url)).text();
    // The rule must cover the [data-cinder-theme='dark'] selector (playground uses this).
    expect(css).toContain("data-cinder-theme='dark'");
    // The rule must switch the inline `color:` to the --shiki-dark custom property.
    expect(css).toContain('color: var(--shiki-dark, inherit)');
  });

  test('CSS contains prefers-color-scheme: dark fallback for system dark mode', async () => {
    const css = await Bun.file(new URL('./code-block.css', import.meta.url)).text();
    expect(css).toContain('@media (prefers-color-scheme: dark)');
  });

  test('code surface background uses one component-owned light-dark declaration', async () => {
    const css = await Bun.file(new URL('./code-block.css', import.meta.url)).text();
    const lightDarkCount = css.match(/\blight-dark\(/g)?.length ?? 0;

    expect(css).toContain('--_cinder-code-block-code-surface: light-dark(');
    expect(css).toContain('background: var(--_cinder-code-block-code-surface);');
    expect(css).toContain('background: var(--_cinder-code-block-code-surface) !important;');
    expect(lightDarkCount).toBe(1);
  });

  test('stable viewport carries inset focus ring (regression #398)', async () => {
    // .cinder-code-block has overflow:hidden, so the standard outset focus ring is
    // clipped. The fix adds an INSET box-shadow ring to the stable focusable
    // viewport. This test locks that pattern so it cannot silently regress.
    const css = await Bun.file(new URL('./code-block.css', import.meta.url)).text();
    expect(css).toContain('.cinder-code-block__viewport:focus-visible');
    // The rule must use an inset box-shadow (not an outset ring that would be clipped).
    expect(css).toMatch(
      /\.cinder-code-block__viewport:focus-visible[\s\S]*?box-shadow:\s*inset\s+0\s+0\s+0\s+var\(--cinder-ring-width\)\s+var\(--cinder-ring-color\)/,
    );
    // The outline must be set to transparent so the inset shadow is the visible ring.
    expect(css).toMatch(
      /\.cinder-code-block__viewport:focus-visible[\s\S]*?outline:\s*var\(--cinder-ring-width\)\s+solid\s+transparent/,
    );
  });
});

describe('CodeBlock — automatic highlighting (bundled default)', () => {
  test('language set + no highlighter → loads the bundled default and highlights', async () => {
    const { container } = render(CodeBlock, { code: 'const x = 1;', language: 'js' });
    await waitFor(() => {
      const block = container.querySelector('.shiki-default');
      expect(block).not.toBeNull();
      expect(block?.textContent).toBe('const x = 1;');
    });
    expect(loadDefaultHighlighter).toHaveBeenCalledTimes(1);
    // The default highlighter output replaces the plain fallback.
    expect(container.querySelector('.cinder-code-block__pre')).toBeNull();
  });

  test('highlighted state keeps the stable viewport as the keyboard scroll target', async () => {
    const { container } = render(CodeBlock, { code: 'const x = 1;', language: 'js' });
    const viewportBefore = container.querySelector('.cinder-code-block__viewport');
    expect(viewportBefore).not.toBeNull();
    await waitFor(() => {
      expect(container.querySelector('.cinder-code-block__highlighted')).not.toBeNull();
    });
    const viewportAfter = container.querySelector('.cinder-code-block__viewport');
    expect(viewportAfter).toBe(viewportBefore);
    expect(viewportAfter?.getAttribute('tabindex')).toBe('0');
    expect(container.querySelector('pre.cinder-code-block__pre')).toBeNull();
  });

  test('the same viewport remains mounted when highlighting resolves', async () => {
    let resolveHighlight: ((html: string) => void) | undefined;
    defaultHighlighterImpl = () =>
      new Promise<string>((resolve) => {
        resolveHighlight = resolve;
      });

    const { container } = render(CodeBlock, { code: 'const x = 1;', language: 'js' });

    await waitFor(() => {
      expect(resolveHighlight).toBeDefined();
      expect(container.querySelector('pre.cinder-code-block__pre')).not.toBeNull();
    });

    const viewportBefore = container.querySelector('.cinder-code-block__viewport');
    expect(viewportBefore).not.toBeNull();
    resolveHighlight?.('<pre class="shiki shiki-default"><code>const x = 1;</code></pre>');

    await waitFor(() => {
      expect(
        container.querySelector('.cinder-code-block__highlighted .shiki-default'),
      ).not.toBeNull();
    });

    expect(container.querySelector('.cinder-code-block__viewport')).toBe(viewportBefore);
  });

  test('default-load failure falls back to escaped plain code (warn names language, never code)', async () => {
    loadDefaultHighlighter.mockImplementationOnce(async () => {
      throw new Error('chunk load failed');
    });
    const { container } = render(CodeBlock, { code: 'const secret = "p@ss";', language: 'js' });
    await waitFor(() => {
      expect(container.querySelector('.cinder-code-block__code')?.textContent).toBe(
        'const secret = "p@ss";',
      );
    });
    // Dev warning fired, mentions the language, but NEVER the code content
    // (code blocks may contain secrets). Read from the module-level spy.
    expect(warnSpy).toHaveBeenCalled();
    const flattened = warnSpy.mock.calls.flat().map(String).join(' ');
    expect(flattened).toContain('language "js"');
    expect(flattened).not.toContain('p@ss');
    expect(flattened).not.toContain('secret');
  });
});

describe('CodeBlock — explicit highlighter prop', () => {
  test('highlighter output replaces the plain pre/code and renders VERBATIM via {@html}', async () => {
    const { container } = render(CodeBlock, {
      code: 'const x = 1;',
      language: 'js',
      highlighter: customHighlighter,
    });
    await waitFor(() => {
      const token = container.querySelector('.custom-token');
      expect(token).not.toBeNull();
      // Verbatim: the highlighter's exact markup is in the DOM.
      expect(token?.textContent).toBe('const x = 1;');
      expect(container.querySelector('.cinder-code-block__pre')).toBeNull();
    });
  });

  test('explicit highlighter bypasses the default — default loader is NEVER invoked', async () => {
    const { container } = render(CodeBlock, {
      code: 'const x = 1;',
      language: 'js',
      highlighter: customHighlighter,
    });
    await waitFor(() => {
      expect(container.querySelector('.custom-token')).not.toBeNull();
    });
    // Prove the side effect did not fire — not just output equality.
    expect(loadDefaultHighlighter).not.toHaveBeenCalled();
  });

  test('synchronous highlighter exception falls back to plain code', async () => {
    const { container } = render(CodeBlock, {
      code: 'const x = 1;',
      language: 'js',
      highlighter: () => {
        throw new Error('boom');
      },
    });
    await waitFor(() => {
      expect(container.querySelector('.cinder-code-block__code')?.textContent).toBe('const x = 1;');
    });
  });

  test('async highlighter rejection falls back to plain code', async () => {
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

  test('empty highlighter output falls back to escaped plain code', async () => {
    const { container } = render(CodeBlock, {
      code: 'const visible = true;',
      language: 'js',
      highlighter: async () => '',
    });
    await waitFor(() => {
      expect(container.querySelector('.cinder-code-block__code')?.textContent).toBe(
        'const visible = true;',
      );
    });
  });
});

describe('CodeBlock — highlight={false} absolute off switch', () => {
  test('highlight={false} keeps language label, escapes plain code, no Shiki import', async () => {
    const { container } = render(CodeBlock, {
      code: 'const x = 1;',
      language: 'ts',
      highlight: false,
    });
    expect(container.querySelector('.cinder-code-block__language')?.textContent?.trim()).toBe('ts');
    expect(container.querySelector('pre.cinder-code-block__pre')).not.toBeNull();
    // Give any (mistaken) async path a tick to fire, then assert it never did.
    await Promise.resolve();
    expect(loadDefaultHighlighter).not.toHaveBeenCalled();
  });

  test('highlight={false} + explicit highlighter → highlighter is NOT called, output escaped', async () => {
    const highlighterSpy = mock(customHighlighter);
    const { container } = render(CodeBlock, {
      code: '<img src=x onerror=alert(1)>',
      language: 'html',
      highlight: false,
      highlighter: highlighterSpy,
    });
    await Promise.resolve();
    // The off switch overrides even an explicit highlighter.
    expect(highlighterSpy).not.toHaveBeenCalled();
    expect(loadDefaultHighlighter).not.toHaveBeenCalled();
    // Code is escaped via Svelte text interpolation, NOT {@html}.
    const code = container.querySelector('.cinder-code-block__code');
    expect(code?.textContent).toBe('<img src=x onerror=alert(1)>');
    expect(container.querySelector('img')).toBeNull();
  });
});

describe('CodeBlock — safe-path escaping (no {@html} on the plain paths)', () => {
  // The dangerous {@html} path is ONLY the successful custom/default highlight.
  // Every plain-fallback path must escape via Svelte interpolation.
  const malicious = '<img src=x onerror=alert(1)><svg onload=alert(2)></svg>';

  test('no language → escaped, no injected nodes', () => {
    const { container } = render(CodeBlock, { code: malicious });
    expect(container.querySelector('.cinder-code-block__code')?.textContent).toBe(malicious);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('svg')).toBeNull();
  });

  test('failed default load → escaped, no injected nodes', async () => {
    loadDefaultHighlighter.mockImplementationOnce(async () => {
      throw new Error('load failed');
    });
    const { container } = render(CodeBlock, { code: malicious, language: 'html' });
    await waitFor(() => {
      expect(container.querySelector('.cinder-code-block__code')?.textContent).toBe(malicious);
    });
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('svg')).toBeNull();
  });

  test('empty highlighter output → escaped, no injected nodes', async () => {
    const { container } = render(CodeBlock, {
      code: malicious,
      language: 'html',
      highlighter: async () => '',
    });
    await waitFor(() => {
      expect(container.querySelector('.cinder-code-block__code')?.textContent).toBe(malicious);
    });
    expect(container.querySelector('img')).toBeNull();
  });
});

describe('CodeBlock — stale-async cancellation (no trusted-HTML leak)', () => {
  test('a slow stale highlight does not overwrite a newer escaped state', async () => {
    // First highlighter never resolves until we release it; by then the props
    // have changed to highlight={false}. The stale {@html} result must NOT win.
    let releaseStale: ((html: string) => void) | undefined;
    const staleHighlighter: Highlighter = () =>
      new Promise<string>((resolve) => {
        releaseStale = resolve;
      });

    const { container, rerender } = render(CodeBlock, {
      code: 'stale',
      language: 'js',
      highlighter: staleHighlighter,
    });

    await waitFor(() => {
      expect(releaseStale).toBeDefined();
    });

    // Change to the absolute off switch while the first highlight is in flight.
    await rerender({ code: 'fresh', language: 'js', highlight: false });

    // Now release the stale (trusted-HTML) result late.
    releaseStale?.('<div class="stale-token">PWNED</div>');
    await Promise.resolve();
    await Promise.resolve();

    // The latest state wins: escaped plain `fresh`, never the stale token.
    expect(container.querySelector('.stale-token')).toBeNull();
    expect(container.querySelector('.cinder-code-block__code')?.textContent).toBe('fresh');
  });

  test('changing the highlighter mid-flight renders only the latest result', async () => {
    let releaseFirst: ((html: string) => void) | undefined;
    const firstHighlighter: Highlighter = () =>
      new Promise<string>((resolve) => {
        releaseFirst = resolve;
      });

    const { container, rerender } = render(CodeBlock, {
      code: 'x',
      language: 'js',
      highlighter: firstHighlighter,
    });

    await waitFor(() => {
      expect(releaseFirst).toBeDefined();
    });

    // Swap to a synchronous highlighter that resolves immediately.
    await rerender({
      code: 'x',
      language: 'js',
      highlighter: (code: string) =>
        `<pre class="shiki"><code><span class="latest-token">${code}</span></code></pre>`,
    });

    await waitFor(() => {
      expect(container.querySelector('.latest-token')).not.toBeNull();
    });

    // Release the stale first result late — it must not overwrite the latest.
    releaseFirst?.('<div class="stale-token">stale</div>');
    await Promise.resolve();
    await Promise.resolve();

    expect(container.querySelector('.stale-token')).toBeNull();
    expect(container.querySelector('.latest-token')?.textContent).toBe('x');
  });
});
