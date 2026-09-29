/// <reference lib="dom" />
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import {
  cleanup,
  createEntry,
  createHeading,
  FakeIntersectionObserver,
  originalIntersectionObserver,
  render,
  TableOfContents,
  waitFor,
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
    record?.callback([createEntry(second, 24, true)], new FakeIntersectionObserver(() => {}));
    await Promise.resolve();

    const current = container.querySelector('a[aria-current="location"]');
    expect(current?.getAttribute('href')).toBe('#second');
  });
  test('prefers document order over explicit items order when choosing active heading', async () => {
    const first = createHeading('first-doc', 'First');
    first.getBoundingClientRect = () => new DOMRect(0, -50, 0, 0);
    const second = createHeading('second-doc', 'Second');
    second.getBoundingClientRect = () => new DOMRect(0, -10, 0, 0);
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
  test('tracks explicit item headings that mount after initial render', async () => {
    const { container } = render(TableOfContents, {
      props: {
        items: [{ id: 'late-explicit', label: 'Late explicit' }],
      },
    });

    expect(container.querySelector('a[aria-current="location"]')).toBeNull();

    const lateHeading = createHeading('late-explicit', 'Late explicit', 'h2');
    lateHeading.getBoundingClientRect = () => new DOMRect(0, -12, 0, 0);
    document.body.appendChild(lateHeading);

    await waitFor(() => {
      const current = container.querySelector('a[aria-current="location"]');
      expect(current?.getAttribute('href')).toBe('#late-explicit');
    });
  });
  test('uses root margin bottom edge for active heading threshold', async () => {
    const first = createHeading('first-margin', 'First');
    first.getBoundingClientRect = () => new DOMRect(0, 100, 0, 0);
    const second = createHeading('second-margin', 'Second');
    second.getBoundingClientRect = () => new DOMRect(0, 350, 0, 0);
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
    first.getBoundingClientRect = () => new DOMRect(0, -100, 0, 0);
    const second = createHeading('second-scroll', 'Second');
    second.getBoundingClientRect = () => new DOMRect(0, 100, 0, 0);
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
    document.getElementById = (id: string) => {
      getElementByIdCalls += 1;
      return originalGetElementById(id);
    };

    try {
      window.dispatchEvent(new Event('scroll'));
      await new Promise((resolve) => setTimeout(resolve, 20));
    } finally {
      document.getElementById = originalGetElementById;
    }

    expect(getElementByIdCalls).toBe(0);
  });
});
