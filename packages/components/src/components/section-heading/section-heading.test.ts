/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

// setupHappyDom() MUST run before any `@testing-library/svelte` import.
setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { createRawSnippet } = await import('svelte');
const { default: SectionHeading } = await import('./section-heading.svelte');

describe('SectionHeading', () => {
  test('renders required title as h2 by default', () => {
    const { container } = render(SectionHeading, { props: { title: 'Section Title' } });
    const titleEl = container.querySelector('.cinder-section-heading__title');
    expect(titleEl).not.toBeNull();
    expect(titleEl?.tagName).toBe('H2');
    expect(titleEl?.textContent?.trim()).toBe('Section Title');
  });

  test('default level is 2 when level prop is omitted', () => {
    const { container } = render(SectionHeading, { props: { title: 'Default Level' } });
    const titleEl = container.querySelector('.cinder-section-heading__title');
    expect(titleEl?.tagName).toBe('H2');
  });

  test('level 2 renders h2 when explicitly provided', () => {
    const { container } = render(SectionHeading, { props: { title: 'Level 2', level: 2 } });
    const titleEl = container.querySelector('.cinder-section-heading__title');
    expect(titleEl?.tagName).toBe('H2');
  });

  test('level 3 renders h3', () => {
    const { container } = render(SectionHeading, { props: { title: 'Level 3', level: 3 } });
    const titleEl = container.querySelector('.cinder-section-heading__title');
    expect(titleEl?.tagName).toBe('H3');
  });

  test('level 4 renders h4', () => {
    const { container } = render(SectionHeading, { props: { title: 'Level 4', level: 4 } });
    const titleEl = container.querySelector('.cinder-section-heading__title');
    expect(titleEl?.tagName).toBe('H4');
  });

  test('renders description when provided', () => {
    const { container } = render(SectionHeading, {
      props: { title: 'Title', description: 'A helpful description.' },
    });
    const descEl = container.querySelector('.cinder-section-heading__description');
    expect(descEl).not.toBeNull();
    expect(descEl?.textContent?.trim()).toBe('A helpful description.');
  });

  test('does not render description element when description is omitted', () => {
    const { container } = render(SectionHeading, { props: { title: 'Title' } });
    expect(container.querySelector('.cinder-section-heading__description')).toBeNull();
  });

  test('hgroup is rendered when label snippet is provided', () => {
    const labelSnippet = createRawSnippet(() => ({
      render: () => `<span>Beta</span>`,
      setup: () => {},
    }));

    const { container } = render(SectionHeading, {
      props: { title: 'Title', label: labelSnippet },
    });

    const hgroup = container.querySelector('hgroup');
    expect(hgroup).not.toBeNull();

    const labelEl = container.querySelector('.cinder-section-heading__label');
    expect(labelEl?.tagName).toBe('P');

    // heading must be a direct child of hgroup
    const titleEl = hgroup?.querySelector('.cinder-section-heading__title');
    expect(titleEl).not.toBeNull();
    expect(titleEl?.parentElement?.tagName).toBe('HGROUP');
  });

  test('hgroup is not rendered when label snippet is omitted', () => {
    const { container } = render(SectionHeading, { props: { title: 'Title' } });
    expect(container.querySelector('hgroup')).toBeNull();
  });

  test('description renders outside hgroup when label and description are both provided', () => {
    const labelSnippet = createRawSnippet(() => ({
      render: () => `<span>Beta</span>`,
      setup: () => {},
    }));

    const { container } = render(SectionHeading, {
      props: { title: 'Title', description: 'Desc text', label: labelSnippet },
    });

    const hgroup = container.querySelector('hgroup');
    expect(hgroup).not.toBeNull();

    const descEl = container.querySelector('.cinder-section-heading__description');
    expect(descEl).not.toBeNull();
    expect(descEl?.textContent?.trim()).toBe('Desc text');

    // description must be outside (not a descendant of) the hgroup
    expect(hgroup?.contains(descEl)).toBe(false);
  });

  test('actions snippet renders inside __actions', () => {
    const actionsSnippet = createRawSnippet(() => ({
      render: () => `<button>Edit</button>`,
      setup: () => {},
    }));

    const { container } = render(SectionHeading, {
      props: { title: 'Title', actions: actionsSnippet },
    });

    const actionsEl = container.querySelector('.cinder-section-heading__actions');
    expect(actionsEl).not.toBeNull();
    expect(actionsEl?.querySelector('button')?.textContent).toBe('Edit');
  });

  test('tabs snippet renders inside __tabs', () => {
    const tabsSnippet = createRawSnippet(() => ({
      render: () => `<div role="tablist"><button role="tab">Tab 1</button></div>`,
      setup: () => {},
    }));

    const { container } = render(SectionHeading, {
      props: { title: 'Title', tabs: tabsSnippet },
    });

    const tabsEl = container.querySelector('.cinder-section-heading__tabs');
    expect(tabsEl).not.toBeNull();
    expect(tabsEl?.querySelector('[role="tablist"]')).not.toBeNull();
  });

  test('tabs-only: __tabs is always below __row (never inline)', () => {
    const tabsSnippet = createRawSnippet(() => ({
      render: () => `<div role="tablist"><button role="tab">Tab 1</button></div>`,
      setup: () => {},
    }));

    const { container } = render(SectionHeading, {
      props: { title: 'Title', tabs: tabsSnippet },
    });

    const header = container.querySelector('header');
    const row = header?.querySelector('.cinder-section-heading__row');
    const tabsEl = header?.querySelector('.cinder-section-heading__tabs');

    expect(row?.nextElementSibling).toBe(tabsEl);
  });

  test('variant attribute is set to actions-and-tabs when both are present', () => {
    const actionsSnippet = createRawSnippet(() => ({
      render: () => `<button>Edit</button>`,
      setup: () => {},
    }));
    const tabsSnippet = createRawSnippet(() => ({
      render: () => `<div role="tablist"></div>`,
      setup: () => {},
    }));

    const { container } = render(SectionHeading, {
      props: { title: 'Title', actions: actionsSnippet, tabs: tabsSnippet },
    });

    const header = container.querySelector('header');
    expect(header?.getAttribute('data-cinder-variant')).toBe('actions-and-tabs');

    const row = header?.querySelector('.cinder-section-heading__row');
    const tabsEl = header?.querySelector('.cinder-section-heading__tabs');
    expect(row?.nextElementSibling).toBe(tabsEl);
  });

  test('variant attribute is absent when only actions is present', () => {
    const actionsSnippet = createRawSnippet(() => ({
      render: () => `<button>Edit</button>`,
      setup: () => {},
    }));

    const { container } = render(SectionHeading, {
      props: { title: 'Title', actions: actionsSnippet },
    });

    const header = container.querySelector('header');
    expect(header?.getAttribute('data-cinder-variant')).toBeNull();
  });

  test('variant attribute is absent when only tabs is present', () => {
    const tabsSnippet = createRawSnippet(() => ({
      render: () => `<div role="tablist"></div>`,
      setup: () => {},
    }));

    const { container } = render(SectionHeading, {
      props: { title: 'Title', tabs: tabsSnippet },
    });

    const header = container.querySelector('header');
    expect(header?.getAttribute('data-cinder-variant')).toBeNull();
  });

  test('only one header landmark is rendered regardless of variant', () => {
    const actionsSnippet = createRawSnippet(() => ({
      render: () => `<button>Edit</button>`,
      setup: () => {},
    }));
    const tabsSnippet = createRawSnippet(() => ({
      render: () => `<div role="tablist"></div>`,
      setup: () => {},
    }));

    const { container } = render(SectionHeading, {
      props: { title: 'Title', actions: actionsSnippet, tabs: tabsSnippet },
    });

    expect(container.querySelectorAll('header').length).toBe(1);
  });

  test('class prop merges onto root element', () => {
    const { container } = render(SectionHeading, {
      props: { title: 'Title', class: 'my-custom' },
    });

    const root = container.querySelector('.cinder-section-heading');
    expect(root?.classList.contains('my-custom')).toBe(true);
    expect(root?.classList.contains('cinder-section-heading')).toBe(true);
  });
});
