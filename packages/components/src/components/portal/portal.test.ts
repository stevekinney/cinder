/// <reference lib="dom" />
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { createRawSnippet, tick } from 'svelte';

import { setupHappyDom } from '../../test/happy-dom.ts';
import { renderThenHydrate } from '../../test/hydrate.ts';

setupHappyDom();

const { render, cleanup } = await import('@testing-library/svelte');
const { default: Portal } = await import('./portal.svelte');
const { copyInheritedPortalAttributes } = await import('./portal.utilities.svelte.ts');

const childSnippet = createRawSnippet(() => ({
  render: () => '<button data-testid="portal-child">Portaled child</button>',
}));

beforeEach(() => {
  document.body.replaceChildren();
});

afterEach(() => {
  // Unmount rendered components (runs Svelte teardown) before clearing the DOM —
  // replaceChildren() alone removes nodes but leaks component effects/subscriptions.
  cleanup();
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
        'data-theme': 'dark',
        'data-cinder-theme': 'high-contrast',
        children: childSnippet,
      },
    });

    await tick();

    const wrapper = document.body.querySelector(
      '[dir="rtl"][data-theme="dark"][data-cinder-theme="high-contrast"]',
    );
    expect(wrapper?.querySelector('[data-testid="portal-child"]')).not.toBeNull();
  });

  test('omits portal children from SSR when disabled is false', async () => {
    const sourcePath = new URL('./portal.svelte', import.meta.url).pathname;
    const result = await renderThenHydrate(Portal, sourcePath, {
      children: childSnippet,
      disabled: false,
    });

    try {
      expect(result.ssrHtml).not.toContain('Portaled child');
    } finally {
      result.cleanup();
    }
  });

  test('retargets when the target prop changes after mount', async () => {
    const hostA = document.createElement('div');
    hostA.id = 'portal-host-a';
    const hostB = document.createElement('div');
    hostB.id = 'portal-host-b';
    document.body.append(hostA, hostB);

    const { rerender } = render(Portal, {
      props: { target: '#portal-host-a', children: childSnippet },
    });

    await tick();
    expect(hostA.querySelector('[data-testid="portal-child"]')).not.toBeNull();

    await rerender({ target: '#portal-host-b', children: childSnippet });
    await tick();

    expect(hostA.querySelector('[data-testid="portal-child"]')).toBeNull();
    expect(hostB.querySelector('[data-testid="portal-child"]')).not.toBeNull();
  });

  test('renders inline when the target selector is unresolved after hydration', async () => {
    const { container } = render(Portal, {
      props: {
        target: '#missing-portal-host',
        children: childSnippet,
      },
    });

    await tick();

    expect(container.querySelector('[data-testid="portal-child"]')).not.toBeNull();
  });

  test('clears inherited attributes back to explicit initial values', () => {
    const element = document.createElement('div');
    element.setAttribute('dir', 'ltr');

    const themedSource = document.createElement('section');
    themedSource.setAttribute('dir', 'rtl');
    themedSource.setAttribute('data-theme', 'dark');
    themedSource.setAttribute('data-cinder-theme', 'dark');
    const child = document.createElement('span');
    themedSource.appendChild(child);

    copyInheritedPortalAttributes(element, child, true, {
      dir: 'ltr',
      dataTheme: null,
      theme: null,
    });

    expect(element.getAttribute('dir')).toBe('rtl');
    expect(element.getAttribute('data-theme')).toBe('dark');
    expect(element.getAttribute('data-cinder-theme')).toBe('dark');

    copyInheritedPortalAttributes(element, null, true, {
      dir: 'ltr',
      dataTheme: null,
      theme: null,
    });

    expect(element.getAttribute('dir')).toBe('ltr');
    expect(element.hasAttribute('data-theme')).toBe(false);
    expect(element.hasAttribute('data-cinder-theme')).toBe(false);
  });

  test('preserves a protected computed direction over inherited auto direction', () => {
    const element = document.createElement('div');
    element.setAttribute('dir', 'rtl');
    element.dataset['cinderExplicitDirection'] = 'true';

    const autoDirectionSource = document.createElement('section');
    autoDirectionSource.setAttribute('dir', 'auto');
    const child = document.createElement('span');
    autoDirectionSource.appendChild(child);

    copyInheritedPortalAttributes(element, child, true, {
      dir: 'rtl',
      dataTheme: null,
      theme: null,
    });

    expect(element.getAttribute('dir')).toBe('rtl');
  });

  test('detaches from the target and reappears inline when disabled flips false to true', async () => {
    // Regression for Codex round 2 finding: previously the $effect cleanup detached the wrapper
    // when `disabled` flipped true but nothing reattached it inline, so the child silently vanished
    // from the entire DOM. The placeholder comment anchor now reinserts the wrapper inline.
    const host = document.createElement('div');
    host.id = 'portal-host';
    document.body.appendChild(host);

    const { container, rerender } = render(Portal, {
      props: { target: '#portal-host', disabled: false, children: childSnippet },
    });

    await tick();
    expect(host.querySelector('[data-testid="portal-child"]')).not.toBeNull();

    await rerender({ target: '#portal-host', disabled: true, children: childSnippet });
    await tick();

    // After disabling: gone from the previous target, present back in the original render container.
    expect(host.querySelector('[data-testid="portal-child"]')).toBeNull();
    expect(container.querySelector('[data-testid="portal-child"]')).not.toBeNull();
  });
});
