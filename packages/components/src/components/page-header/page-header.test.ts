/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import Ajv2020 from 'ajv/dist/2020';

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
const { default: pageHeaderSchema } = await import('./page-header.schema.ts');

describe('PageHeader', () => {
  test('schema requires a string title and supports an optional string description', () => {
    const validate = new Ajv2020({ strict: false }).compile(pageHeaderSchema);

    expect(pageHeaderSchema.required).toEqual(['title']);
    expect(pageHeaderSchema.properties).toMatchObject({
      title: { type: 'string' },
      description: { type: 'string' },
    });
    expect(pageHeaderSchema.metadata?.unsupportedProps?.map((prop) => prop.name)).toEqual([
      'actions',
      'breadcrumbs',
    ]);
    expect(validate({ title: 'Approvals', description: 'Review pending requests.' })).toBe(true);
    expect(validate({})).toBe(false);
  });

  test('renders the required title as h1', () => {
    const { container } = render(PageHeader, { props: { title: 'Approvals' } });
    const titleEl = container.querySelector('.cinder-page-header__title');
    expect(titleEl).not.toBeNull();
    expect(titleEl?.tagName).toBe('H1');
    expect(titleEl?.textContent?.trim()).toBe('Approvals');
  });

  test('renders named title, description, breadcrumb, and action regions', () => {
    const title = createRawSnippet(() => ({
      render: () => `<span>Schedules</span>`,
      setup: () => {},
    }));
    const description = createRawSnippet(() => ({
      render: () => `<span>Manage automated schedules.</span>`,
      setup: () => {},
    }));
    const breadcrumbs = createRawSnippet(() => ({
      render: () => `<nav aria-label="Breadcrumb">Home / Schedules</nav>`,
      setup: () => {},
    }));
    const actions = createRawSnippet(() => ({
      render: () => `<button>New schedule</button>`,
      setup: () => {},
    }));

    const { container } = render(PageHeader, {
      props: { title, description, breadcrumbs, actions },
    });

    expect(container.querySelector('h1')?.textContent).toBe('Schedules');
    expect(container.querySelector('.cinder-page-header__description')?.textContent).toBe(
      'Manage automated schedules.',
    );
    expect(
      container.querySelector('.cinder-page-header__breadcrumbs nav')?.getAttribute('aria-label'),
    ).toBe('Breadcrumb');
    expect(container.querySelector('.cinder-page-header__actions button')?.textContent).toBe(
      'New schedule',
    );
  });

  test('does not render optional named regions when they are omitted', () => {
    const { container } = render(PageHeader, { props: { title: 'Schedules' } });
    expect(container.querySelector('.cinder-page-header__description')).toBeNull();
    expect(container.querySelector('.cinder-page-header__breadcrumbs')).toBeNull();
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
