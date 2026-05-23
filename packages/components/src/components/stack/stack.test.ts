/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { default: Stack } = await import('./stack.svelte');
const { createRawSnippet } = await import('svelte');

function textSnippet(text: string) {
  return createRawSnippet(() => ({
    render: () => `<span>${text}</span>`,
  }));
}

describe('Stack', () => {
  test('renders a div by default with the cinder-stack class', () => {
    const { container } = render(Stack, { children: textSnippet('item') });
    const root = container.querySelector('.cinder-stack');
    expect(root).not.toBeNull();
    expect(root?.tagName).toBe('DIV');
  });

  test('honors the `as` prop for the rendered element', () => {
    const { container } = render(Stack, {
      children: textSnippet('item'),
      as: 'section',
    });
    expect(container.querySelector('section.cinder-stack')).not.toBeNull();
  });

  test('merges the class prop alongside cinder-stack', () => {
    const { container } = render(Stack, {
      children: textSnippet('item'),
      class: 'my-stack',
    });
    const root = container.querySelector('.cinder-stack');
    expect(root?.getAttribute('class')).toContain('cinder-stack');
    expect(root?.getAttribute('class')).toContain('my-stack');
  });

  test('forwards rest attributes (data-testid) to the root element', () => {
    const { container } = render(Stack, {
      children: textSnippet('item'),
      'data-testid': 'my-stack',
    });
    const root = container.querySelector('.cinder-stack') as HTMLElement;
    expect(root.getAttribute('data-testid')).toBe('my-stack');
  });

  test('does not emit --stack-gap or --stack-direction when props are undefined', () => {
    const { container } = render(Stack, { children: textSnippet('item') });
    const root = container.querySelector('.cinder-stack') as HTMLElement;
    expect(root.style.getPropertyValue('--stack-gap')).toBe('');
    expect(root.style.getPropertyValue('--stack-direction')).toBe('');
  });

  test('threads gap into --stack-gap when provided', () => {
    const { container } = render(Stack, {
      children: textSnippet('item'),
      gap: '2rem',
    });
    const root = container.querySelector('.cinder-stack') as HTMLElement;
    expect(root.style.getPropertyValue('--stack-gap')).toBe('2rem');
  });

  test('threads direction into --stack-direction when provided', () => {
    const { container } = render(Stack, {
      children: textSnippet('item'),
      direction: 'column-reverse',
    });
    const root = container.querySelector('.cinder-stack') as HTMLElement;
    expect(root.style.getPropertyValue('--stack-direction')).toBe('column-reverse');
  });

  test('renders children content', () => {
    const { container } = render(Stack, { children: textSnippet('hello stack') });
    expect(container.querySelector('.cinder-stack')?.textContent).toContain('hello stack');
  });

  test('component gap directive wins over a consumer style attribute', () => {
    const { container } = render(Stack, {
      children: textSnippet('item'),
      gap: '2rem',
      style: '--stack-gap: 99rem',
    });
    const root = container.querySelector('.cinder-stack') as HTMLElement;
    expect(root.style.getPropertyValue('--stack-gap')).toBe('2rem');
  });
});
