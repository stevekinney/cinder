/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { default: Inline } = await import('./inline.svelte');
const { createRawSnippet } = await import('svelte');

function textSnippet(text: string) {
  return createRawSnippet(() => ({
    render: () => `<span>${text}</span>`,
  }));
}

describe('Inline', () => {
  test('renders a div by default with the cinder-inline class', () => {
    const { container } = render(Inline, { children: textSnippet('item') });
    const root = container.querySelector('.cinder-inline');
    expect(root).not.toBeNull();
    expect(root?.tagName).toBe('DIV');
  });

  test('honors the `as` prop for the rendered element', () => {
    const { container } = render(Inline, {
      children: textSnippet('item'),
      as: 'nav',
    });
    expect(container.querySelector('nav.cinder-inline')).not.toBeNull();
  });

  test('merges the class prop alongside cinder-inline', () => {
    const { container } = render(Inline, {
      children: textSnippet('item'),
      class: 'my-inline',
    });
    const root = container.querySelector('.cinder-inline');
    expect(root?.getAttribute('class')).toContain('cinder-inline');
    expect(root?.getAttribute('class')).toContain('my-inline');
  });

  test('forwards rest attributes (data-testid) to the root element', () => {
    const { container } = render(Inline, {
      children: textSnippet('item'),
      'data-testid': 'my-inline',
    });
    const root = container.querySelector('.cinder-inline') as HTMLElement;
    expect(root.getAttribute('data-testid')).toBe('my-inline');
  });

  test('does not emit custom properties when props are undefined', () => {
    const { container } = render(Inline, { children: textSnippet('item') });
    const root = container.querySelector('.cinder-inline') as HTMLElement;
    expect(root.style.getPropertyValue('--inline-gap')).toBe('');
    expect(root.style.getPropertyValue('--inline-wrap')).toBe('');
    expect(root.style.getPropertyValue('--inline-align')).toBe('');
  });

  test('threads gap into --inline-gap when provided', () => {
    const { container } = render(Inline, {
      children: textSnippet('item'),
      gap: '1.5rem',
    });
    const root = container.querySelector('.cinder-inline') as HTMLElement;
    expect(root.style.getPropertyValue('--inline-gap')).toBe('1.5rem');
  });

  test('threads wrap into --inline-wrap when provided', () => {
    const { container } = render(Inline, {
      children: textSnippet('item'),
      wrap: 'nowrap',
    });
    const root = container.querySelector('.cinder-inline') as HTMLElement;
    expect(root.style.getPropertyValue('--inline-wrap')).toBe('nowrap');
  });

  test('threads align into --inline-align when provided', () => {
    const { container } = render(Inline, {
      children: textSnippet('item'),
      align: 'flex-end',
    });
    const root = container.querySelector('.cinder-inline') as HTMLElement;
    expect(root.style.getPropertyValue('--inline-align')).toBe('flex-end');
  });

  test('renders children content', () => {
    const { container } = render(Inline, { children: textSnippet('hello inline') });
    expect(container.querySelector('.cinder-inline')?.textContent).toContain('hello inline');
  });
});
