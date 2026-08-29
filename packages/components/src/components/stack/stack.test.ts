/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';
import { createRawSnippet } from 'svelte';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { cleanup, render } = await import('@testing-library/svelte');
const { default: Stack } = await import('./stack.svelte');

afterEach(cleanup);

function textSnippet(text: string) {
  return createRawSnippet(() => ({
    render: () => `<span>${text}</span>`,
  }));
}

describe('Stack', () => {
  test('renders a div by default with cinder-stack class', () => {
    const { container } = render(Stack, {
      props: { children: textSnippet('content') },
    });

    const root = container.querySelector('div.cinder-stack');
    expect(root).not.toBeNull();
    expect(root?.textContent).toContain('content');
  });

  test('honors the as prop and forwards attributes', () => {
    const { container } = render(Stack, {
      props: {
        as: 'section',
        'aria-label': 'Controls',
        children: textSnippet('content'),
      },
    });

    const root = container.querySelector('section.cinder-stack');
    expect(root?.getAttribute('aria-label')).toBe('Controls');
  });

  test('threads layout props through stable custom properties and data attributes', () => {
    const { container } = render(Stack, {
      props: {
        direction: 'row',
        gap: 'var(--cinder-space-3)',
        align: 'center',
        justify: 'between',
        wrap: true,
        class: 'custom-stack',
        children: textSnippet('content'),
      },
    });

    const root = container.querySelector('.cinder-stack') as HTMLElement;
    expect(root.classList.contains('custom-stack')).toBe(true);
    expect(root.getAttribute('data-cinder-direction')).toBe('row');
    expect(root.getAttribute('data-cinder-align')).toBe('center');
    expect(root.getAttribute('data-cinder-justify')).toBe('between');
    expect(root.hasAttribute('data-cinder-wrap')).toBe(true);
    expect(root.style.getPropertyValue('--cinder-stack-gap')).toBe('var(--cinder-space-3)');
  });
});
