/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { default: DataList } = await import('./data-list.svelte');
const { default: DataListDensityFixture } =
  await import('../../test/fixtures/data-list-density-fixture.svelte');
const { createRawSnippet } = await import('svelte');

function textSnippet(text: string) {
  return createRawSnippet(() => ({
    render: () => `<span>${text}</span>`,
  }));
}

function itemSnippet(transform: (item: unknown) => string) {
  // createRawSnippet receives getter functions at runtime even though
  // the TypeScript types model them as plain values. Each row renders an
  // <li> — DataList's root is a <ul>, so the child contract is "render an <li>".
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createRawSnippet<[unknown]>((getItem: any) => ({
    render: () => `<li>${transform(getItem())}</li>`,
  }));
}

describe('DataList', () => {
  test('renders a <ul role="list"> container', () => {
    const { container } = render(DataList, {
      items: ['a'],
      children: itemSnippet((item) => String(item)),
    });
    const list = container.querySelector('.cinder-data-list');
    expect(list).not.toBeNull();
    expect(list?.tagName).toBe('UL');
    // role="list" is restated because list-style:none drops list semantics in Safari.
    expect(list?.getAttribute('role')).toBe('list');
  });

  test('renders items via children snippet', () => {
    const items = ['alpha', 'beta', 'gamma'];
    const { container } = render(DataList, {
      items,
      children: itemSnippet((item) => String(item)),
    });
    const list = container.querySelector('.cinder-data-list');
    expect(list).not.toBeNull();
    expect(list?.querySelectorAll('li')).toHaveLength(3);
    expect(list?.textContent).toContain('alpha');
    expect(list?.textContent).toContain('beta');
    expect(list?.textContent).toContain('gamma');
  });

  test('wraps the empty snippet in an <li class="cinder-data-list-empty"> when items is []', () => {
    const { container } = render(DataList, {
      items: [],
      children: itemSnippet((item) => String(item)),
      empty: textSnippet('Nothing here'),
    });
    const list = container.querySelector('.cinder-data-list');
    expect(list).not.toBeNull();
    const emptyItem = list?.querySelector('li.cinder-data-list-empty');
    expect(emptyItem).not.toBeNull();
    expect(emptyItem?.textContent).toContain('Nothing here');
    // The empty state is the only <li> — keeps the <ul> valid HTML.
    expect(list?.querySelectorAll('li')).toHaveLength(1);
  });

  test('does not render the empty snippet when items is non-empty', () => {
    const { container } = render(DataList, {
      items: ['one'],
      children: itemSnippet((item) => String(item)),
      empty: textSnippet('Nothing here'),
    });
    const list = container.querySelector('.cinder-data-list');
    expect(list).not.toBeNull();
    expect(list?.textContent).toContain('one');
    expect(list?.textContent).not.toContain('Nothing here');
    expect(list?.querySelector('.cinder-data-list-empty')).toBeNull();
  });

  test('applies class prop', () => {
    const { container } = render(DataList, {
      items: [],
      children: itemSnippet((item) => String(item)),
      class: 'my-custom-class',
    });
    const list = container.querySelector('.cinder-data-list');
    expect(list).not.toBeNull();
    expect(list?.getAttribute('class')).toContain('cinder-data-list');
    expect(list?.getAttribute('class')).toContain('my-custom-class');
  });

  test('forwards rest attributes (aria-label) onto the <ul> without overriding role', () => {
    const { container } = render(DataList, {
      items: ['one'],
      children: itemSnippet((item) => String(item)),
      'aria-label': 'Team members',
    });
    const list = container.querySelector('.cinder-data-list');
    expect(list).not.toBeNull();
    expect(list?.getAttribute('aria-label')).toBe('Team members');
    // The component-enforced role wins over any forwarded role.
    expect(list?.getAttribute('role')).toBe('list');
  });
});

describe('DataList density context', () => {
  // The fixture renders a DataList around StackedListItem rows so we can assert
  // that the list-level density flows into each row via context, and that a
  // per-row density prop overrides it.
  test('propagates list-level density to rows that set no density prop', () => {
    const { container } = render(DataListDensityFixture, { density: 'condensed' });
    const rows = container.querySelectorAll('.cinder-stacked-list-item');
    expect(rows.length).toBeGreaterThan(0);
    // The first two rows set no density prop, so they inherit the list default.
    expect(rows[0]?.getAttribute('data-cinder-density')).toBe('condensed');
    expect(rows[1]?.getAttribute('data-cinder-density')).toBe('condensed');
  });

  test('a per-row density prop overrides the list-level density', () => {
    const { container } = render(DataListDensityFixture, { density: 'condensed' });
    const rows = container.querySelectorAll('.cinder-stacked-list-item');
    // The third row sets density="comfortable" explicitly.
    expect(rows[2]?.getAttribute('data-cinder-density')).toBe('comfortable');
  });

  test('rows fall back to comfortable when the list sets no density', () => {
    const { container } = render(DataListDensityFixture, {});
    const rows = container.querySelectorAll('.cinder-stacked-list-item');
    // No list density and no per-row prop on rows 0/1 → row default comfortable.
    expect(rows[0]?.getAttribute('data-cinder-density')).toBe('comfortable');
  });
});
