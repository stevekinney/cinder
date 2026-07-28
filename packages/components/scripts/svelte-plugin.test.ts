import { describe, expect, it } from 'bun:test';

import {
  allowsStyleBlock,
  findOneArgumentServerComponentBoundaries,
  hasAuthoredStyleBlock,
  preserveServerComponentIdentity,
  publishedSvelteCompileFilename,
} from './svelte-plugin.ts';

describe('publishedSvelteCompileFilename', () => {
  it('normalizes workspace and installed package sources to the same filename', () => {
    const expected = 'node_modules/@lostgradient/cinder/src/components/data-grid/data-grid.svelte';

    expect(
      publishedSvelteCompileFilename(
        '/checkout/packages/components/src/components/data-grid/data-grid.svelte',
      ),
    ).toBe(expected);
    expect(
      publishedSvelteCompileFilename(
        '/consumer/node_modules/@lostgradient/cinder/src/components/data-grid/data-grid.svelte',
      ),
    ).toBe(expected);
  });

  it('normalizes the Chat workspace and installed package sources to the same filename', () => {
    const expected = 'node_modules/@lostgradient/chat/dist/components/chat/chat.svelte';

    expect(
      publishedSvelteCompileFilename('/checkout/packages/chat/src/lib/components/chat/chat.svelte'),
    ).toBe(expected);
    expect(
      publishedSvelteCompileFilename(
        '/consumer/node_modules/@lostgradient/chat/dist/components/chat/chat.svelte',
      ),
    ).toBe(expected);
  });

  it('leaves components outside the published package unchanged', () => {
    const playgroundPath = '/checkout/packages/playground/src/app.svelte';
    expect(publishedSvelteCompileFilename(playgroundPath)).toBe(playgroundPath);
  });
});

describe('hasAuthoredStyleBlock', () => {
  it('distinguishes authored style blocks from style directives', () => {
    expect(hasAuthoredStyleBlock('<div style:height={height}></div>')).toBe(false);
    expect(hasAuthoredStyleBlock('<style>.card { color: red; }</style>')).toBe(true);
  });

  it('ignores style markup inside scripts and comments', () => {
    expect(
      hasAuthoredStyleBlock(
        `<!-- <style>.fake { color: red; }</style> --><script>const example = '<style>.fake {}</style>';</script><div style:height={height}></div>`,
      ),
    ).toBe(false);
  });
});

describe('allowsStyleBlock', () => {
  it('allows component test fixtures to keep scoped styles local', () => {
    expect(
      allowsStyleBlock(
        '/checkout/packages/components/src/test/fixtures/virtualizer-live-fixture.svelte',
      ),
    ).toBe(true);
  });
});

describe('preserveServerComponentIdentity', () => {
  it('adds the exported component identity to one-argument server component boundaries', () => {
    const source = `
import * as $ from 'svelte/internal/server';

export default function Card($$renderer, $$props) {
  $$renderer.component(($$renderer) => {
    children($$renderer);
  });
}
`;

    const transformed = preserveServerComponentIdentity(source, 'card.svelte.js');

    expect(transformed).toContain('}, Card);');
    expect(findOneArgumentServerComponentBoundaries(transformed)).toEqual([]);
  });

  it('uses a named default export assignment when the component is exported separately', () => {
    const source = `
import * as $ from 'svelte/internal/server';

function Tabs($$renderer, $$props) {
  $$renderer.component(($$renderer) => {
    children($$renderer);
  });
}

export default Tabs;
`;

    const transformed = preserveServerComponentIdentity(source, 'tabs.svelte.js');

    expect(transformed).toContain('}, Tabs);');
    expect(findOneArgumentServerComponentBoundaries(transformed)).toEqual([]);
  });

  it('leaves existing two-argument server component boundaries unchanged', () => {
    const source = `
function Card($$renderer, $$props) {
  $$renderer.component(($$renderer) => {
    children($$renderer);
  }, Card);
}

export default Card;
`;

    expect(preserveServerComponentIdentity(source, 'card.svelte.js')).toBe(source);
  });

  it('leaves non-component modules unchanged', () => {
    const source = `
export function createRenderer(renderer) {
  renderer.component(() => {});
}
`;

    expect(preserveServerComponentIdentity(source, 'module.js')).toBe(source);
  });
});
