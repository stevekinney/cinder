/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { TableOfContentsHeadingRegistry } =
  await import('./table-of-contents-heading-registry.svelte.ts');

function mountFixture(html: string): HTMLElement {
  const container = document.createElement('div');
  container.innerHTML = html;
  document.body.append(container);
  return container;
}

describe('TableOfContentsHeadingRegistry', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  test('derives items from headings under the target, slugifying missing ids', () => {
    const target = mountFixture(`
      <h2>Getting Started</h2>
      <h2>API Reference</h2>
    `);

    const registry = new TableOfContentsHeadingRegistry();
    const cleanup = registry.sync(target, 'h2, h3, h4');

    expect(registry.items).toEqual([
      { id: 'getting-started', label: 'Getting Started', level: 2, children: [] },
      { id: 'api-reference', label: 'API Reference', level: 2, children: [] },
    ]);
    expect(target.querySelector('h2')?.id).toBe('getting-started');

    cleanup();
  });

  test('dedupes headings that already share an id by suffixing later ones', () => {
    const target = mountFixture(`
      <h2 id="overview">Overview</h2>
      <h2 id="overview">Overview</h2>
    `);

    const registry = new TableOfContentsHeadingRegistry();
    const cleanup = registry.sync(target, 'h2');

    expect(registry.items.map((item) => item.id)).toEqual(['overview', 'overview-2']);

    cleanup();
  });

  test('nests headings under their nearest preceding shallower-level heading', () => {
    const target = mountFixture(`
      <h2>Guides</h2>
      <h3>Install</h3>
      <h3>Configure</h3>
      <h2>Reference</h2>
    `);

    const registry = new TableOfContentsHeadingRegistry();
    const cleanup = registry.sync(target, 'h2, h3');

    expect(registry.items).toHaveLength(2);
    expect(registry.items[0]?.id).toBe('guides');
    expect(registry.items[0]?.children?.map((child) => child.id)).toEqual(['install', 'configure']);
    expect(registry.items[1]?.id).toBe('reference');

    cleanup();
  });

  test('skips headings with empty text content', () => {
    const target = mountFixture(`
      <h2>   </h2>
      <h2>Real Heading</h2>
    `);

    const registry = new TableOfContentsHeadingRegistry();
    const cleanup = registry.sync(target, 'h2');

    expect(registry.items.map((item) => item.label)).toEqual(['Real Heading']);

    cleanup();
  });

  test('reports no items when the target resolves to null', () => {
    const registry = new TableOfContentsHeadingRegistry();
    const cleanup = registry.sync('#does-not-exist', 'h2');

    expect(registry.items).toEqual([]);

    cleanup();
  });
});
