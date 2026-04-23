/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../test/happy-dom.ts';
setupHappyDom();

// Testing library imports have to come after the DOM is registered so their module-init
// references `document` / `window` pick up the happy-dom globals.
const { render } = await import('@testing-library/svelte');
const { default: Button } = await import('./button.svelte');

describe('Button rendering', () => {
  test('renders a <button> when no href is provided', () => {
    const { container } = render(Button, { props: { label: 'click me' } });
    expect(container.querySelector('button')).not.toBeNull();
    expect(container.querySelector('a')).toBeNull();
  });

  test('renders an <a> when href is provided', () => {
    const { container } = render(Button, { props: { href: '/target', label: 'go' } });
    expect(container.querySelector('a')).not.toBeNull();
    expect(container.querySelector('button')).toBeNull();
  });

  test('button applies variant + size as data attributes', () => {
    const { container } = render(Button, {
      props: { label: 'tag', variant: 'danger', size: 'lg' },
    });
    const button = container.querySelector('button');
    expect(button?.getAttribute('data-cinder-variant')).toBe('danger');
    expect(button?.getAttribute('data-cinder-size')).toBe('lg');
  });

  test('loading button has disabled + aria-busy + aria-disabled', () => {
    const { container } = render(Button, { props: { label: 'sending', loading: true } });
    const button = container.querySelector('button');
    expect(button?.hasAttribute('disabled')).toBe(true);
    expect(button?.getAttribute('aria-busy')).toBe('true');
    expect(button?.getAttribute('aria-disabled')).toBe('true');
    expect(button?.getAttribute('data-cinder-loading')).toBe('');
  });

  test('loading link removes href and is un-tab-reachable', () => {
    const { container } = render(Button, {
      props: { href: '/target', label: 'go', loading: true },
    });
    const anchor = container.querySelector('a');
    expect(anchor?.hasAttribute('href')).toBe(false);
    expect(anchor?.getAttribute('tabindex')).toBe('-1');
    expect(anchor?.getAttribute('aria-disabled')).toBe('true');
    expect(anchor?.getAttribute('aria-busy')).toBe('true');
  });

  test('loading link does NOT invoke consumer onclick', () => {
    let invocationCount = 0;
    const { container } = render(Button, {
      props: {
        href: '/target',
        label: 'go',
        loading: true,
        onclick: () => {
          invocationCount += 1;
        },
      },
    });
    const anchor = container.querySelector('a');
    anchor?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(invocationCount).toBe(0);
  });

  test('non-loading link DOES invoke consumer onclick', () => {
    let invocationCount = 0;
    const { container } = render(Button, {
      props: {
        href: '/target',
        label: 'go',
        onclick: () => {
          invocationCount += 1;
        },
      },
    });
    const anchor = container.querySelector('a');
    anchor?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(invocationCount).toBe(1);
  });

  test('consumer-provided aria-disabled survives when not loading', () => {
    const { container } = render(Button, {
      props: { label: 'x', 'aria-disabled': 'true' },
    });
    const button = container.querySelector('button');
    // Consumer set aria-disabled='true' manually; not loading, so we preserve it.
    expect(button?.getAttribute('aria-disabled')).toBe('true');
  });

  test('consumer class name merges with .cinder-button', () => {
    const { container } = render(Button, {
      props: { label: 'x', class: 'my-extra-class' },
    });
    const classAttr = container.querySelector('button')?.getAttribute('class') ?? '';
    expect(classAttr).toContain('cinder-button');
    expect(classAttr).toContain('my-extra-class');
  });
});
