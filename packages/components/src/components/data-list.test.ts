/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../test/happy-dom.ts';

setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { default: DataList } = await import('./data-list.svelte');
const { createRawSnippet } = await import('svelte');

function textSnippet(text: string) {
  return createRawSnippet(() => ({
    render: () => `<span>${text}</span>`,
  }));
}

function itemSnippet(transform: (item: unknown) => string) {
  // createRawSnippet receives getter functions at runtime even though
  // the TypeScript types model them as plain values.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createRawSnippet<[unknown]>((getItem: any) => ({
    render: () => `<li>${transform(getItem())}</li>`,
  }));
}

describe('DataList', () => {
  test('renders items via children snippet', () => {
    const items = ['alpha', 'beta', 'gamma'];
    const { container } = render(DataList, {
      items,
      children: itemSnippet((item) => String(item)),
    });
    const list = container.querySelector('.cinder-data-list');
    expect(list).not.toBeNull();
    expect(list?.textContent).toContain('alpha');
    expect(list?.textContent).toContain('beta');
    expect(list?.textContent).toContain('gamma');
  });

  test('shows empty snippet when items is []', () => {
    const { container } = render(DataList, {
      items: [],
      children: itemSnippet((item) => String(item)),
      empty: textSnippet('Nothing here'),
    });
    const list = container.querySelector('.cinder-data-list');
    expect(list?.textContent).toContain('Nothing here');
  });

  test('does not render empty snippet when items is non-empty', () => {
    const { container } = render(DataList, {
      items: ['one'],
      children: itemSnippet((item) => String(item)),
      empty: textSnippet('Nothing here'),
    });
    const list = container.querySelector('.cinder-data-list');
    expect(list?.textContent).toContain('one');
    expect(list?.textContent).not.toContain('Nothing here');
  });

  test('applies class prop', () => {
    const { container } = render(DataList, {
      items: [],
      children: itemSnippet((item) => String(item)),
      class: 'my-custom-class',
    });
    const list = container.querySelector('.cinder-data-list');
    expect(list?.getAttribute('class')).toContain('cinder-data-list');
    expect(list?.getAttribute('class')).toContain('my-custom-class');
  });
});
