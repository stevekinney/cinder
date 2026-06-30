/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

// setupHappyDom() MUST run before any `@testing-library/svelte` import.
setupHappyDom();

const { render, cleanup } = await import('@testing-library/svelte');

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

const { createRawSnippet } = await import('svelte');
const { default: PageHeader } = await import('./page-header.svelte');

describe('PageHeader', () => {
  test('renders the required title as h1', () => {
    const { container } = render(PageHeader, { props: { title: 'Approvals' } });
    const titleEl = container.querySelector('.cinder-page-header__title');
    expect(titleEl).not.toBeNull();
    expect(titleEl?.tagName).toBe('H1');
    expect(titleEl?.textContent?.trim()).toBe('Approvals');
  });

  test('renders meta text when provided', () => {
    const { container } = render(PageHeader, {
      props: { title: 'Approvals', meta: '3 pending · 12 resolved' },
    });

    const metaEl = container.querySelector('.cinder-page-header__meta');
    expect(metaEl).not.toBeNull();
    expect(metaEl?.textContent?.trim()).toBe('3 pending · 12 resolved');
  });

  test('does not render meta element when meta is omitted', () => {
    const { container } = render(PageHeader, { props: { title: 'Schedules' } });
    expect(container.querySelector('.cinder-page-header__meta')).toBeNull();
  });

  test('renders trailing actions when children snippet is provided', () => {
    const actionsSnippet = createRawSnippet(() => ({
      render: () => `<button>+ New schedule</button>`,
      setup: () => {},
    }));

    const { container } = render(PageHeader, {
      props: { title: 'Schedules', children: actionsSnippet },
    });

    const actionsEl = container.querySelector('.cinder-page-header__actions');
    expect(actionsEl).not.toBeNull();
    expect(actionsEl?.querySelector('button')?.textContent).toBe('+ New schedule');
  });

  test('does not render actions container when children snippet is omitted', () => {
    const { container } = render(PageHeader, { props: { title: 'Settings' } });
    expect(container.querySelector('.cinder-page-header__actions')).toBeNull();
  });

  test('class prop merges onto root div element', () => {
    const { container } = render(PageHeader, {
      props: { title: 'Memory', class: 'my-page-header' },
    });

    const root = container.querySelector('.cinder-page-header');
    expect(root?.tagName).toBe('DIV');
    expect(root?.classList.contains('cinder-page-header')).toBe(true);
    expect(root?.classList.contains('my-page-header')).toBe(true);
  });

  test('rendering multiple page headers does not create banner landmarks', () => {
    const firstTarget = document.createElement('div');
    const secondTarget = document.createElement('div');
    document.body.append(firstTarget, secondTarget);

    render(PageHeader, {
      target: firstTarget,
      props: { title: 'Approvals' },
    });
    render(PageHeader, {
      target: secondTarget,
      props: { title: 'Schedules' },
    });

    expect(firstTarget.querySelectorAll('.cinder-page-header')).toHaveLength(1);
    expect(secondTarget.querySelectorAll('.cinder-page-header')).toHaveLength(1);
    expect(firstTarget.querySelectorAll('header')).toHaveLength(0);
    expect(secondTarget.querySelectorAll('header')).toHaveLength(0);
  });
});
