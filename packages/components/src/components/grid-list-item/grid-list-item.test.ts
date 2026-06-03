/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { default: GridListItem } = await import('./grid-list-item.svelte');
const { createRawSnippet } = await import('svelte');

function textSnippet(text: string) {
  return createRawSnippet(() => ({
    render: () => `<span>${text}</span>`,
  }));
}

function rawSnippet(html: string) {
  return createRawSnippet(() => ({
    render: () => html,
  }));
}

describe('GridListItem', () => {
  test('renders an <li> with class cinder-grid-list__item', () => {
    const { container } = render(GridListItem, { props: {} });
    const item = container.querySelector('li.cinder-grid-list__item');
    expect(item).not.toBeNull();
  });

  test('all five snippets render in DOM order', () => {
    const { container } = render(GridListItem, {
      props: {
        image: textSnippet('IMG'),
        title: textSnippet('TITLE'),
        subtitle: textSnippet('SUBTITLE'),
        meta: textSnippet('META'),
        actions: textSnippet('ACTIONS'),
      },
    });
    const li = container.querySelector('li.cinder-grid-list__item') as HTMLElement;
    const text = li.textContent ?? '';
    expect(text.indexOf('IMG')).toBeLessThan(text.indexOf('TITLE'));
    expect(text.indexOf('TITLE')).toBeLessThan(text.indexOf('SUBTITLE'));
    expect(text.indexOf('SUBTITLE')).toBeLessThan(text.indexOf('META'));
    expect(text.indexOf('META')).toBeLessThan(text.indexOf('ACTIONS'));

    expect(li.querySelector('.cinder-grid-list__image')).not.toBeNull();
    expect(li.querySelector('.cinder-grid-list__title')).not.toBeNull();
    expect(li.querySelector('.cinder-grid-list__subtitle')).not.toBeNull();
    expect(li.querySelector('.cinder-grid-list__meta')).not.toBeNull();
    expect(li.querySelector('.cinder-grid-list__actions')).not.toBeNull();
  });

  test('href + title produces a stretched-link anchor wrapping the title', () => {
    const { container } = render(GridListItem, {
      props: {
        href: '/people/jane',
        title: textSnippet('Jane'),
      },
    });
    const anchor = container.querySelector('.cinder-grid-list__title a.cinder-grid-list__link');
    expect(anchor).not.toBeNull();
    expect(anchor?.getAttribute('href')).toMatch(/\/people\/jane$/);
    expect(anchor?.textContent).toContain('Jane');
  });

  test('no href → no anchor, title still renders', () => {
    const { container } = render(GridListItem, {
      props: { title: textSnippet('Jane') },
    });
    expect(container.querySelector('a.cinder-grid-list__link')).toBeNull();
    expect(container.querySelector('.cinder-grid-list__title')?.textContent).toContain('Jane');
  });

  test('href without title renders no anchor (runtime defensive guard)', () => {
    // The type system now rejects href without title at compile time.
    // This test exercises the runtime defensive behavior for JS callers that
    // bypass TypeScript — the component must not render an inaccessible anchor.
    const { container } = render(GridListItem, {
      props: {
        href: '/people/jane',
      } as unknown as import('./grid-list-item.types.ts').GridListItemProps,
    });
    expect(container.querySelector('a.cinder-grid-list__link')).toBeNull();
  });

  test('renders actions in the documented wrapper', () => {
    const { container } = render(GridListItem, {
      props: {
        href: '/people/jane',
        title: textSnippet('Jane'),
        actions: rawSnippet('<button data-testid="probe">Edit</button>'),
      },
    });
    const button = container.querySelector('[data-testid="probe"]');
    expect(button).not.toBeNull();
    expect(button?.closest('.cinder-grid-list__actions')).not.toBeNull();
  });

  test('target and rel forwarded to the anchor', () => {
    const { container } = render(GridListItem, {
      props: {
        href: '/people/jane',
        title: textSnippet('Jane'),
        target: '_self',
        rel: 'external',
      },
    });
    const anchor = container.querySelector('a.cinder-grid-list__link');
    expect(anchor?.getAttribute('target')).toBe('_self');
    expect(anchor?.getAttribute('rel')).toContain('external');
  });

  test('target="_blank" auto-composes rel="noopener noreferrer"', () => {
    const { container } = render(GridListItem, {
      props: {
        href: '/people/jane',
        title: textSnippet('Jane'),
        target: '_blank',
      },
    });
    const anchor = container.querySelector('a.cinder-grid-list__link');
    const relTokens = (anchor?.getAttribute('rel') ?? '').split(/\s+/);
    expect(relTokens).toContain('noopener');
    expect(relTokens).toContain('noreferrer');
  });

  test('target="_blank" preserves consumer-supplied rel tokens', () => {
    const { container } = render(GridListItem, {
      props: {
        href: '/people/jane',
        title: textSnippet('Jane'),
        target: '_blank',
        rel: 'external',
      },
    });
    const anchor = container.querySelector('a.cinder-grid-list__link');
    const relTokens = (anchor?.getAttribute('rel') ?? '').split(/\s+/);
    expect(relTokens).toContain('external');
    expect(relTokens).toContain('noopener');
    expect(relTokens).toContain('noreferrer');
    // no duplicates
    expect(new Set(relTokens).size).toBe(relTokens.length);
  });

  test('target is normalized case-insensitively for _blank safety', () => {
    const { container } = render(GridListItem, {
      props: {
        href: '/people/jane',
        title: textSnippet('Jane'),
        target: '_Blank',
      },
    });
    const anchor = container.querySelector('a.cinder-grid-list__link');
    const relTokens = (anchor?.getAttribute('rel') ?? '').split(/\s+/);
    expect(relTokens).toContain('noopener');
    expect(relTokens).toContain('noreferrer');
  });

  test('escape attribute renders inside a non-actions wrapper', () => {
    const { container } = render(GridListItem, {
      props: {
        href: '/people/jane',
        title: textSnippet('Jane'),
        meta: rawSnippet('<a href="/x" data-cinder-stretched-link-escape>profile</a>'),
      },
    });
    const escapee = container.querySelector('[data-cinder-stretched-link-escape]');
    expect(escapee).not.toBeNull();
    expect(escapee?.closest('.cinder-grid-list__meta')).not.toBeNull();
  });

  test('class prop is merged', () => {
    const { container } = render(GridListItem, {
      props: { class: 'my-custom-class' },
    });
    const li = container.querySelector('li');
    expect(li?.getAttribute('class')).toContain('cinder-grid-list__item');
    expect(li?.getAttribute('class')).toContain('my-custom-class');
  });

  test('optional snippet wrappers are absent when snippets not provided', () => {
    const { container } = render(GridListItem, { props: {} });
    const li = container.querySelector('li.cinder-grid-list__item') as HTMLElement;
    expect(li.querySelector('.cinder-grid-list__image')).toBeNull();
    expect(li.querySelector('.cinder-grid-list__title')).toBeNull();
    expect(li.querySelector('.cinder-grid-list__subtitle')).toBeNull();
    expect(li.querySelector('.cinder-grid-list__meta')).toBeNull();
    expect(li.querySelector('.cinder-grid-list__actions')).toBeNull();
  });

  test('non-_blank target does not inject security tokens', () => {
    const { container } = render(GridListItem, {
      props: {
        href: '/people/jane',
        title: textSnippet('Jane'),
        target: '_self',
        rel: 'external',
      },
    });
    const anchor = container.querySelector('a.cinder-grid-list__link');
    const relTokens = (anchor?.getAttribute('rel') ?? '').split(/\s+/);
    expect(relTokens).not.toContain('noopener');
    expect(relTokens).not.toContain('noreferrer');
  });

  // ── Type-level regression tests ────────────────────────────────────────────
  // These blocks assert compile-time rejections for the two high-severity
  // defects: (1) href without title must be a type error in GridListItemLinked,
  // and (2) onclick/role/tabindex must not be accepted by GridListItemBase.

  test('type: GridListItemLinked requires title when href is set', () => {
    // href without title must not satisfy GridListItemProps.
    // GridListItemLinked requires title: Snippet; GridListItemStatic forbids href.
    // @ts-expect-error href without title must be a type error — GridListItemLinked requires title: Snippet
    const _missingTitle: import('./grid-list-item.types.ts').GridListItemProps = {
      href: '/people/jane',
    };
    void _missingTitle;
    expect(true).toBe(true);
  });

  test('type: onclick is not accepted on GridListItemProps', () => {
    const _withOnClick: import('./grid-list-item.types.ts').GridListItemProps = {
      // @ts-expect-error onclick is stripped from GridListItemBase — must be a type error
      onclick: () => {},
    };
    void _withOnClick;
    expect(true).toBe(true);
  });

  test('type: role is not accepted on GridListItemProps', () => {
    const _withRole: import('./grid-list-item.types.ts').GridListItemProps = {
      // @ts-expect-error role is stripped from GridListItemBase — must be a type error
      role: 'button',
    };
    void _withRole;
    expect(true).toBe(true);
  });

  test('type: tabindex is not accepted on GridListItemProps', () => {
    const _withTabIndex: import('./grid-list-item.types.ts').GridListItemProps = {
      // @ts-expect-error tabindex is stripped from GridListItemBase — must be a type error
      tabindex: 0,
    };
    void _withTabIndex;
    expect(true).toBe(true);
  });
});
