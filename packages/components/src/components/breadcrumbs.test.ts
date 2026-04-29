/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../test/happy-dom.ts';

setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { default: Breadcrumbs } = await import('./breadcrumbs.svelte');

const items = [
  { label: 'Home', href: '/' },
  { label: 'Library', href: '/library' },
  { label: 'Data' },
];

describe('Breadcrumbs', () => {
  test('renders a <nav> with default aria-label "Breadcrumb"', () => {
    const { container } = render(Breadcrumbs, { items });
    const nav = container.querySelector('nav');
    expect(nav).not.toBeNull();
    expect(nav?.getAttribute('aria-label')).toBe('Breadcrumb');
  });

  test('renders an ordered list with one item per entry', () => {
    const { container } = render(Breadcrumbs, { items });
    const lis = container.querySelectorAll('ol li');
    expect(lis.length).toBe(3);
  });

  test('the last entry is plain text with aria-current="page"', () => {
    const { container } = render(Breadcrumbs, { items });
    const current = container.querySelector('[aria-current="page"]');
    expect(current).not.toBeNull();
    expect(current?.textContent?.trim()).toBe('Data');
  });

  test('non-final entries render as <a> with href', () => {
    const { container } = render(Breadcrumbs, { items });
    const links = container.querySelectorAll('a');
    expect(links.length).toBe(2);
    expect(links[0]?.getAttribute('href')).toBe('/');
    expect(links[1]?.getAttribute('href')).toBe('/library');
  });

  test('separator defaults to "/"', () => {
    const { container } = render(Breadcrumbs, { items });
    const seps = container.querySelectorAll('.cinder-breadcrumbs__separator');
    expect(seps.length).toBe(2);
    expect(seps[0]?.textContent?.trim()).toBe('/');
  });

  test('custom string separator is applied', () => {
    const { container } = render(Breadcrumbs, { items, separator: '›' });
    const seps = container.querySelectorAll('.cinder-breadcrumbs__separator');
    expect(seps[0]?.textContent?.trim()).toBe('›');
  });

  test('custom label overrides aria-label', () => {
    const { container } = render(Breadcrumbs, { items, label: 'Path' });
    expect(container.querySelector('nav')?.getAttribute('aria-label')).toBe('Path');
  });
});
