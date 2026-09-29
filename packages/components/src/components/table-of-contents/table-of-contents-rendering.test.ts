/// <reference lib="dom" />
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';

import {
  cleanup,
  createHeading,
  FakeIntersectionObserver,
  fireEvent,
  originalIntersectionObserver,
  render,
  TableOfContents,
  waitForTableOfContentsLinks,
} from './table-of-contents-test-helpers.ts';

beforeEach(() => {
  FakeIntersectionObserver.records = [];
  globalThis.IntersectionObserver = FakeIntersectionObserver;
});

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
  globalThis.IntersectionObserver = originalIntersectionObserver;
});

describe('TableOfContents', () => {
  test('uses spacing and active fill instead of structural border rails', async () => {
    const stylesheet = await Bun.file(new URL('./table-of-contents.css', import.meta.url)).text();

    expect(stylesheet).not.toContain('.cinder-table-of-contents__list::before');
    expect(stylesheet).not.toContain('border-inline-start');
    expect(stylesheet).toContain('background: var(--cinder-surface-hover)');
  });
  test('does not render a nav landmark when there are no TOC entries', () => {
    const { container } = render(TableOfContents, {
      props: {
        items: [],
      },
    });

    expect(container.querySelector('nav')).toBeNull();
  });
  test('renders nav landmark with default aria label', () => {
    const { container } = render(TableOfContents, {
      props: {
        items: [{ id: 'intro', label: 'Introduction' }],
      },
    });

    expect(container.querySelector('nav')?.getAttribute('aria-label')).toBe('On this page');
  });
  test('throws when ariaLabel is empty', () => {
    expect(() => {
      render(TableOfContents, {
        props: {
          ariaLabel: ' ',
          items: [{ id: 'intro', label: 'Introduction' }],
        },
      });
    }).toThrow();
  });
  test('renders nested explicit items', () => {
    const { container } = render(TableOfContents, {
      props: {
        items: [
          {
            id: 'overview',
            label: 'Overview',
            children: [{ id: 'overview-goals', label: 'Goals' }],
          },
        ],
      },
    });

    const links = container.querySelectorAll('a.cinder-table-of-contents__link');
    expect(links.length).toBe(2);
    expect(links[0]?.getAttribute('href')).toBe('#overview');
    expect(links[1]?.getAttribute('href')).toBe('#overview-goals');
  });
  test('derives items from headings in the target region when items are absent', () => {
    const article = document.createElement('article');
    article.id = 'doc';
    article.appendChild(createHeading('install', 'Install', 'h2'));
    article.appendChild(createHeading('install-linux', 'Linux', 'h3'));
    document.body.appendChild(article);

    const { container } = render(TableOfContents, {
      props: {
        target: '#doc',
      },
    });

    const links = container.querySelectorAll('a.cinder-table-of-contents__link');
    expect(links.length).toBe(2);
    expect(links[0]?.textContent?.trim()).toBe('Install');
    expect(links[1]?.textContent?.trim()).toBe('Linux');
  });
  test('clicking a link scrolls to the heading and updates location hash', async () => {
    const section = createHeading('usage', 'Usage');
    let lastBehavior: ScrollBehavior | undefined;
    section.scrollIntoView = (options?: ScrollIntoViewOptions) => {
      lastBehavior = options?.behavior;
    };
    document.body.appendChild(section);

    const { container } = render(TableOfContents, {
      props: {
        items: [{ id: 'usage', label: 'Usage' }],
      },
    });

    const link = container.querySelector('a.cinder-table-of-contents__link');
    await fireEvent.click(link!);

    expect(lastBehavior).toBe('smooth');
    expect(window.location.hash).toBe('#usage');
  });
  test('disambiguates duplicate heading slugs with a numeric suffix', async () => {
    const article = document.createElement('article');
    article.id = 'duplicate-heading-target';
    article.appendChild(createHeading('', 'Overview', 'h2'));
    article.appendChild(createHeading('', 'Overview', 'h2'));
    document.body.appendChild(article);

    const { container } = render(TableOfContents, {
      props: {
        target: '#duplicate-heading-target',
      },
    });

    const links = await waitForTableOfContentsLinks(container, 2);
    expect(links[0]?.getAttribute('href')).toBe('#overview');
    expect(links[1]?.getAttribute('href')).toBe('#overview-2');
  });
  test('reduced motion swaps the click-to-scroll behavior to auto', async () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = mock(
      (media: string): MediaQueryList =>
        ({
          matches: media === '(prefers-reduced-motion: reduce)',
          media,
          onchange: null,
          addEventListener: () => {},
          removeEventListener: () => {},
          addListener: () => {},
          removeListener: () => {},
          dispatchEvent: () => true,
        }) as MediaQueryList,
    );

    try {
      const section = createHeading('reduced-motion-target', 'Reduced motion target');
      let lastBehavior: ScrollBehavior | undefined;
      section.scrollIntoView = (options?: ScrollIntoViewOptions) => {
        lastBehavior = options?.behavior;
      };
      document.body.appendChild(section);

      const { container } = render(TableOfContents, {
        props: {
          items: [{ id: 'reduced-motion-target', label: 'Reduced motion target' }],
        },
      });

      const link = container.querySelector('a.cinder-table-of-contents__link');
      await fireEvent.click(link!);

      expect(lastBehavior).toBe('auto');
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });
  test('modified clicks preserve native anchor behavior', async () => {
    const section = createHeading('advanced', 'Advanced');
    let scrollCalls = 0;
    section.scrollIntoView = () => {
      scrollCalls += 1;
    };
    document.body.appendChild(section);

    const { container } = render(TableOfContents, {
      props: {
        items: [{ id: 'advanced', label: 'Advanced' }],
      },
    });

    const link = container.querySelector('a.cinder-table-of-contents__link');
    const clickEvent = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      ctrlKey: true,
    });
    link?.dispatchEvent(clickEvent);

    expect(clickEvent.defaultPrevented).toBe(false);
    expect(scrollCalls).toBe(0);
  });
});
