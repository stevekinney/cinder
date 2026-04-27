/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../test/happy-dom.ts';

// setupHappyDom() MUST run before any `@testing-library/svelte` import. testing-library
// reads `globalThis.document` / `window` at module-init (top-level, not inside test bodies),
// so we register happy-dom's globals first and then dynamic-import testing-library below.
setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { createRawSnippet } = await import('svelte');
const { default: EmptyState } = await import('./empty-state.svelte');

describe('EmptyState rendering', () => {
  test('renders with required title prop', () => {
    const { container } = render(EmptyState, { props: { title: 'No results' } });
    expect(container.querySelector('.cinder-empty-state')).not.toBeNull();
  });

  test('shows title text', () => {
    const { container } = render(EmptyState, { props: { title: 'Nothing here yet' } });
    const heading = container.querySelector('.cinder-empty-state-title');
    expect(heading?.textContent?.trim()).toBe('Nothing here yet');
  });

  test('shows description when provided', () => {
    const { container } = render(EmptyState, {
      props: { title: 'Empty', description: 'Try adding some items.' },
    });
    const description = container.querySelector('.cinder-empty-state-description');
    expect(description).not.toBeNull();
    expect(description?.textContent?.trim()).toBe('Try adding some items.');
  });

  test('does not render description element when description is omitted', () => {
    const { container } = render(EmptyState, { props: { title: 'Empty' } });
    expect(container.querySelector('.cinder-empty-state-description')).toBeNull();
  });

  test('shows icon snippet content when provided', () => {
    const iconSnippet = createRawSnippet(() => ({
      render: () => `<svg data-testid="icon-svg" aria-hidden="true"></svg>`,
    }));

    const { container } = render(EmptyState, {
      props: { title: 'No data', icon: iconSnippet },
    });

    const iconContainer = container.querySelector('.cinder-empty-state-icon');
    expect(iconContainer).not.toBeNull();
    expect(iconContainer?.querySelector('[data-testid="icon-svg"]')).not.toBeNull();
  });

  test('shows action snippet content when provided', () => {
    const actionSnippet = createRawSnippet(() => ({
      render: () => `<button>Add item</button>`,
    }));

    const { container } = render(EmptyState, {
      props: { title: 'Empty', action: actionSnippet },
    });

    const actionContainer = container.querySelector('.cinder-empty-state-action');
    expect(actionContainer).not.toBeNull();
    expect(actionContainer?.querySelector('button')?.textContent).toBe('Add item');
  });

  test('applies class prop to root element', () => {
    const { container } = render(EmptyState, {
      props: { title: 'Empty', class: 'my-custom-class' },
    });
    const root = container.querySelector('.cinder-empty-state');
    expect(root?.classList.contains('my-custom-class')).toBe(true);
    expect(root?.classList.contains('cinder-empty-state')).toBe(true);
  });

  test('no console errors on basic render', () => {
    const originalError = console.error;
    const errors: unknown[] = [];
    console.error = (...args: unknown[]) => {
      errors.push(args);
    };

    render(EmptyState, { props: { title: 'Clean render' } });

    console.error = originalError;
    expect(errors).toHaveLength(0);
  });
});
