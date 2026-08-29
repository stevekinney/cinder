/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';
import { createRawSnippet } from 'svelte';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { cleanup, render } = await import('@testing-library/svelte');
const { default: ModalRegion } = await import('./modal-region.svelte');

afterEach(cleanup);

describe('ModalRegion', () => {
  test('renders its context-scoped application children without adding wrapper markup', () => {
    const children = createRawSnippet(() => ({
      render: () => '<button data-testid="application">Open modal</button>',
    }));
    const { container } = render(ModalRegion, { children });

    expect(container.querySelector('[data-testid="application"]')?.textContent).toBe('Open modal');
    expect(container.children).toHaveLength(1);
  });
});
