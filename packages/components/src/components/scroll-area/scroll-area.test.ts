/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

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

  test('trims ariaLabel before deriving the accessible region label', () => {
    const { container } = render(ScrollArea, {
      ariaLabel: '  Chat transcript  ',
      children: textSnippet('body'),
    });
    const root = container.querySelector('.cinder-scroll-area');
    expect(root?.getAttribute('role')).toBe('region');
    expect(root?.getAttribute('aria-label')).toBe('Chat transcript');
  });

  test('omits role and aria-label when ariaLabel is empty after trimming', () => {
    const { container } = render(ScrollArea, {
      ariaLabel: '   ',
      children: textSnippet('body'),
    });
    const root = container.querySelector('.cinder-scroll-area');
    expect(root?.hasAttribute('role')).toBe(false);
    expect(root?.hasAttribute('aria-label')).toBe(false);
  });

  test('omits role and aria-label when ariaLabel is an empty string', () => {
    const { container } = render(ScrollArea, {
      ariaLabel: '',
      children: textSnippet('body'),
    });
    const root = container.querySelector('.cinder-scroll-area');
    expect(root?.hasAttribute('role')).toBe(false);
    expect(root?.hasAttribute('aria-label')).toBe(false);
  });

  test('does not override semantic element roles when ariaLabel is provided', () => {
    const { container } = render(ScrollArea, {
      as: 'main',
      ariaLabel: 'Primary page content',
      children: textSnippet('body'),
    });
    const root = container.querySelector('main.cinder-scroll-area');
    expect(root?.hasAttribute('role')).toBe(false);
    expect(root?.getAttribute('aria-label')).toBe('Primary page content');
  });

  test('omits role and aria-label when ariaLabel is not provided', () => {
    const { container } = render(ScrollArea, { children: textSnippet('body') });
    const root = container.querySelector('.cinder-scroll-area');
    expect(root?.hasAttribute('role')).toBe(false);
    expect(root?.hasAttribute('aria-label')).toBe(false);
  });

  test('adds role="region" when aria-labelledby names a neutral element', () => {
    const { container } = render(ScrollArea, {
      as: 'div',
      'aria-labelledby': 'transcript-heading',
      children: textSnippet('body'),
    } as never);
    const root = container.querySelector('.cinder-scroll-area');
    expect(root?.getAttribute('role')).toBe('region');
    expect(root?.getAttribute('aria-labelledby')).toBe('transcript-heading');
  });

  test('does not add role="region" via aria-labelledby on a semantic element', () => {
    const { container } = render(ScrollArea, {
      as: 'main',
      'aria-labelledby': 'transcript-heading',
      children: textSnippet('body'),
    } as never);
    const root = container.querySelector('main.cinder-scroll-area');
    expect(root?.hasAttribute('role')).toBe(false);
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

  test('omits max-inline-size when only maxHeight is provided', () => {
    const { container } = render(ScrollArea, {
      maxHeight: '20rem',
      children: textSnippet('body'),
    });
    const root = container.querySelector<HTMLElement>('.cinder-scroll-area');
    expect(root?.style.getPropertyValue('max-block-size')).toBe('20rem');
    expect(root?.style.getPropertyValue('max-inline-size')).toBe('');
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
    const root = container.querySelector('.cinder-scroll-area');
    expect(root?.getAttribute('data-testid')).toBe('scroll');
  });

  test('renders the tag passed via as="main"', () => {
    const { container } = render(ScrollArea, { as: 'main', children: textSnippet('body') });
    expect(container.querySelector('main.cinder-scroll-area')).not.toBeNull();
  });

  test('renders the tag passed via as="article"', () => {
    const { container } = render(ScrollArea, { as: 'article', children: textSnippet('body') });
    expect(container.querySelector('article.cinder-scroll-area')).not.toBeNull();
  });
});

describe('ScrollArea attribute precedence', () => {
  test('consumer-supplied role via rest props does not override the component-derived role', () => {
    // `role` is Omitted from ScrollAreaProps, so we cast to `any` to simulate
    // a consumer reaching past the type to pass it anyway — the runtime
    // contract must still hold.
    const { container } = render(ScrollArea, {
      ariaLabel: 'Chat transcript',
      role: 'complementary',
      children: textSnippet('body'),
    } as any);
    expect(container.querySelector('.cinder-scroll-area')?.getAttribute('role')).toBe('region');
  });

  test('consumer-supplied direction via data-cinder-direction does not override the prop', () => {
    const { container } = render(ScrollArea, {
      direction: 'horizontal',
      'data-cinder-direction': 'vertical',
      children: textSnippet('body'),
    });
    expect(
      container.querySelector('.cinder-scroll-area')?.getAttribute('data-cinder-direction'),
    ).toBe('horizontal');
  });
});

describe('ScrollArea scrollbar tokens', () => {
  test('scrollbar tokens are declared in tokens-base.css', async () => {
    const tokensPath = new URL('../../styles/tokens-base.css', import.meta.url);
    const source = await Bun.file(tokensPath).text();
    // Use a colon anchor so `--cinder-scrollbar-thumb` does not also match
    // `--cinder-scrollbar-thumb-hover` (prefix overlap).
    expect(source).toMatch(/--cinder-scrollbar-size\s*:/);
    expect(source).toMatch(/--cinder-scrollbar-track\s*:/);
    expect(source).toMatch(/--cinder-scrollbar-thumb\s*:/);
    expect(source).toMatch(/--cinder-scrollbar-thumb-hover\s*:/);
  });

  test('scroll-area.css consumes the scrollbar tokens for both engines', async () => {
    const cssPath = new URL('./scroll-area.css', import.meta.url);
    const source = await Bun.file(cssPath).text();
    expect(source).toMatch(/scrollbar-color:\s*var\(--cinder-scrollbar-thumb\)/);
    expect(source).toMatch(/::-webkit-scrollbar-thumb/);
    expect(source).toMatch(/var\(--cinder-scrollbar-track\)/);
    expect(source).not.toContain('scrollbar-gutter: stable');
  });

  test('forced-colors fallback uses standardized system colors', async () => {
    const cssPath = new URL('./scroll-area.css', import.meta.url);
    const source = await Bun.file(cssPath).text();
    expect(source).not.toContain('ScrollbarThumb');
    expect(source).not.toContain('ScrollbarTrack');
    expect(source).toMatch(/background:\s*Canvas;/);
    expect(source).toMatch(/background:\s*CanvasText;/);
  });
});
