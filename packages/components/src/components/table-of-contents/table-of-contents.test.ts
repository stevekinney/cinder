/// <reference lib="dom" />
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { cleanup, fireEvent, render } = await import('@testing-library/svelte');
const { default: TableOfContents } = await import('./table-of-contents.svelte');

type ObserverRecord = {
  callback: IntersectionObserverCallback;
  observeTargets: Element[];
  disconnectCalls: number;
};

class FakeIntersectionObserver {
  static records: ObserverRecord[] = [];

  private readonly record: ObserverRecord;

  constructor(callback: IntersectionObserverCallback) {
    this.record = {
      callback,
      observeTargets: [],
      disconnectCalls: 0,
    };
    FakeIntersectionObserver.records.push(this.record);
  }

  observe(target: Element) {
    this.record.observeTargets.push(target);
  }

  disconnect() {
    this.record.disconnectCalls += 1;
  }

  unobserve() {}
  takeRecords() {
    return [];
  }
}

const originalIntersectionObserver = globalThis.IntersectionObserver;

function createHeading(id: string, text: string, tag: 'h2' | 'h3' = 'h2') {
  const heading = document.createElement(tag);
  heading.id = id;
  heading.textContent = text;
  heading.scrollIntoView = () => {};
  return heading;
}

function createEntry(
  target: Element,
  top: number,
  isIntersecting = true,
): IntersectionObserverEntry {
  return {
    boundingClientRect: { top } as DOMRectReadOnly,
    intersectionRatio: isIntersecting ? 1 : 0,
    intersectionRect: {} as DOMRectReadOnly,
    isIntersecting,
    rootBounds: null,
    target,
    time: Date.now(),
  };
}

beforeEach(() => {
  FakeIntersectionObserver.records = [];
  globalThis.IntersectionObserver =
    FakeIntersectionObserver as unknown as typeof IntersectionObserver;
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
  globalThis.IntersectionObserver = originalIntersectionObserver;
});

describe('TableOfContents', () => {
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

  test('marks link aria-current when observed heading becomes active', async () => {
    const first = createHeading('first', 'First');
    const second = createHeading('second', 'Second');
    document.body.appendChild(first);
    document.body.appendChild(second);

    const { container } = render(TableOfContents, {
      props: {
        items: [
          { id: 'first', label: 'First' },
          { id: 'second', label: 'Second' },
        ],
      },
    });

    const [record] = FakeIntersectionObserver.records;
    record?.callback([createEntry(second, 24, true)], {} as IntersectionObserver);
    await Promise.resolve();

    const current = container.querySelector('a[aria-current="location"]');
    expect(current?.getAttribute('href')).toBe('#second');
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
});
