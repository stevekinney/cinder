/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

// setupHappyDom() MUST run before any `@testing-library/svelte` import. testing-library
// reads `globalThis.document` / `window` at module-init (top-level, not inside test bodies),
// so we register happy-dom's globals first and then dynamic-import testing-library below.
setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { default: BlogSection } = await import('./blog-section.svelte');
const { createRawSnippet } = await import('svelte');
const runtimePatchSnippet = createRawSnippet(() => ({
  render: () => '<span></span>',
  setup: () => {},
}));
void runtimePatchSnippet;

const posts = [
  {
    title: 'How we ship design systems',
    excerpt: 'A practical process for component quality.',
    href: '/blog/design-systems',
    category: 'Engineering',
    publishedAt: 'May 2, 2026',
    authorName: 'Morgan Yu',
    authorRole: 'Staff Engineer',
  },
  {
    title: 'Measuring product UX',
    excerpt: 'A framework for meaningful usability metrics.',
    href: '/blog/ux-metrics',
    authorName: 'Jamie Patel',
  },
];

describe('BlogSection', () => {
  test('renders post cards with title links and excerpts', () => {
    const { container } = render(BlogSection, {
      props: {
        title: 'From the blog',
        posts,
      },
    });
    const element = container.querySelector('.cinder-blog-section');
    expect(element).not.toBeNull();
    expect(container.querySelectorAll('.cinder-blog-section__item')).toHaveLength(2);
    expect(container.querySelector('.cinder-blog-section__link')?.getAttribute('href')).toBe(
      '/blog/design-systems',
    );
    expect(container.querySelector('.cinder-blog-section__excerpt')?.textContent).toContain(
      'A practical process for component quality.',
    );
  });

  test('renders author metadata and applies columns data attribute', () => {
    const { container } = render(BlogSection, {
      props: {
        posts,
        columns: 2,
      },
    });
    expect(container.querySelector('.cinder-blog-section__author-name')?.textContent).toContain(
      'Morgan Yu',
    );
    expect(
      container.querySelector('.cinder-blog-section')?.getAttribute('data-cinder-columns'),
    ).toBe('2');
  });

  test('merges custom class alongside root class', () => {
    const { container } = render(BlogSection, {
      props: {
        posts,
        class: 'my-custom-class',
      },
    });
    const element = container.querySelector('.cinder-blog-section');
    expect(element?.classList.contains('cinder-blog-section')).toBe(true);
    expect(element?.classList.contains('my-custom-class')).toBe(true);
  });
});
