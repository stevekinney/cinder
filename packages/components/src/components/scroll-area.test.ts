/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../test/happy-dom.ts';

setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { default: ScrollArea } = await import('./scroll-area.svelte');
const { createRawSnippet } = await import('svelte');

function textSnippet(text: string) {
  return createRawSnippet(() => ({
    render: () => `<span>${text}</span>`,
  }));
}

describe('ScrollArea', () => {
  test('renders a <div> by default with the scroll-area class', () => {
    const { container } = render(ScrollArea, { children: textSnippet('body') });
    const root = container.querySelector('div.cinder-scroll-area');
    expect(root).not.toBeNull();
    expect(root?.textContent).toContain('body');
  });

  test('honors the `as` prop for the rendered element', () => {
    const { container } = render(ScrollArea, { as: 'section', children: textSnippet('body') });
    expect(container.querySelector('section.cinder-scroll-area')).not.toBeNull();
    expect(container.querySelector('div.cinder-scroll-area')).toBeNull();
  });

  test('defaults to vertical direction via data attribute', () => {
    const { container } = render(ScrollArea, { children: textSnippet('body') });
    const root = container.querySelector('.cinder-scroll-area');
    expect(root?.getAttribute('data-cinder-direction')).toBe('vertical');
  });

  test('reflects horizontal direction on the data attribute', () => {
    const { container } = render(ScrollArea, {
      direction: 'horizontal',
      children: textSnippet('body'),
    });
    expect(
      container.querySelector('.cinder-scroll-area')?.getAttribute('data-cinder-direction'),
    ).toBe('horizontal');
  });

  test('reflects bidirectional scrolling on the data attribute', () => {
    const { container } = render(ScrollArea, {
      direction: 'both',
      children: textSnippet('body'),
    });
    expect(
      container.querySelector('.cinder-scroll-area')?.getAttribute('data-cinder-direction'),
    ).toBe('both');
  });

  test('adds role="region" and aria-label when ariaLabel is provided', () => {
    const { container } = render(ScrollArea, {
      ariaLabel: 'Chat transcript',
      children: textSnippet('body'),
    });
    const root = container.querySelector('.cinder-scroll-area');
    expect(root?.getAttribute('role')).toBe('region');
    expect(root?.getAttribute('aria-label')).toBe('Chat transcript');
  });

  test('omits role and aria-label when ariaLabel is not provided', () => {
    const { container } = render(ScrollArea, { children: textSnippet('body') });
    const root = container.querySelector('.cinder-scroll-area');
    expect(root?.getAttribute('role')).toBeNull();
    expect(root?.getAttribute('aria-label')).toBeNull();
  });

  test('applies tabindex="0" by default so keyboard users can scroll', () => {
    const { container } = render(ScrollArea, { children: textSnippet('body') });
    expect(container.querySelector('.cinder-scroll-area')?.getAttribute('tabindex')).toBe('0');
  });

  test('allows consumers to override tabindex', () => {
    const { container } = render(ScrollArea, { tabindex: -1, children: textSnippet('body') });
    expect(container.querySelector('.cinder-scroll-area')?.getAttribute('tabindex')).toBe('-1');
  });

  test('applies maxHeight and maxWidth as inline logical sizing styles', () => {
    const { container } = render(ScrollArea, {
      maxHeight: '20rem',
      maxWidth: '40rem',
      children: textSnippet('body'),
    });
    const root = container.querySelector<HTMLElement>('.cinder-scroll-area');
    expect(root?.style.getPropertyValue('max-block-size')).toBe('20rem');
    expect(root?.style.getPropertyValue('max-inline-size')).toBe('40rem');
  });

  test('merges a consumer-provided class with cinder-scroll-area', () => {
    const { container } = render(ScrollArea, {
      class: 'extra-class',
      children: textSnippet('body'),
    });
    const root = container.querySelector('.cinder-scroll-area');
    expect(root?.classList.contains('cinder-scroll-area')).toBe(true);
    expect(root?.classList.contains('extra-class')).toBe(true);
  });

  test('forwards rest props onto the root element', () => {
    const { container } = render(ScrollArea, {
      'data-testid': 'scroll',
      children: textSnippet('body'),
    });
    expect(container.querySelector('[data-testid="scroll"]')).not.toBeNull();
  });
});

describe('ScrollArea scrollbar tokens', () => {
  test('scrollbar tokens are declared in tokens-base.css', async () => {
    const tokensPath = new URL('../styles/tokens-base.css', import.meta.url);
    const source = await Bun.file(tokensPath).text();
    expect(source).toMatch(/--cinder-scrollbar-track:\s*\S+/);
    expect(source).toMatch(/--cinder-scrollbar-thumb:\s*\S+/);
    expect(source).toMatch(/--cinder-scrollbar-thumb-hover:\s*\S+/);
    expect(source).toMatch(/--cinder-scrollbar-size:\s*\S+/);
  });

  test('scroll-area.css consumes the scrollbar tokens for both engines', async () => {
    const cssPath = new URL('../styles/components/scroll-area.css', import.meta.url);
    const source = await Bun.file(cssPath).text();
    expect(source).toMatch(/scrollbar-color:\s*var\(--cinder-scrollbar-thumb\)/);
    expect(source).toMatch(/::-webkit-scrollbar-thumb/);
    expect(source).toMatch(/var\(--cinder-scrollbar-track\)/);
  });
});
