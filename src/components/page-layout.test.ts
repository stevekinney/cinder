/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../test/happy-dom.ts';

// setupHappyDom() MUST run before any `@testing-library/svelte` import. testing-library
// reads `globalThis.document` / `window` at module-init (top-level, not inside test bodies),
// so we register happy-dom's globals first and then dynamic-import testing-library below.
setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { createRawSnippet } = await import('svelte');
const { default: PageLayout } = await import('./page-layout.svelte');

describe('PageLayout rendering', () => {
  test('renders with title', () => {
    const { container } = render(PageLayout, {
      props: {
        title: 'Dashboard',
        children: createRawSnippet(() => ({ render: () => '<p>Content</p>' })),
      },
    });
    expect(container.querySelector('.cinder-page-layout')).not.toBeNull();
  });

  test('title text is visible', () => {
    const { container } = render(PageLayout, {
      props: {
        title: 'My Page',
        children: createRawSnippet(() => ({ render: () => '<p>Content</p>' })),
      },
    });
    const heading = container.querySelector('.cinder-page-layout-title');
    expect(heading?.textContent?.trim()).toBe('My Page');
  });

  test('children render', () => {
    const childrenSnippet = createRawSnippet(() => ({
      render: () => '<p data-testid="child-content">Hello world</p>',
    }));

    const { container } = render(PageLayout, {
      props: { title: 'Page', children: childrenSnippet },
    });

    const content = container.querySelector('.cinder-page-layout-content');
    expect(content).not.toBeNull();
    expect(content?.querySelector('[data-testid="child-content"]')).not.toBeNull();
  });

  test('actions snippet renders when provided', () => {
    const actionsSnippet = createRawSnippet(() => ({
      render: () => '<button>Create</button>',
    }));

    const { container } = render(PageLayout, {
      props: {
        title: 'Page',
        children: createRawSnippet(() => ({ render: () => '<p>Content</p>' })),
        actions: actionsSnippet,
      },
    });

    const actionsContainer = container.querySelector('.cinder-page-layout-actions');
    expect(actionsContainer).not.toBeNull();
    expect(actionsContainer?.querySelector('button')?.textContent).toBe('Create');
  });

  test('actions are not rendered when not provided', () => {
    const { container } = render(PageLayout, {
      props: {
        title: 'Page',
        children: createRawSnippet(() => ({ render: () => '<p>Content</p>' })),
      },
    });

    expect(container.querySelector('.cinder-page-layout-actions')).toBeNull();
  });

  test('applies class prop to root element', () => {
    const { container } = render(PageLayout, {
      props: {
        title: 'Page',
        class: 'my-custom-class',
        children: createRawSnippet(() => ({ render: () => '<p>Content</p>' })),
      },
    });

    const root = container.querySelector('.cinder-page-layout');
    expect(root?.classList.contains('my-custom-class')).toBe(true);
    expect(root?.classList.contains('cinder-page-layout')).toBe(true);
  });
});
