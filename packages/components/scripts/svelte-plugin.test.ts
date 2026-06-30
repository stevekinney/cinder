import { describe, expect, it } from 'bun:test';

import {
  findOneArgumentServerComponentBoundaries,
  preserveServerComponentIdentity,
} from './svelte-plugin.ts';

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
