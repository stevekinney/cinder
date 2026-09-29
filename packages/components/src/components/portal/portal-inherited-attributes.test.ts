import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { tick } from 'svelte';

import {
  childSnippet,
  copyInheritedPortalAttributes,
  Portal,
  render,
  restorePortalGlobalState,
} from './portal-test-helpers.ts';

beforeEach(() => document.body.replaceChildren());
afterEach(restorePortalGlobalState);

describe('Portal', () => {
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
      lang: null,
      dataTheme: null,
      theme: null,
    });

    expect(element.getAttribute('dir')).toBe('rtl');
    expect(element.getAttribute('data-theme')).toBe('dark');
    expect(element.getAttribute('data-cinder-theme')).toBe('dark');

    copyInheritedPortalAttributes(element, null, true, {
      dir: 'ltr',
      lang: null,
      dataTheme: null,
      theme: null,
    });

    expect(element.getAttribute('dir')).toBe('ltr');
    expect(element.hasAttribute('data-theme')).toBe(false);
    expect(element.hasAttribute('data-cinder-theme')).toBe(false);
  });

  test('keeps inherited portal theme attributes synchronized while mounted', async () => {
    document.documentElement.setAttribute('data-theme', 'dark');
    document.documentElement.setAttribute('dir', 'ltr');

    render(Portal, {
      props: {
        children: childSnippet,
      },
    });

    await tick();

    const wrapper = document.body.querySelector('[data-testid="portal-child"]')?.parentElement;
    expect(wrapper?.getAttribute('data-theme')).toBe('dark');

    document.documentElement.setAttribute('data-theme', 'light');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(wrapper?.getAttribute('data-theme')).toBe('light');
  });

  test('updates inherited portal direction when the source stops providing an explicit dir', async () => {
    document.documentElement.removeAttribute('dir');

    const scopedAncestor = document.createElement('section');
    scopedAncestor.setAttribute('dir', 'rtl');
    const mountPoint = document.createElement('div');
    scopedAncestor.appendChild(mountPoint);
    document.body.appendChild(scopedAncestor);

    const { container } = render(Portal, {
      target: mountPoint,
      props: {
        children: childSnippet,
      },
    });
    scopedAncestor.appendChild(container);

    await tick();

    const wrapper = document.body.querySelector('[data-testid="portal-child"]')?.parentElement;
    expect(wrapper?.getAttribute('dir')).toBe('rtl');

    scopedAncestor.removeAttribute('dir');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(wrapper?.getAttribute('dir')).toBe('ltr');
  });

  test('preserves an explicitly empty inherited language', () => {
    const scopedAncestor = document.createElement('section');
    scopedAncestor.setAttribute('lang', '');
    const source = document.createElement('span');
    scopedAncestor.appendChild(source);
    const element = document.createElement('div');

    copyInheritedPortalAttributes(element, source, true, {
      dir: null,
      lang: null,
      dataTheme: null,
      theme: null,
    });

    expect(element.hasAttribute('lang')).toBe(true);
    expect(element.getAttribute('lang')).toBe('');
  });

  test('updates explicit language without remounting focused content', async () => {
    const view = render(Portal, {
      props: {
        lang: 'en',
        children: childSnippet,
      },
    });
    await tick();
    const button = document.body.querySelector<HTMLButtonElement>('[data-testid="portal-child"]')!;
    const wrapper = button.parentElement;
    button.focus();

    await view.rerender({
      lang: 'fr',
      children: childSnippet,
    });
    await tick();

    expect(button.parentElement?.getAttribute('lang')).toBe('fr');
    expect(button.parentElement).toBe(wrapper);
    expect(document.activeElement).toBe(button);
  });

  test('follows scoped theme additions on source ancestors while mounted', async () => {
    const scopedAncestor = document.createElement('section');
    const mountPoint = document.createElement('div');
    scopedAncestor.appendChild(mountPoint);
    document.body.appendChild(scopedAncestor);

    const { container } = render(Portal, {
      target: mountPoint,
      props: {
        children: childSnippet,
      },
    });
    scopedAncestor.appendChild(container);

    await tick();

    const wrapper = document.body.querySelector('[data-testid="portal-child"]')?.parentElement;
    expect(wrapper?.hasAttribute('data-theme')).toBe(false);

    scopedAncestor.setAttribute('data-theme', 'dark');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(wrapper?.getAttribute('data-theme')).toBe('dark');
  });

  test('follows inherited attributes across a shadow host while mounted', async () => {
    const host = document.createElement('section');
    host.setAttribute('data-theme', 'dark');
    const shadow = host.attachShadow({ mode: 'open' });
    const mountPoint = document.createElement('div');
    shadow.appendChild(mountPoint);
    document.body.appendChild(host);

    render(Portal, {
      target: mountPoint,
      props: {
        children: childSnippet,
      },
    });
    await tick();

    const wrapper = document.body.querySelector('[data-testid="portal-child"]')?.parentElement;
    expect(wrapper?.getAttribute('data-theme')).toBe('dark');

    host.setAttribute('data-theme', 'light');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(wrapper?.getAttribute('data-theme')).toBe('light');
  });
});
