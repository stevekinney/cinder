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
      lang: null,
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

  test('restores current explicit direction when a portal is disabled inline', async () => {
    const host = document.createElement('div');
    host.id = 'portal-host';
    document.body.appendChild(host);

    const { container, rerender } = render(Portal, {
      props: { target: '#portal-host', dir: 'rtl', disabled: false, children: childSnippet },
    });

    await tick();

    const wrapper = document.body.querySelector('[data-testid="portal-child"]')?.parentElement;
    expect(wrapper?.getAttribute('dir')).toBe('rtl');

    await rerender({ target: '#portal-host', dir: 'ltr', disabled: true, children: childSnippet });
    await tick();

    expect(container.querySelector('[data-testid="portal-child"]')?.parentElement).toBe(wrapper);
    expect(wrapper?.getAttribute('dir')).toBe('ltr');
  });

  test('resumes inherited direction when an explicit portal direction is removed', async () => {
    const view = render(Portal, {
      props: { dir: 'ltr', children: childSnippet },
    });
    view.container.style.direction = 'rtl';
    await tick();

    const wrapper = document.body.querySelector('[data-testid="portal-child"]')?.parentElement;
    expect(wrapper?.getAttribute('dir')).toBe('ltr');

    await view.rerender({ dir: undefined, children: childSnippet });
    await tick();

    expect(wrapper?.getAttribute('dir')).toBe('rtl');
  });

  test('allows explicit null to clear portal direction during inherited sync', async () => {
    document.documentElement.setAttribute('dir', 'rtl');

    const { rerender } = render(Portal, {
      props: { dir: 'ltr', children: childSnippet },
    });

    await tick();

    const wrapper = document.body.querySelector('[data-testid="portal-child"]')?.parentElement;
    expect(wrapper?.getAttribute('dir')).toBe('ltr');

    await rerender({ dir: null, children: childSnippet });
    await tick();

    expect(wrapper?.hasAttribute('dir')).toBe(false);

    document.documentElement.setAttribute('dir', 'auto');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(wrapper?.hasAttribute('dir')).toBe(false);
  });

  test('clears a removed explicit direction instead of restoring the mount value', async () => {
    const { rerender } = render(Portal, {
      props: { dir: 'rtl', children: childSnippet },
    });

    await tick();
    const wrapper = document.body.querySelector('[data-testid="portal-child"]')?.parentElement;
    expect(wrapper?.getAttribute('dir')).toBe('rtl');

    await rerender({ dir: undefined, children: childSnippet });
    await tick();

    expect(wrapper?.getAttribute('dir')).toBe('ltr');
  });

  test('falls back to an authored source direction after removing an explicit direction', async () => {
    const source = document.createElement('section');
    source.setAttribute('dir', 'rtl');
    const mountPoint = document.createElement('div');
    source.append(mountPoint);
    document.body.append(source);

    const { container, rerender } = render(Portal, {
      target: mountPoint,
      props: { dir: 'ltr', children: childSnippet },
    });
    source.append(container);
    await tick();

    const wrapper = document.body.querySelector('[data-testid="portal-child"]')?.parentElement;
    expect(wrapper?.getAttribute('dir')).toBe('ltr');

    await rerender({ dir: undefined, children: childSnippet });
    await tick();

    expect(wrapper?.getAttribute('dir')).toBe('rtl');

    source.setAttribute('dir', 'ltr');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(wrapper?.getAttribute('dir')).toBe('ltr');
  });

  test('falls back to a computed source direction after removing an explicit direction', async () => {
    const source = document.createElement('section');
    source.style.direction = 'rtl';
    const mountPoint = document.createElement('div');
    source.append(mountPoint);
    document.body.append(source);

    const { container, rerender } = render(Portal, {
      target: mountPoint,
      props: { dir: 'ltr', children: childSnippet },
    });
    source.append(container);
    await tick();

    const wrapper = document.body.querySelector('[data-testid="portal-child"]')?.parentElement;
    expect(wrapper?.getAttribute('dir')).toBe('ltr');

    await rerender({ dir: undefined, children: childSnippet });
    await tick();

    expect(wrapper?.getAttribute('dir')).toBe('rtl');

    source.style.direction = 'ltr';
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(wrapper?.getAttribute('dir')).toBe('ltr');
  });

  test('reapplies a different explicit direction after removing one', async () => {
    const { rerender } = render(Portal, {
      props: { dir: 'auto', children: childSnippet },
    });

    await tick();
    const wrapper = document.body.querySelector('[data-testid="portal-child"]')?.parentElement;

    await rerender({ dir: undefined, children: childSnippet });
    await tick();
    expect(wrapper?.getAttribute('dir')).toBe('ltr');

    await rerender({ dir: 'rtl', children: childSnippet });
    await tick();
    expect(wrapper?.getAttribute('dir')).toBe('rtl');
  });

  test('restores initial attributes when a themed portal is disabled inline', async () => {
    document.documentElement.setAttribute('data-theme', 'dark');

    const { container, rerender } = render(Portal, {
      props: { disabled: false, children: childSnippet },
    });

    await tick();

    const wrapper = document.body.querySelector('[data-testid="portal-child"]')?.parentElement;
    expect(wrapper?.getAttribute('data-theme')).toBe('dark');

    document.documentElement.removeAttribute('data-theme');
    await rerender({ disabled: true, children: childSnippet });
    await tick();

    expect(container.querySelector('[data-testid="portal-child"]')?.parentElement).toBe(wrapper);
    expect(wrapper?.hasAttribute('data-theme')).toBe(false);
  });
});
