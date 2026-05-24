/// <reference lib="dom" />
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { createRawSnippet, tick } from 'svelte';

import { setupHappyDom } from '../../test/happy-dom.ts';
import { renderThenHydrate } from '../../test/hydrate.ts';

setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { default: Portal } = await import('./portal.svelte');

const childSnippet = createRawSnippet(() => ({
  render: () => '<button data-testid="portal-child">Portaled child</button>',
}));

beforeEach(() => {
  document.body.replaceChildren();
});

afterEach(() => {
  document.body.replaceChildren();
});

describe('Portal', () => {
  test('moves children into a custom target', async () => {
    const host = document.createElement('div');
    host.id = 'portal-host';
    document.body.appendChild(host);

    const { container } = render(Portal, {
      props: {
        target: '#portal-host',
        children: childSnippet,
      },
    });

    await tick();

    expect(host.querySelector('[data-testid="portal-child"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="portal-child"]')).toBeNull();
  });

  test('renders inline when disabled', async () => {
    const { container } = render(Portal, {
      props: {
        disabled: true,
        class: 'portal-inline',
        children: childSnippet,
      },
    });

    await tick();

    expect(container.querySelector('.portal-inline [data-testid="portal-child"]')).not.toBeNull();
  });

  test('preserves explicit portal attributes when no inherited source attribute exists', async () => {
    render(Portal, {
      props: {
        dir: 'rtl',
        'data-cinder-theme': 'high-contrast',
        children: childSnippet,
      },
    });

    await tick();

    const wrapper = document.body.querySelector('[dir="rtl"][data-cinder-theme="high-contrast"]');
    expect(wrapper?.querySelector('[data-testid="portal-child"]')).not.toBeNull();
  });

  test('omits portal children from SSR when disabled is false', async () => {
    const sourcePath = new URL('./portal.svelte', import.meta.url).pathname;
    const result = await renderThenHydrate(Portal, sourcePath, {
      children: childSnippet,
      disabled: false,
    });

    expect(result.ssrHtml).not.toContain('Portaled child');
    result.cleanup();
  });
});
