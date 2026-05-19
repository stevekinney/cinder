/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

// setupHappyDom() MUST run before any `@testing-library/svelte` import. testing-library
// reads `globalThis.document` / `window` at module-init (top-level, not inside test bodies),
// so we register happy-dom's globals first and then dynamic-import testing-library below.
setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { default: VisuallyHidden } = await import('./visually-hidden.svelte');
// createRawSnippet must be imported dynamically so Bun's svelte plugin (which patches
// the svelte package to resolve to the client build) applies before this import resolves.
const { createRawSnippet } = await import('svelte');

function textSnippet(text: string) {
  return createRawSnippet(() => ({
    render: () => `<span>${text}</span>`,
  }));
}

describe('VisuallyHidden', () => {
  test('renders a <span> by default', () => {
    const { container } = render(VisuallyHidden, { children: textSnippet('label') });
    expect(container.querySelector('span.cinder-sr-only')).not.toBeNull();
  });

  test('renders the tag passed via as="div"', () => {
    const { container } = render(VisuallyHidden, { as: 'div', children: textSnippet('label') });
    expect(container.querySelector('div.cinder-sr-only')).not.toBeNull();
    expect(container.querySelector('span.cinder-sr-only')).toBeNull();
  });

  test('renders the tag passed via as="label"', () => {
    const { container } = render(VisuallyHidden, { as: 'label', children: textSnippet('label') });
    expect(container.querySelector('label.cinder-sr-only')).not.toBeNull();
  });

  test('always applies cinder-sr-only', () => {
    const { container } = render(VisuallyHidden, { children: textSnippet('label') });
    const el = container.querySelector('.cinder-sr-only');
    expect(el).not.toBeNull();
  });

  test('does not apply cinder-sr-only-focusable when focusable is omitted', () => {
    const { container } = render(VisuallyHidden, { children: textSnippet('label') });
    expect(container.querySelector('.cinder-sr-only-focusable')).toBeNull();
  });

  test('does not apply cinder-sr-only-focusable when focusable is false', () => {
    const { container } = render(VisuallyHidden, {
      focusable: false,
      children: textSnippet('label'),
    });
    expect(container.querySelector('.cinder-sr-only-focusable')).toBeNull();
  });

  test('applies both cinder-sr-only and cinder-sr-only-focusable when focusable is true', () => {
    const { container } = render(VisuallyHidden, {
      focusable: true,
      children: textSnippet('label'),
    });
    const el = container.querySelector('.cinder-sr-only');
    expect(el).not.toBeNull();
    expect(el?.classList.contains('cinder-sr-only-focusable')).toBe(true);
  });

  test('merges a consumer-provided class after the utility classes', () => {
    const { container } = render(VisuallyHidden, {
      class: 'my-custom-class',
      children: textSnippet('label'),
    });
    const el = container.querySelector('.cinder-sr-only');
    expect(el?.classList.contains('cinder-sr-only')).toBe(true);
    expect(el?.classList.contains('my-custom-class')).toBe(true);
    // cinder-sr-only must appear before my-custom-class in the token list
    const tokens = Array.from(el?.classList ?? []);
    expect(tokens.indexOf('cinder-sr-only')).toBeLessThan(tokens.indexOf('my-custom-class'));
  });

  test('with focusable=true, all three classes are present and in the correct order', () => {
    const { container } = render(VisuallyHidden, {
      focusable: true,
      class: 'my-custom-class',
      children: textSnippet('label'),
    });
    const el = container.querySelector('.cinder-sr-only');
    const tokens = Array.from(el?.classList ?? []);
    expect(tokens).toContain('cinder-sr-only');
    expect(tokens).toContain('cinder-sr-only-focusable');
    expect(tokens).toContain('my-custom-class');
    expect(tokens.indexOf('cinder-sr-only')).toBeLessThan(
      tokens.indexOf('cinder-sr-only-focusable'),
    );
    expect(tokens.indexOf('cinder-sr-only-focusable')).toBeLessThan(
      tokens.indexOf('my-custom-class'),
    );
  });

  test('spreads arbitrary attributes onto the rendered element', () => {
    const { container } = render(VisuallyHidden, {
      id: 'my-id',
      'aria-label': 'my-label',
      'data-testid': 'my-test',
      role: 'status',
      tabindex: 0,
      children: textSnippet('label'),
    });
    const el = container.querySelector('.cinder-sr-only');
    expect(el?.getAttribute('id')).toBe('my-id');
    expect(el?.getAttribute('aria-label')).toBe('my-label');
    expect(el?.getAttribute('data-testid')).toBe('my-test');
    expect(el?.getAttribute('role')).toBe('status');
    expect(el?.getAttribute('tabindex')).toBe('0');
  });

  test('rendered element has exactly one cinder-sr-only token (no duplicate via rest spread)', () => {
    const { container } = render(VisuallyHidden, {
      class: 'extra',
      children: textSnippet('label'),
    });
    const el = container.querySelector('.cinder-sr-only');
    // Use classList to count exact token matches (avoids substring matching cinder-sr-only-focusable)
    const tokens = Array.from(el?.classList ?? []);
    const srOnlyCount = tokens.filter((t) => t === 'cinder-sr-only').length;
    expect(srOnlyCount).toBe(1);
  });

  test('content is queryable and the VisuallyHidden element itself is not aria-hidden', () => {
    const { container } = render(VisuallyHidden, { children: textSnippet('Hidden label text') });
    const el = container.querySelector('.cinder-sr-only');
    expect(el).not.toBeNull();
    expect(el?.getAttribute('aria-hidden')).not.toBe('true');
    expect(el?.textContent).toContain('Hidden label text');
  });
});
