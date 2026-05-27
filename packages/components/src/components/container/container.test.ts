/// <reference lib="dom" />
import { beforeEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { render } = await import('@testing-library/svelte');

beforeEach(() => {
  document.body.replaceChildren();
});
const { default: Container } = await import('./container.svelte');
const { createRawSnippet } = await import('svelte');

function textSnippet(text: string) {
  return createRawSnippet(() => ({
    render: () => `<span>${text}</span>`,
  }));
}

describe('Container', () => {
  test('renders a <div> by default with the container class and children', () => {
    const { container } = render(Container, { children: textSnippet('body') });
    const root = container.querySelector('div.cinder-container');

    expect(root).not.toBeNull();
    expect(root?.textContent).toContain('body');
  });

  test('omits the max-width data attribute when maxWidth is not set', () => {
    const { container } = render(Container, { children: textSnippet('body') });
    const root = container.querySelector('.cinder-container');

    expect(root?.hasAttribute('data-cinder-max-width')).toBe(false);
  });

  test.each(['prose', 'narrow', 'wide', 'full'] as const)(
    'reflects maxWidth=%p on the data attribute',
    (maxWidth) => {
      const { container } = render(Container, { maxWidth, children: textSnippet('body') });
      const root = container.querySelector('.cinder-container');

      expect(root?.getAttribute('data-cinder-max-width')).toBe(maxWidth);
    },
  );

  test('emits centered and padded data attributes by default', () => {
    const { container } = render(Container, { children: textSnippet('body') });
    const root = container.querySelector('.cinder-container');

    expect(root?.hasAttribute('data-cinder-centered')).toBe(true);
    expect(root?.hasAttribute('data-cinder-padded')).toBe(true);
  });

  test('omits centered and padded data attributes when disabled', () => {
    const { container } = render(Container, {
      centered: false,
      padded: false,
      children: textSnippet('body'),
    });
    const root = container.querySelector('.cinder-container');

    expect(root?.hasAttribute('data-cinder-centered')).toBe(false);
    expect(root?.hasAttribute('data-cinder-padded')).toBe(false);
  });

  test('honors the `as` prop for the rendered element', () => {
    const { container } = render(Container, { as: 'main', children: textSnippet('body') });

    expect(container.querySelector('main.cinder-container')).not.toBeNull();
    expect(container.querySelector('div.cinder-container')).toBeNull();
  });

  test('merges a consumer-provided class with cinder-container', () => {
    const { container } = render(Container, {
      class: 'extra-class',
      children: textSnippet('body'),
    });
    const root = container.querySelector('.cinder-container');

    expect(root?.classList.contains('cinder-container')).toBe(true);
    expect(root?.classList.contains('extra-class')).toBe(true);
  });

  test('forwards rest props onto the root element', () => {
    const { container } = render(Container, {
      id: 'main-content',
      'aria-label': 'Main content',
      children: textSnippet('body'),
    });
    const root = container.querySelector('.cinder-container');

    expect(root?.getAttribute('id')).toBe('main-content');
    expect(root?.getAttribute('aria-label')).toBe('Main content');
  });
});
