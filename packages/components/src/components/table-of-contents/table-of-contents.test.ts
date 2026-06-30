/// <reference lib="dom" />
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { cleanup, fireEvent, render, waitFor } = await import('@testing-library/svelte');
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

async function waitForTableOfContentsLinks(container: Element, expectedCount: number) {
  await waitFor(() => {
    expect(container.querySelectorAll('a.cinder-table-of-contents__link').length).toBe(
      expectedCount,
    );
  });

  return container.querySelectorAll('a.cinder-table-of-contents__link');
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

  test('discovers headings added after initial render in derived mode', async () => {
    const { container } = render(TableOfContents, {
      props: {
        target: '#late-target',
      },
    });

    expect(container.querySelectorAll('a.cinder-table-of-contents__link').length).toBe(0);

    const article = document.createElement('article');
    article.id = 'late-target';
    article.appendChild(createHeading('late-one', 'Late one', 'h2'));
    document.body.appendChild(article);

    const links = await waitForTableOfContentsLinks(container, 1);
    expect(links[0]?.getAttribute('href')).toBe('#late-one');
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

  test('prefers document order over explicit items order when choosing active heading', async () => {
    const first = createHeading('first-doc', 'First');
    first.getBoundingClientRect = () => ({ top: -50 }) as DOMRect;
    const second = createHeading('second-doc', 'Second');
    second.getBoundingClientRect = () => ({ top: -10 }) as DOMRect;
    document.body.appendChild(first);
    document.body.appendChild(second);

    const { container } = render(TableOfContents, {
      props: {
        items: [
          { id: 'second-doc', label: 'Second' },
          { id: 'first-doc', label: 'First' },
        ],
      },
    });
    await Promise.resolve();

    const current = container.querySelector('a[aria-current="location"]');
    expect(current?.getAttribute('href')).toBe('#second-doc');
  });

  test('refreshes derived headings when selector target element is replaced', async () => {
    const firstTarget = document.createElement('article');
    firstTarget.id = 'replace-target';
    firstTarget.appendChild(createHeading('original', 'Original', 'h2'));
    document.body.appendChild(firstTarget);

    const { container } = render(TableOfContents, {
      props: {
        target: '#replace-target',
      },
    });
    await Promise.resolve();
    expect(
      container.querySelectorAll('a.cinder-table-of-contents__link')[0]?.textContent?.trim(),
    ).toBe('Original');

    const replacementTarget = document.createElement('article');
    replacementTarget.id = 'replace-target';
    replacementTarget.appendChild(createHeading('replacement', 'Replacement', 'h2'));
    firstTarget.replaceWith(replacementTarget);
    await new Promise((resolve) => setTimeout(resolve, 300));

    const links = container.querySelectorAll('a.cinder-table-of-contents__link');
    expect(links.length).toBe(1);
    expect(links[0]?.getAttribute('href')).toBe('#replacement');
  });

  test('refreshes derived headings when selector matching target id changes', async () => {
    const target = document.createElement('article');
    target.id = 'dynamic-target';
    target.appendChild(createHeading('dynamic-original', 'Dynamic original', 'h2'));
    document.body.appendChild(target);

    const { container } = render(TableOfContents, {
      props: {
        target: '#dynamic-target',
      },
    });
    await Promise.resolve();
    expect(
      container.querySelectorAll('a.cinder-table-of-contents__link')[0]?.getAttribute('href'),
    ).toBe('#dynamic-original');

    target.id = 'dynamic-target-old';
    const nextTarget = document.createElement('article');
    nextTarget.id = 'dynamic-target';
    nextTarget.appendChild(createHeading('dynamic-new', 'Dynamic new', 'h2'));
    document.body.appendChild(nextTarget);
    await new Promise((resolve) => setTimeout(resolve, 80));

    const links = container.querySelectorAll('a.cinder-table-of-contents__link');
    expect(links.length).toBe(1);
    expect(links[0]?.getAttribute('href')).toBe('#dynamic-new');
  });

  test('clears derived items when an HTMLElement target is detached', async () => {
    const target = document.createElement('article');
    target.appendChild(createHeading('detached-heading', 'Detached heading', 'h2'));
    document.body.appendChild(target);

    const { container } = render(TableOfContents, {
      props: {
        target,
      },
    });
    await Promise.resolve();
    expect(container.querySelectorAll('a.cinder-table-of-contents__link').length).toBe(1);

    target.remove();
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(container.querySelectorAll('a.cinder-table-of-contents__link').length).toBe(0);
  });

  test('clears derived items when an HTMLElement target becomes disconnected via ancestor removal', async () => {
    const wrapper = document.createElement('section');
    const target = document.createElement('article');
    target.appendChild(createHeading('nested-heading', 'Nested heading', 'h2'));
    wrapper.appendChild(target);
    document.body.appendChild(wrapper);

    const { container } = render(TableOfContents, {
      props: {
        target,
      },
    });
    await Promise.resolve();
    expect(container.querySelectorAll('a.cinder-table-of-contents__link').length).toBe(1);

    wrapper.remove();
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(container.querySelectorAll('a.cinder-table-of-contents__link').length).toBe(0);
  });

  test('tracks explicit item headings that mount after initial render', async () => {
    const { container } = render(TableOfContents, {
      props: {
        items: [{ id: 'late-explicit', label: 'Late explicit' }],
      },
    });

    expect(container.querySelector('a[aria-current="location"]')).toBeNull();

    const lateHeading = createHeading('late-explicit', 'Late explicit', 'h2');
    lateHeading.getBoundingClientRect = () => ({ top: -12 }) as DOMRect;
    document.body.appendChild(lateHeading);
    await new Promise((resolve) => setTimeout(resolve, 20));

    const current = container.querySelector('a[aria-current="location"]');
    expect(current?.getAttribute('href')).toBe('#late-explicit');
  });

  test('uses root margin bottom edge for active heading threshold', async () => {
    const first = createHeading('first-margin', 'First');
    first.getBoundingClientRect = () => ({ top: 100 }) as DOMRect;
    const second = createHeading('second-margin', 'Second');
    second.getBoundingClientRect = () => ({ top: 350 }) as DOMRect;
    document.body.appendChild(first);
    document.body.appendChild(second);

    const originalInnerHeight = window.innerHeight;
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 500,
    });

    render(TableOfContents, {
      props: {
        items: [
          { id: 'first-margin', label: 'First' },
          { id: 'second-margin', label: 'Second' },
        ],
        observeRootMargin: '0px 0px -100px 0px',
      },
    });
    await Promise.resolve();

    const current = document.querySelector('a[aria-current="location"]');
    expect(current?.getAttribute('href')).toBe('#second-margin');

    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: originalInnerHeight,
    });
  });

  test('scroll updates do not rescan observed heading ids', async () => {
    const first = createHeading('first-scroll', 'First');
    first.getBoundingClientRect = () => ({ top: -100 }) as DOMRect;
    const second = createHeading('second-scroll', 'Second');
    second.getBoundingClientRect = () => ({ top: 100 }) as DOMRect;
    document.body.appendChild(first);
    document.body.appendChild(second);

    render(TableOfContents, {
      props: {
        items: [
          { id: 'first-scroll', label: 'First' },
          { id: 'second-scroll', label: 'Second' },
        ],
      },
    });
    await Promise.resolve();

    const originalGetElementById = document.getElementById.bind(document);
    let getElementByIdCalls = 0;
    document.getElementById = ((id: string) => {
      getElementByIdCalls += 1;
      return originalGetElementById(id);
    }) as typeof document.getElementById;

    try {
      window.dispatchEvent(new Event('scroll'));
      await new Promise((resolve) => setTimeout(resolve, 20));
    } finally {
      document.getElementById = originalGetElementById;
    }

    expect(getElementByIdCalls).toBe(0);
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
