/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { default: DescriptionList } = await import('./description-list.svelte');
const { createRawSnippet } = await import('svelte');

type Item = { id?: string; term: string; definition: string };

function actionSnippet(transform: (item: Item) => string) {
  // createRawSnippet receives getter functions at runtime even though
  // the TypeScript types model them as plain values.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createRawSnippet<[Item]>((getItem: any) => ({
    render: () => transform(getItem()),
  }));
}

const sampleItems: Item[] = [
  { term: 'Status', definition: 'Active' },
  { term: 'Owner', definition: 'Steve' },
];

describe('DescriptionList', () => {
  test('default variant renders <dl> with rows containing <dt> and <dd>', () => {
    const { container } = render(DescriptionList, { items: sampleItems });
    const dl = container.querySelector('.cinder-description-list');
    expect(dl).not.toBeNull();
    expect(dl?.tagName).toBe('DL');
    expect(dl?.getAttribute('data-cinder-variant')).toBe('default');

    const rows = dl?.querySelectorAll('.cinder-description-list__row');
    expect(rows?.length).toBe(2);

    const firstRow = rows?.[0];
    expect(firstRow?.querySelector('dt')?.textContent).toBe('Status');
    expect(firstRow?.querySelector('dd')?.textContent).toContain('Active');

    const secondRow = rows?.[1];
    expect(secondRow?.querySelector('dt')?.textContent).toBe('Owner');
    expect(secondRow?.querySelector('dd')?.textContent).toContain('Steve');
  });

  test('striped variant sets data-cinder-variant="striped"', () => {
    const { container } = render(DescriptionList, { items: sampleItems, variant: 'striped' });
    const dl = container.querySelector('.cinder-description-list');
    expect(dl?.getAttribute('data-cinder-variant')).toBe('striped');
  });

  test('two-column variant sets data-cinder-variant and preserves DOM order (dt then dd)', () => {
    const { container } = render(DescriptionList, { items: sampleItems, variant: 'two-column' });
    const dl = container.querySelector('.cinder-description-list');
    expect(dl?.getAttribute('data-cinder-variant')).toBe('two-column');

    const rows = dl?.querySelectorAll('.cinder-description-list__row');
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const firstRow = rows![0]!;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(firstRow.children[0]!.tagName).toBe('DT');
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(firstRow.children[1]!.tagName).toBe('DD');
  });

  test('narrow variant renders <dt> with cinder-sr-only class and keeps text in DOM', () => {
    const { container } = render(DescriptionList, { items: sampleItems, variant: 'narrow' });
    const dl = container.querySelector('.cinder-description-list');
    expect(dl?.getAttribute('data-cinder-variant')).toBe('narrow');

    const dts = dl?.querySelectorAll('dt');
    expect(dts?.length).toBe(2);

    const firstDt = dts?.[0];
    expect(firstDt?.classList.contains('cinder-sr-only')).toBe(true);
    expect(firstDt?.textContent).toBe('Status');

    const firstDd = dl?.querySelector('dd');
    expect(firstDd?.classList.contains('cinder-sr-only')).toBe(false);
  });

  test('actions snippet renders inside <dd> wrapped in .cinder-description-list__actions', () => {
    const actions = actionSnippet((item) => `<a aria-label="Edit ${item.term}">Edit</a>`);
    const { container } = render(DescriptionList, { items: sampleItems, actions });

    const actionsWrappers = container.querySelectorAll('.cinder-description-list__actions');
    expect(actionsWrappers.length).toBe(2);

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const firstActions = actionsWrappers[0]!;
    expect(firstActions.parentElement?.tagName).toBe('DD');
    expect(firstActions.querySelector('[aria-label="Edit Status"]')).not.toBeNull();

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const secondActions = actionsWrappers[1]!;
    expect(secondActions.querySelector('[aria-label="Edit Owner"]')).not.toBeNull();
  });

  test('class prop is composed onto the root <dl>', () => {
    const { container } = render(DescriptionList, {
      items: sampleItems,
      class: 'my-custom-class',
    });
    const dl = container.querySelector('.cinder-description-list');
    expect(dl?.getAttribute('class')).toContain('cinder-description-list');
    expect(dl?.getAttribute('class')).toContain('my-custom-class');
  });

  test('rest props spread onto the <dl> root', () => {
    const { container } = render(DescriptionList, {
      items: sampleItems,
      id: 'user-info',
      'aria-labelledby': 'user-heading',
    } as Parameters<typeof render>[1]);
    const dl = container.querySelector('.cinder-description-list');
    expect(dl?.getAttribute('id')).toBe('user-info');
    expect(dl?.getAttribute('aria-labelledby')).toBe('user-heading');
  });

  test('rest props cannot clobber managed class attribute', () => {
    const { container } = render(DescriptionList, {
      items: sampleItems,
      class: 'rogue',
    });
    const dl = container.querySelector('.cinder-description-list');
    expect(dl?.getAttribute('class')).toContain('cinder-description-list');
    expect(dl?.getAttribute('class')).toContain('rogue');
  });

  test('empty items renders an empty <dl> with no rows', () => {
    const { container } = render(DescriptionList, { items: [] });
    const dl = container.querySelector('.cinder-description-list');
    expect(dl).not.toBeNull();
    const rows = dl?.querySelectorAll('.cinder-description-list__row');
    expect(rows?.length).toBe(0);
  });

  test('keying with explicit id renders both rows when terms are duplicate', () => {
    const items: Item[] = [
      { id: 'email-work', term: 'Email', definition: 'work@example.com' },
      { id: 'email-personal', term: 'Email', definition: 'personal@example.com' },
    ];
    const { container } = render(DescriptionList, { items });
    const rows = container.querySelectorAll('.cinder-description-list__row');
    expect(rows.length).toBe(2);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(rows[0]!.textContent).toContain('work@example.com');
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(rows[1]!.textContent).toContain('personal@example.com');
  });

  test('keying falls back to term when id is omitted', () => {
    const items: Item[] = [
      { term: 'Alpha', definition: 'first' },
      { term: 'Beta', definition: 'second' },
    ];
    const { container } = render(DescriptionList, { items });
    const rows = container.querySelectorAll('.cinder-description-list__row');
    expect(rows.length).toBe(2);
  });

  test('default <dd> margin reset is present in the stylesheet', async () => {
    const css = await Bun.file(`${import.meta.dir}/description-list.css`).text();
    expect(css).toMatch(/\.cinder-description-list[^{]*dd[^{]*\{[^}]*margin:\s*0/);
  });

  test('default variant row dividers are scoped away from striped rows', async () => {
    const css = await Bun.file(`${import.meta.dir}/description-list.css`).text();
    expect(css).toMatch(
      /\.cinder-description-list\[data-cinder-variant='default'\][\s\S]*?\.cinder-description-list__row:not\(:first-child\)[\s\S]*?border-block-start:\s*1px solid var\(--cinder-border-muted\)/,
    );
    expect(css).not.toMatch(
      /\.cinder-description-list\[data-cinder-variant='striped'\][\s\S]*?border-block-start/,
    );
  });

  test('two-column layout uses subgrid progressively and collapses by container width', async () => {
    const css = await Bun.file(`${import.meta.dir}/description-list.css`).text();

    expect(css).toContain('@supports (grid-template-columns: subgrid)');
    expect(css).toContain('grid-template-columns: subgrid;');
    expect(css).toContain('@container (max-width: 28rem)');
    expect(css).toMatch(/@container \(max-width: 28rem\)[\s\S]*?grid-template-columns:\s*1fr;/);
  });

  test('<dl> content model: only row divs as direct children, each with exactly dt then dd', () => {
    const { container } = render(DescriptionList, { items: sampleItems });
    const dl = container.querySelector('.cinder-description-list')!;

    for (const child of Array.from(dl.children)) {
      expect(child.tagName).toBe('DIV');
      expect(child.classList.contains('cinder-description-list__row')).toBe(true);
      expect(child.children.length).toBe(2);
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      expect(child.children[0]!.tagName).toBe('DT');
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      expect(child.children[1]!.tagName).toBe('DD');
    }
  });

  test('<dd> content model: definition div first, at most one actions div, in order', () => {
    const actions = actionSnippet((item) => `<button>Edit ${item.term}</button>`);
    const { container } = render(DescriptionList, { items: sampleItems, actions });
    const dds = container.querySelectorAll('dd');

    for (const dd of Array.from(dds)) {
      const children = Array.from(dd.children);
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      expect(children[0]!.classList.contains('cinder-description-list__definition')).toBe(true);
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      expect(children[1]!.classList.contains('cinder-description-list__actions')).toBe(true);
      expect(children.length).toBe(2);
    }
  });

  test('<dd> without actions contains only the definition div', () => {
    const { container } = render(DescriptionList, { items: sampleItems });
    const dds = container.querySelectorAll('dd');

    for (const dd of Array.from(dds)) {
      const children = Array.from(dd.children);
      expect(children.length).toBe(1);
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      expect(children[0]!.classList.contains('cinder-description-list__definition')).toBe(true);
    }
  });
});
