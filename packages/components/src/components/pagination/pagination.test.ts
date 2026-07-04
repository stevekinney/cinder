/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

// setupHappyDom() MUST run before any `@testing-library/svelte` import. testing-library
// reads `globalThis.document` / `window` at module-init (top-level, not inside test bodies),
// so we register happy-dom's globals first and then dynamic-import testing-library below.
setupHappyDom();

const { render, fireEvent } = await import('@testing-library/svelte');
const { default: Pagination } = await import('./pagination.svelte');

describe('Pagination', () => {
  // §Interactive a11y matrix — test 1
  test('nav element has aria-label', () => {
    const { container } = render(Pagination, {
      props: { currentPage: 1, totalPages: 10 },
    });
    const nav = container.querySelector('nav');
    expect(nav).not.toBeNull();
    expect(nav?.getAttribute('aria-label')).toBeTruthy();
  });

  // §Interactive a11y matrix — test 2
  test('current page button has aria-current="page"', () => {
    const { container } = render(Pagination, {
      props: { currentPage: 3, totalPages: 10 },
    });
    const currentButton = container.querySelector('[aria-current="page"]');
    expect(currentButton).not.toBeNull();
    expect(currentButton?.textContent?.trim()).toBe('3');
  });

  // §Interactive a11y matrix — test 3
  test('previous button is disabled when on page 1', () => {
    const { container } = render(Pagination, {
      props: { currentPage: 1, totalPages: 10 },
    });
    const previousButton = container.querySelector('button[aria-label="Go to previous page"]');
    expect(previousButton).not.toBeNull();
    expect(previousButton?.hasAttribute('disabled')).toBe(true);
    // Native disabled is sufficient for <button>; aria-disabled must not be present to avoid double-announcement.
    expect(previousButton?.hasAttribute('aria-disabled')).toBe(false);
  });

  // §Interactive a11y matrix — test 4
  test('next button is disabled when on last page', () => {
    const { container } = render(Pagination, {
      props: { currentPage: 10, totalPages: 10 },
    });
    const nextButton = container.querySelector('button[aria-label="Go to next page"]');
    expect(nextButton).not.toBeNull();
    expect(nextButton?.hasAttribute('disabled')).toBe(true);
    // Native disabled is sufficient for <button>; aria-disabled must not be present to avoid double-announcement.
    expect(nextButton?.hasAttribute('aria-disabled')).toBe(false);
  });

  // §Interactive a11y matrix — test 5
  test('clicking next increments currentPage bindable', async () => {
    let currentPage = 5;
    const { container } = render(Pagination, {
      props: {
        get currentPage() {
          return currentPage;
        },
        set currentPage(value: number) {
          currentPage = value;
        },
        totalPages: 10,
      },
    });

    const nextButton = container.querySelector(
      'button[aria-label="Go to next page"]',
    ) as HTMLButtonElement;
    expect(nextButton).not.toBeNull();
    await fireEvent.click(nextButton);
    expect(currentPage).toBe(6);
  });

  // §Interactive a11y matrix — test 6
  test('applies class prop to root element', () => {
    const { container } = render(Pagination, {
      props: { currentPage: 1, totalPages: 10, class: 'my-custom-class' },
    });
    const nav = container.querySelector('nav');
    const classAttribute = nav?.getAttribute('class') ?? '';
    expect(classAttribute).toContain('cinder-pagination');
    expect(classAttribute).toContain('my-custom-class');
  });

  // Additional behavioral coverage

  test('previous button is enabled when not on first page', () => {
    const { container } = render(Pagination, {
      props: { currentPage: 3, totalPages: 10 },
    });
    const previousButton = container.querySelector('button[aria-label="Go to previous page"]');
    expect(previousButton?.hasAttribute('disabled')).toBe(false);
    expect(previousButton?.getAttribute('aria-disabled')).toBeNull();
  });

  test('next button is enabled when not on last page', () => {
    const { container } = render(Pagination, {
      props: { currentPage: 3, totalPages: 10 },
    });
    const nextButton = container.querySelector('button[aria-label="Go to next page"]');
    expect(nextButton?.hasAttribute('disabled')).toBe(false);
    expect(nextButton?.getAttribute('aria-disabled')).toBeNull();
  });

  test('clicking previous decrements currentPage bindable', async () => {
    let currentPage = 5;
    const { container } = render(Pagination, {
      props: {
        get currentPage() {
          return currentPage;
        },
        set currentPage(value: number) {
          currentPage = value;
        },
        totalPages: 10,
      },
    });

    const previousButton = container.querySelector(
      'button[aria-label="Go to previous page"]',
    ) as HTMLButtonElement;
    await fireEvent.click(previousButton);
    expect(currentPage).toBe(4);
  });

  test('renders totalCount formatted when provided', () => {
    const { container } = render(Pagination, {
      props: { currentPage: 1, totalPages: 10, totalCount: 1234 },
    });
    expect(container.textContent).toContain('1,234');
  });

  test('does not render count element when totalCount is not provided', () => {
    const { container } = render(Pagination, {
      props: { currentPage: 1, totalPages: 10 },
    });
    expect(container.querySelector('.cinder-pagination__count')).toBeNull();
  });

  test('only one page button has aria-current="page"', () => {
    const { container } = render(Pagination, {
      props: { currentPage: 4, totalPages: 7 },
    });
    const currentButtons = container.querySelectorAll('[aria-current="page"]');
    expect(currentButtons.length).toBe(1);
  });

  // §Native attribute passthrough — rest spread

  test('forwards id and data-* attributes to the nav element', () => {
    const { container } = render(Pagination, {
      props: {
        currentPage: 1,
        totalPages: 5,
        id: 'main-pagination',
        'data-testid': 'pagination-nav',
      },
    });
    const nav = container.querySelector('nav');
    expect(nav?.getAttribute('id')).toBe('main-pagination');
    expect(nav?.getAttribute('data-testid')).toBe('pagination-nav');
  });

  test('default aria-label="Pagination" is present when consumer does not override it', () => {
    const { container } = render(Pagination, {
      props: { currentPage: 1, totalPages: 5 },
    });
    const nav = container.querySelector('nav');
    expect(nav?.getAttribute('aria-label')).toBe('Pagination');
  });

  test('consumer can override aria-label via rest spread', () => {
    const { container } = render(Pagination, {
      props: { currentPage: 1, totalPages: 5, 'aria-label': 'Search results pages' },
    });
    const nav = container.querySelector('nav');
    expect(nav?.getAttribute('aria-label')).toBe('Search results pages');
  });

  test('unknown total first page disables previous and enables next when provided', async () => {
    let currentPage = 1;
    const { container } = render(Pagination, {
      props: {
        get currentPage() {
          return currentPage;
        },
        set currentPage(value: number) {
          currentPage = value;
        },
        hasPreviousPage: false,
        hasNextPage: true,
      },
    });

    const previousButton = container.querySelector(
      'button[aria-label="Go to previous page"]',
    ) as HTMLButtonElement;
    const nextButton = container.querySelector(
      'button[aria-label="Go to next page"]',
    ) as HTMLButtonElement;
    const currentPageIndicator = container.querySelector('[aria-current="page"]');

    expect(previousButton.hasAttribute('disabled')).toBe(true);
    expect(nextButton.hasAttribute('disabled')).toBe(false);
    expect(currentPageIndicator?.textContent?.trim()).toBe('1');

    await fireEvent.click(nextButton);
    expect(currentPage).toBe(2);
  });

  test('unknown total keeps previous disabled at the lower page bound', async () => {
    let currentPage = 1;
    const { container } = render(Pagination, {
      props: {
        get currentPage() {
          return currentPage;
        },
        set currentPage(value: number) {
          currentPage = value;
        },
        hasPreviousPage: true,
      },
    });

    const previousButton = container.querySelector(
      'button[aria-label="Go to previous page"]',
    ) as HTMLButtonElement;

    expect(previousButton.hasAttribute('disabled')).toBe(true);
    await fireEvent.click(previousButton);
    expect(currentPage).toBe(1);
  });

  test('unknown total middle page enables previous and next', async () => {
    let currentPage = 4;
    const { container } = render(Pagination, {
      props: {
        get currentPage() {
          return currentPage;
        },
        set currentPage(value: number) {
          currentPage = value;
        },
        hasPreviousPage: true,
        hasNextPage: true,
      },
    });

    const previousButton = container.querySelector(
      'button[aria-label="Go to previous page"]',
    ) as HTMLButtonElement;
    const nextButton = container.querySelector(
      'button[aria-label="Go to next page"]',
    ) as HTMLButtonElement;

    expect(previousButton.hasAttribute('disabled')).toBe(false);
    expect(nextButton.hasAttribute('disabled')).toBe(false);

    await fireEvent.click(previousButton);
    expect(currentPage).toBe(3);
  });

  test('unknown total last-known page disables next without requiring a final page number', () => {
    const { container } = render(Pagination, {
      props: {
        currentPage: 7,
        hasPreviousPage: true,
        hasNextPage: false,
      },
    });

    const nextButton = container.querySelector('button[aria-label="Go to next page"]');
    const pageButtons = container.querySelectorAll('.cinder-pagination__page');

    expect(nextButton?.hasAttribute('disabled')).toBe(true);
    expect(pageButtons.length).toBe(1);
    expect(pageButtons[0]?.textContent?.trim()).toBe('7');
    expect(container.textContent).not.toContain('of');
  });

  test('unknown total keeps next disabled when next-page availability is unknown', async () => {
    let currentPage = 3;
    const { container } = render(Pagination, {
      props: {
        get currentPage() {
          return currentPage;
        },
        set currentPage(value: number) {
          currentPage = value;
        },
        hasPreviousPage: true,
      },
    });

    const nextButton = container.querySelector(
      'button[aria-label="Go to next page"]',
    ) as HTMLButtonElement;

    expect(nextButton.hasAttribute('disabled')).toBe(true);
    await fireEvent.click(nextButton);
    expect(currentPage).toBe(3);
  });

  test('known total behavior ignores direction flags and keeps numbered pages', () => {
    const { container } = render(Pagination, {
      props: {
        currentPage: 3,
        totalPages: 5,
        hasPreviousPage: false,
        hasNextPage: false,
      },
    });

    const previousButton = container.querySelector('button[aria-label="Go to previous page"]');
    const nextButton = container.querySelector('button[aria-label="Go to next page"]');
    const pageButtons = Array.from(container.querySelectorAll('.cinder-pagination__page')).map(
      (button) => button.textContent?.trim(),
    );

    expect(previousButton?.hasAttribute('disabled')).toBe(false);
    expect(nextButton?.hasAttribute('disabled')).toBe(false);
    expect(pageButtons).toEqual(['1', '2', '3', '4', '5']);
  });
});
