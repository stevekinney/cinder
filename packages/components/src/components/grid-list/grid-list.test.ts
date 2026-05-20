/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { default: GridList } = await import('./grid-list.svelte');
const { createRawSnippet } = await import('svelte');

function textSnippet(text: string) {
  return createRawSnippet(() => ({
    render: () => `<span>${text}</span>`,
  }));
}

function liSnippet() {
  return createRawSnippet(() => ({
    render: () => `<li class="probe">item</li>`,
  }));
}

describe('GridList', () => {
  test('renders a <ul> with role="list"', () => {
    const { container } = render(GridList, {
      props: { children: textSnippet('') },
    });
    const list = container.querySelector('ul.cinder-grid-list');
    expect(list).not.toBeNull();
    expect(list?.getAttribute('role')).toBe('list');
  });

  test('consumer-supplied role cannot strip list semantics', () => {
    const { container } = render(GridList, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      props: { children: textSnippet(''), role: 'navigation' } as any,
    });
    const list = container.querySelector('ul.cinder-grid-list');
    expect(list?.getAttribute('role')).toBe('list');
  });

  test('columns prop drives the CSS custom property', () => {
    const { container } = render(GridList, {
      props: { columns: '20rem', children: textSnippet('') },
    });
    const list = container.querySelector('ul.cinder-grid-list') as HTMLElement;
    expect(list?.style.getPropertyValue('--cinder-grid-list-min-width')).toBe('20rem');
  });

  test('no columns → no inline custom property', () => {
    const { container } = render(GridList, {
      props: { children: textSnippet('') },
    });
    const list = container.querySelector('ul.cinder-grid-list') as HTMLElement;
    expect(list?.style.getPropertyValue('--cinder-grid-list-min-width')).toBe('');
  });

  test('empty-string columns is treated as unset', () => {
    const { container } = render(GridList, {
      props: { columns: '', children: textSnippet('') },
    });
    const list = container.querySelector('ul.cinder-grid-list') as HTMLElement;
    expect(list?.style.getPropertyValue('--cinder-grid-list-min-width')).toBe('');
  });

  test('class prop is merged', () => {
    const { container } = render(GridList, {
      props: { class: 'my-custom-class', children: textSnippet('') },
    });
    const list = container.querySelector('ul.cinder-grid-list');
    expect(list?.getAttribute('class')).toContain('cinder-grid-list');
    expect(list?.getAttribute('class')).toContain('my-custom-class');
  });

  test('rest props are forwarded', () => {
    const { container } = render(GridList, {
      props: { 'aria-label': 'Team members', children: textSnippet('') },
    });
    const list = container.querySelector('ul.cinder-grid-list');
    expect(list?.getAttribute('aria-label')).toBe('Team members');
  });

  test('children snippet renders inside the <ul>', () => {
    const { container } = render(GridList, {
      props: { children: liSnippet() },
    });
    const items = container.querySelectorAll('ul.cinder-grid-list li.probe');
    expect(items.length).toBe(1);
  });
});
