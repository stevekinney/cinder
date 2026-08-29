/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { createRawSnippet } from 'svelte';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { cleanup, render } = await import('@testing-library/svelte');
const { default: ModalRegion } = await import('./modal-region.svelte');
const { default: ModalRegionHost } = await import('./modal-region-host.test.svelte');
type ModalApi = import('../../_internal/modal-context.ts').ModalApi;

afterEach(cleanup);

describe('ModalRegion', () => {
  test('standalone entrypoint imports Button styles for confirmations', () => {
    const source = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');
    expect(source).toContain("import '../button/button.css';");
  });

  test('renders its context-scoped application children without adding wrapper markup', () => {
    const children = createRawSnippet(() => ({
      render: () => '<button data-testid="application">Open modal</button>',
    }));
    const { container } = render(ModalRegion, { children });

    expect(container.querySelector('[data-testid="application"]')?.textContent).toBe('Open modal');
    expect(container.children).toHaveLength(1);
  });

  test('resolves confirmation as false after the region is destroyed', async () => {
    let api: ModalApi | undefined;
    const { unmount } = render(ModalRegionHost, {
      onReady: (value: ModalApi) => {
        api = value;
      },
    });

    expect(api).toBeDefined();
    unmount();

    await expect(api!.confirm({ title: 'Confirm action' })).resolves.toBe(false);
  });
});
