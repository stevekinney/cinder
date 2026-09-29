import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { tick } from 'svelte';

import { prepareSvelteServerSource, renderThenHydrate } from '@lostgradient/testing';

import PortalHydrationTest from './_portal-hydration-test.svelte';
import { childSnippet, Portal, render, restorePortalGlobalState } from './portal-test-helpers.ts';

const portalHydrationSource = new URL('./_portal-hydration-test.svelte', import.meta.url).pathname;
await prepareSvelteServerSource(portalHydrationSource);

beforeEach(() => document.body.replaceChildren());
afterEach(restorePortalGlobalState);

describe('Portal', () => {
  test('moves children into a custom target', async () => {
    const host = document.createElement('div');
    host.id = 'portal-host';
    document.body.appendChild(host);

    const view = render(Portal, {
      props: {
        target: '#portal-host',
        children: childSnippet,
      },
    });

    await tick();

    expect(host.querySelector('[data-testid="portal-child"]')).not.toBeNull();
    expect(view.container.querySelector('[data-testid="portal-child"]')).toBeNull();

    view.unmount();
    expect(host.querySelector('[data-testid="portal-child"]')).toBeNull();
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

  test('preserves explicit portal theme attributes over inherited root themes', async () => {
    document.documentElement.setAttribute('data-theme', 'light');
    document.documentElement.setAttribute('data-cinder-theme', 'light');

    render(Portal, {
      props: {
        'data-theme': 'dark',
        'data-cinder-theme': 'contrast',
        children: childSnippet,
      },
    });

    await tick();

    const wrapper = document.body.querySelector('[data-testid="portal-child"]')?.parentElement;
    expect(wrapper?.getAttribute('data-theme')).toBe('dark');
    expect(wrapper?.getAttribute('data-cinder-theme')).toBe('contrast');
  });

  test('keeps updated explicit portal theme attributes during inherited sync', async () => {
    document.documentElement.setAttribute('data-theme', 'light');

    const { rerender } = render(Portal, {
      props: {
        'data-theme': 'dark',
        children: childSnippet,
      },
    });

    await tick();

    const wrapper = document.body.querySelector('[data-testid="portal-child"]')?.parentElement;
    expect(wrapper?.getAttribute('data-theme')).toBe('dark');

    await rerender({
      'data-theme': 'light',
      children: childSnippet,
    });
    await tick();
    document.documentElement.setAttribute('data-theme', 'dark');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(wrapper?.getAttribute('data-theme')).toBe('light');
  });

  test('allows clearing explicit portal theme attributes during inherited sync', async () => {
    document.documentElement.setAttribute('data-theme', 'light');

    const { rerender } = render(Portal, {
      props: {
        'data-theme': 'dark',
        children: childSnippet,
      },
    });

    await tick();

    const wrapper = document.body.querySelector('[data-testid="portal-child"]')?.parentElement;
    expect(wrapper?.getAttribute('data-theme')).toBe('dark');

    await rerender({
      'data-theme': undefined,
      children: childSnippet,
    });
    await tick();
    expect(wrapper?.getAttribute('data-theme')).toBe('light');

    document.documentElement.setAttribute('data-theme', 'contrast');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(wrapper?.getAttribute('data-theme')).toBe('contrast');
  });

  test('allows explicit null to clear portal theme attributes during inherited sync', async () => {
    document.documentElement.setAttribute('data-theme', 'light');
    document.documentElement.setAttribute('data-cinder-theme', 'high-contrast');

    const { rerender } = render(Portal, {
      props: {
        'data-theme': 'dark',
        'data-cinder-theme': 'dark',
        children: childSnippet,
      },
    });

    await tick();

    const wrapper = document.body.querySelector('[data-testid="portal-child"]')?.parentElement;
    expect(wrapper?.getAttribute('data-theme')).toBe('dark');
    expect(wrapper?.getAttribute('data-cinder-theme')).toBe('dark');

    await rerender({
      'data-theme': null,
      'data-cinder-theme': null,
      children: childSnippet,
    });
    await tick();

    expect(wrapper?.hasAttribute('data-theme')).toBe(false);
    expect(wrapper?.hasAttribute('data-cinder-theme')).toBe(false);

    document.documentElement.setAttribute('data-theme', 'contrast');
    document.documentElement.setAttribute('data-cinder-theme', 'light');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(wrapper?.hasAttribute('data-theme')).toBe(false);
    expect(wrapper?.hasAttribute('data-cinder-theme')).toBe(false);
  });

  test('preserves same-value explicit portal theme attributes during inherited sync', async () => {
    document.documentElement.setAttribute('data-theme', 'dark');

    const { rerender } = render(Portal, {
      props: {
        children: childSnippet,
      },
    });

    await tick();

    const wrapper = document.body.querySelector('[data-testid="portal-child"]')?.parentElement;
    expect(wrapper?.getAttribute('data-theme')).toBe('dark');

    await rerender({
      'data-theme': 'dark',
      children: childSnippet,
    });
    await tick();
    document.documentElement.setAttribute('data-theme', 'light');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(wrapper?.getAttribute('data-theme')).toBe('dark');
  });

  test('omits portal children from SSR when disabled is false', async () => {
    const result = await renderThenHydrate(PortalHydrationTest, portalHydrationSource, {});

    try {
      expect(result.ssrHtml).not.toContain('Portaled child');
    } finally {
      await result.cleanup();
    }
  });
});
