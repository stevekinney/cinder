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

  test('minColumnWidth prop drives Grid minItemWidth', () => {
    const { container } = render(GridList, {
      props: { minColumnWidth: '20rem', children: textSnippet('') },
    });
    const list = container.querySelector('ul.cinder-grid-list') as HTMLElement;
    expect(list?.style.getPropertyValue('--cinder-grid-min-item-width')).toBe('20rem');
    expect(list?.style.getPropertyValue('--cinder-grid-columns')).toBe(
      'repeat(auto-fill, minmax(min(var(--cinder-grid-min-item-width), 100%), 1fr))',
    );
    expect(list?.style.getPropertyValue('--cinder-grid-list-min-width')).toBe('');
  });

  test('no minColumnWidth uses the GridList CSS variable through Grid minItemWidth', () => {
    const { container } = render(GridList, {
      props: { children: textSnippet('') },
    });
    const list = container.querySelector('ul.cinder-grid-list') as HTMLElement;
    expect(list?.style.getPropertyValue('--cinder-grid-min-item-width')).toBe(
      'var(--cinder-grid-list-min-width)',
    );
    expect(list?.style.getPropertyValue('--cinder-grid-list-min-width')).toBe('');
  });

  test('empty-string minColumnWidth uses the GridList CSS variable through Grid minItemWidth', () => {
    const { container } = render(GridList, {
      props: { minColumnWidth: '', children: textSnippet('') },
    });
    const list = container.querySelector('ul.cinder-grid-list') as HTMLElement;
    expect(list?.style.getPropertyValue('--cinder-grid-min-item-width')).toBe(
      'var(--cinder-grid-list-min-width)',
    );
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

  test('linked items lift on hover via :has()', async () => {
    const css = await Bun.file(new URL('./grid-list.css', import.meta.url)).text();
    expect(css).toMatch(
      /\.cinder-grid-list__item:has\(\.cinder-grid-list__link:hover\)\s*\{[\s\S]*?box-shadow:\s*var\(--cinder-shadow-md\)/,
    );
    expect(css).toMatch(
      /\.cinder-grid-list__item:has\(\.cinder-grid-list__link:hover\)\s*\{[\s\S]*?border-color:\s*var\(--cinder-border\)/,
    );
  });

  test('sidecar imports composed Grid styles', async () => {
    const css = await Bun.file(new URL('./grid-list.css', import.meta.url)).text();
    expect(css).toContain("@import '../grid/grid.css';");
  });

  test('CSS preserves the public GridList minimum width variable', async () => {
    const css = await Bun.file(new URL('./grid-list.css', import.meta.url)).text();
    expect(css).toMatch(/--cinder-grid-list-min-width:\s*16rem/);
  });

  test('component imports composed Grid through the public subpath', async () => {
    const source = await Bun.file(new URL('./grid-list.svelte', import.meta.url)).text();
    expect(source).toContain("from '@lostgradient/cinder/grid'");
    expect(source).not.toContain("from '../grid/");
  });
});
