/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

// setupHappyDom() MUST run before any `@testing-library/svelte` import. testing-library
// reads `globalThis.document` / `window` at module-init (top-level, not inside test bodies),
// so we register happy-dom's globals first and then dynamic-import testing-library below.
setupHappyDom();

const { render, fireEvent, waitFor } = await import('@testing-library/svelte');
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
  test('renders custom marker children inside the trigger without the default marker', () => {
    const { container } = render(Citation, { sources: [], children: textSnippet('content') });
    const element = container.querySelector('.cinder-citation');
    const marker = container.querySelector('.cinder-citation__marker');
    expect(element).not.toBeNull();
    expect(marker?.textContent).toBe('content');
    expect(element?.textContent).not.toContain('[0]');
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

  test('clamps the current page when sources are removed', async () => {
    const { container, rerender } = render(Citation, {
      sources: [{ label: 'One' }, { label: 'Two' }],
    });
    await fireEvent.click(container.querySelector('.cinder-citation__marker')!);
    await waitFor(() =>
      expect(document.querySelector('[aria-label="Next source"]')).not.toBeNull(),
    );
    await fireEvent.click(document.querySelector('[aria-label="Next source"]')!);
    await rerender({ sources: [{ label: 'One' }] });
    await waitFor(() => expect(document.querySelector('section strong')?.textContent).toBe('One'));
  });
});
