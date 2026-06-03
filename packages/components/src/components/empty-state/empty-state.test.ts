/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

// setupHappyDom() MUST run before any `@testing-library/svelte` import. testing-library
// reads `globalThis.document` / `window` at module-init (top-level, not inside test bodies),
// so we register happy-dom's globals first and then dynamic-import testing-library below.
setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { createRawSnippet } = await import('svelte');
const { default: EmptyState } = await import('./empty-state.svelte');

const emptyStateCss = await Bun.file(new URL('./empty-state.css', import.meta.url)).text();

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

  test('defaults the title to an h3', () => {
    const { container } = render(EmptyState, { props: { title: 'Default level' } });
    const heading = container.querySelector('.cinder-empty-state-title');
    expect(heading?.tagName).toBe('H3');
  });

  test('headingLevel overrides the title tag', () => {
    const { container } = render(EmptyState, {
      props: { title: 'Custom level', headingLevel: 2 },
    });
    const heading = container.querySelector('.cinder-empty-state-title');
    expect(heading?.tagName).toBe('H2');
    expect(heading?.textContent?.trim()).toBe('Custom level');
  });

  test('clamps an out-of-range headingLevel back to a valid tag', () => {
    const { container } = render(EmptyState, {
      // 7 is outside the union but reachable at runtime; should clamp to h6.
      props: { title: 'Clamped', headingLevel: 7 as never },
    });
    expect(container.querySelector('.cinder-empty-state-title')?.tagName).toBe('H6');
  });

  test('clamps headingLevel=0 up to h1', () => {
    const { container } = render(EmptyState, {
      props: { title: 'Clamped', headingLevel: 0 as never },
    });
    expect(container.querySelector('.cinder-empty-state-title')?.tagName).toBe('H1');
  });

  test('falls back to h3 for a non-numeric headingLevel', () => {
    const { container } = render(EmptyState, {
      props: { title: 'Clamped', headingLevel: NaN as never },
    });
    expect(container.querySelector('.cinder-empty-state-title')?.tagName).toBe('H3');
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
    try {
      render(EmptyState, { props: { title: 'Clean render' } });
      expect(errors).toHaveLength(0);
    } finally {
      console.error = originalError;
    }
  });

  test('icon uses subtle text rather than disabled text', () => {
    const iconRule = emptyStateCss.match(/\.cinder-empty-state-icon\s*\{[^}]*\}/)?.[0];

    expect(iconRule).toContain('color: var(--cinder-text-subtle);');
    expect(iconRule).not.toContain('var(--cinder-text-disabled)');
  });
});

describe('EmptyState native attribute passthrough', () => {
  test('forwards id to the root div', () => {
    const { container } = render(EmptyState, {
      props: { title: 'Empty', id: 'my-empty-state' },
    });
    const root = container.querySelector('.cinder-empty-state');
    expect(root?.getAttribute('id')).toBe('my-empty-state');
  });

  test('forwards data-* attributes to the root div', () => {
    const { container } = render(EmptyState, {
      props: { title: 'Empty', 'data-testid': 'empty-state-fixture' },
    });
    const root = container.querySelector('.cinder-empty-state');
    expect(root?.getAttribute('data-testid')).toBe('empty-state-fixture');
  });

  test('forwards aria-describedby to the root div', () => {
    const { container } = render(EmptyState, {
      props: { title: 'Empty', 'aria-describedby': 'desc-id' },
    });
    const root = container.querySelector('.cinder-empty-state');
    expect(root?.getAttribute('aria-describedby')).toBe('desc-id');
  });

  test('consumer class is merged with cinder-empty-state, not replaced', () => {
    const { container } = render(EmptyState, {
      props: { title: 'Empty', class: 'extra-class', 'data-testid': 'passthrough-class' },
    });
    const root = container.querySelector('.cinder-empty-state');
    expect(root?.classList.contains('cinder-empty-state')).toBe(true);
    expect(root?.classList.contains('extra-class')).toBe(true);
  });
});
