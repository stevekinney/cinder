/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../test/happy-dom.ts';

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

  test('href without title renders no anchor', () => {
    const { container } = render(GridListItem, {
      props: { href: '/people/jane' },
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
});
