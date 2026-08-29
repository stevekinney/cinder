/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

// setupHappyDom() MUST run before any `@testing-library/svelte` import. testing-library
// reads `globalThis.document` / `window` at module-init (top-level, not inside test bodies),
// so we register happy-dom's globals first and then dynamic-import testing-library below.
setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { default: Citation } = await import('./citation.svelte');
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

describe('Citation', () => {
  test('renders the cinder-citation wrapper with its children', () => {
    const { container } = render(Citation, { sources: [], children: textSnippet('content') });
    const element = container.querySelector('.cinder-citation');
    expect(element).not.toBeNull();
    expect(element?.textContent).toContain('content');
  });

  test('merges a custom class alongside cinder-citation', () => {
    const { container } = render(Citation, {
      children: textSnippet('content'),
      sources: [],
      class: 'my-custom-class',
    });
    const element = container.querySelector('.cinder-citation');
    expect(element?.getAttribute('class')).toContain('cinder-citation');
    expect(element?.getAttribute('class')).toContain('my-custom-class');
  });

  test('names the inline marker with the number of paginated sources', () => {
    const { container } = render(Citation, {
      label: 'References',
      sources: [
        { label: 'Primary source', url: 'https://example.com/one' },
        { label: 'Second source', detail: 'Supporting context' },
      ],
    });
    const marker = container.querySelector('.cinder-citation__marker');
    expect(marker?.getAttribute('aria-label')).toBe('References (2)');
    expect(marker?.textContent).toBe('[2]');
  });
});
