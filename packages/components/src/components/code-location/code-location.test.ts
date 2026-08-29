/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

// setupHappyDom() MUST run before any `@testing-library/svelte` import. testing-library
// reads `globalThis.document` / `window` at module-init (top-level, not inside test bodies),
// so we register happy-dom's globals first and then dynamic-import testing-library below.
setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { default: CodeLocation } = await import('./code-location.svelte');
// createRawSnippet must be imported dynamically so Bun's svelte plugin (which patches
// the svelte package to resolve to the client build) applies before this import resolves.
// A top-level static import of 'svelte' resolves to svelte/index-server.js in Bun's
// non-browser environment, making `mount()` throw "not available on the server".
const { createRawSnippet } = await import('svelte');

/** Creates a Svelte 5 Snippet that renders text content. */
function textSnippet(text: string) {
  return createRawSnippet(() => ({
    render: () => `<span>${text}</span>`,
  }));
}

describe('CodeLocation', () => {
  test('renders the cinder-code-location wrapper with its children', () => {
    const { container } = render(CodeLocation, {
      file: 'src/index.ts',
      children: textSnippet('content'),
    });
    const element = container.querySelector('.cinder-code-location');
    expect(element).not.toBeNull();
    expect(element?.textContent).toContain('content');
  });

  test('merges a custom class alongside cinder-code-location', () => {
    const { container } = render(CodeLocation, {
      children: textSnippet('content'),
      file: 'src/index.ts',
      class: 'my-custom-class',
    });
    const element = container.querySelector('.cinder-code-location');
    expect(element?.getAttribute('class')).toContain('cinder-code-location');
    expect(element?.getAttribute('class')).toContain('my-custom-class');
  });

  test('formats file, line, and column as a code location', () => {
    const { container } = render(CodeLocation, {
      file: 'src/index.ts',
      line: 42,
      column: 7,
    });
    expect(container.querySelector('code')?.textContent).toBe('src/index.ts:42:7');
  });

  test('does not render an ambiguous column without a line', () => {
    const { container } = render(CodeLocation, { file: 'src/index.ts', column: 7 });
    expect(container.querySelector('code')?.textContent).toBe('src/index.ts');
  });
});
