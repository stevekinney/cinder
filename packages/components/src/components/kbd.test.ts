/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../test/happy-dom.ts';

setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { createRawSnippet } = await import('svelte');
const { default: Kbd } = await import('./kbd.svelte');

function snippet(html: string) {
  return createRawSnippet(() => ({ render: () => html }));
}

describe('Kbd', () => {
  test('renders a <kbd> element', () => {
    const { container } = render(Kbd, { children: snippet('Cmd') });
    expect(container.querySelector('kbd')).not.toBeNull();
  });

  test('applies the cinder-kbd class', () => {
    const { container } = render(Kbd, { children: snippet('K') });
    expect(container.querySelector('.cinder-kbd')).not.toBeNull();
  });

  test('class prop merges with cinder-kbd', () => {
    const { container } = render(Kbd, { class: 'mono', children: snippet('K') });
    const el = container.querySelector('kbd');
    expect(el?.classList.contains('cinder-kbd')).toBe(true);
    expect(el?.classList.contains('mono')).toBe(true);
  });

  test('rest props (e.g. data-testid) are spread onto the element', () => {
    const { container } = render(Kbd, {
      'data-testid': 'shortcut',
      children: snippet('K'),
    });
    expect(container.querySelector('[data-testid="shortcut"]')).not.toBeNull();
  });
});
