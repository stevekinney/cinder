/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';
import type { DataListProps } from './data-list.types.ts';

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

// Key extractor for string items used in tests. Typed as `unknown` to match
// how svelte-check infers T=unknown for generic components in render() calls.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const stringKey = (item: any): string => String(item);

describe('DataList', () => {
  test('renders a <ul role="list"> container', () => {
    const { container } = render(DataList, {
      items: ['a'],
      key: stringKey,
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
      key: stringKey,
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
      key: stringKey,
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
      key: stringKey,
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
      key: stringKey,
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
      key: stringKey,
      children: itemSnippet((item) => String(item)),
      'aria-label': 'Team members',
    });
    const list = container.querySelector('.cinder-data-list');
    expect(list).not.toBeNull();
    expect(list?.getAttribute('aria-label')).toBe('Team members');
    // The component-enforced role wins over any forwarded role.
    expect(list?.getAttribute('role')).toBe('list');
  });

  test('key prop is required — omitting it is a compile error (type-level)', () => {
    // Type-level regression: a DataList props object that supplies items +
    // children but OMITS `key` must NOT be assignable to DataListProps. The
    // children value is correctly typed, so the sole type error is the missing
    // required `key` — caught by the `@ts-expect-error`. If `key` is ever made
    // optional again, the directive becomes unused and tsc/svelte-check fail.
    const children = itemSnippet((item) => String(item)) as DataListProps<string>['children'];
    // @ts-expect-error `key` is a required prop; omitting it must not type-check
    const _propsWithoutKey: DataListProps<string> = { items: ['a', 'b'], children };
    expect(_propsWithoutKey).toBeDefined();
  });

  test('keyed reconciliation follows item identity across a reorder', () => {
    // Proves the keyed {#each} associates DOM with the item, not the index:
    // after reordering, the row for a given id keeps its identity. With the old
    // index-based fallback this would re-associate by position instead.
    const itemsA = [
      { id: 'x1', label: 'First' },
      { id: 'x2', label: 'Second' },
    ];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const idKey = (item: any): string => String(item?.id ?? item);
    const { container, rerender } = render(DataList, {
      items: itemsA,
      key: idKey,
      children: itemSnippet((item) => String((item as { id: string; label: string }).label)),
    });
    let listItems = container.querySelectorAll('.cinder-data-list li');
    expect(listItems).toHaveLength(2);
    expect(listItems[0]?.textContent).toContain('First');
    expect(listItems[1]?.textContent).toContain('Second');

    // Reorder and assert the rendered order tracks the items.
    //
    // NOTE: this asserts rendered ORDER, not DOM-node identity. A true
    // keyed-vs-unkeyed distinction needs node-reuse identity, but happy-dom does
    // not preserve node identity through Svelte's keyed-each reconciliation (it
    // recreates nodes), so that assertion is not reliable in this harness. The
    // load-bearing guard against "key was removed / made optional" is the
    // compile-time `@ts-expect-error` test above — that regression cannot reach
    // runtime, so this test stays an order/behavior check.
    rerender({
      items: [itemsA[1]!, itemsA[0]!],
      key: idKey,
      children: itemSnippet((item) => String((item as { id: string; label: string }).label)),
    });
    listItems = container.querySelectorAll('.cinder-data-list li');
    expect(listItems).toHaveLength(2);
    expect(listItems[0]?.textContent).toContain('Second');
    expect(listItems[1]?.textContent).toContain('First');
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
