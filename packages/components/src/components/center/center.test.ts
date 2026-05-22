/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { default: Center } = await import('./center.svelte');
const { createRawSnippet } = await import('svelte');

function textSnippet(text: string) {
  return createRawSnippet(() => ({
    render: () => `<span>${text}</span>`,
  }));
}

describe('Center', () => {
  test('renders a div by default with the cinder-center class', () => {
    const { container } = render(Center, { children: textSnippet('item') });
    const root = container.querySelector('.cinder-center');
    expect(root).not.toBeNull();
    expect(root?.tagName).toBe('DIV');
  });

  test('honors the `as` prop for the rendered element', () => {
    const { container } = render(Center, {
      children: textSnippet('item'),
      as: 'main',
    });
    expect(container.querySelector('main.cinder-center')).not.toBeNull();
  });

  test('merges the class prop alongside cinder-center', () => {
    const { container } = render(Center, {
      children: textSnippet('item'),
      class: 'my-center',
    });
    const root = container.querySelector('.cinder-center');
    expect(root?.getAttribute('class')).toContain('cinder-center');
    expect(root?.getAttribute('class')).toContain('my-center');
  });

  test('forwards rest attributes (data-testid) to the root element', () => {
    const { container } = render(Center, {
      children: textSnippet('item'),
      'data-testid': 'my-center',
    });
    const root = container.querySelector('.cinder-center') as HTMLElement;
    expect(root.getAttribute('data-testid')).toBe('my-center');
  });

  test('does not emit --center-max-width or --center-min-height when props are undefined', () => {
    const { container } = render(Center, { children: textSnippet('item') });
    const root = container.querySelector('.cinder-center') as HTMLElement;
    expect(root.style.getPropertyValue('--center-max-width')).toBe('');
    expect(root.style.getPropertyValue('--center-min-height')).toBe('');
  });

  test('threads maxWidth into --center-max-width when provided', () => {
    const { container } = render(Center, {
      children: textSnippet('item'),
      maxWidth: '40rem',
    });
    const root = container.querySelector('.cinder-center') as HTMLElement;
    expect(root.style.getPropertyValue('--center-max-width')).toBe('40rem');
  });

  test('threads minHeight into --center-min-height when provided', () => {
    const { container } = render(Center, {
      children: textSnippet('item'),
      minHeight: '20rem',
    });
    const root = container.querySelector('.cinder-center') as HTMLElement;
    expect(root.style.getPropertyValue('--center-min-height')).toBe('20rem');
  });

  test('does not set data-cinder-intrinsic by default', () => {
    const { container } = render(Center, { children: textSnippet('item') });
    const root = container.querySelector('.cinder-center') as HTMLElement;
    expect(root.getAttribute('data-cinder-intrinsic')).toBeNull();
  });

  test('sets data-cinder-intrinsic="true" when intrinsic is true', () => {
    const { container } = render(Center, {
      children: textSnippet('item'),
      intrinsic: true,
    });
    const root = container.querySelector('.cinder-center') as HTMLElement;
    expect(root.getAttribute('data-cinder-intrinsic')).toBe('true');
  });

  test('does not set data-cinder-intrinsic when intrinsic is explicitly false', () => {
    const { container } = render(Center, {
      children: textSnippet('item'),
      intrinsic: false,
    });
    const root = container.querySelector('.cinder-center') as HTMLElement;
    expect(root.getAttribute('data-cinder-intrinsic')).toBeNull();
  });

  test('renders children content', () => {
    const { container } = render(Center, { children: textSnippet('hello center') });
    expect(container.querySelector('.cinder-center')?.textContent).toContain('hello center');
  });
});
