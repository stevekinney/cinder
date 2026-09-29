/// <reference lib="dom" />

import { afterEach, describe, expect, jest, test } from 'bun:test';

import { requiredInstance, setupHappyDom } from '@lostgradient/testing';

setupHappyDom();

const { cleanup, fireEvent, render } = await import('@testing-library/svelte');
const { default: CarouselSlideSnippetFixture } =
  await import('../../test/fixtures/carousel-slide-snippet-fixture.svelte');

afterEach(() => {
  jest.useRealTimers();
  cleanup();
});

const slides = [
  { id: 'one', label: 'Slide one', title: 'One', description: 'First' },
  { id: 'two', label: 'Slide two', title: 'Two', description: 'Second' },
  { id: 'three', label: 'Slide three', title: 'Three', description: 'Third' },
];

function expectActiveSlide(container: HTMLElement, index: number): void {
  const articles = [...container.querySelectorAll('article.cinder-carousel__slide')];
  expect(articles[index]?.getAttribute('aria-hidden')).toBeNull();
  expect(articles[index]?.hasAttribute('inert')).toBe(false);
  articles.forEach((article, articleIndex) => {
    if (articleIndex !== index) expect(article.getAttribute('aria-hidden')).toBe('true');
  });
}

describe('slide snippet', () => {
  test('renders inside the slide article, replacing the built-in body', () => {
    const { container } = render(CarouselSlideSnippetFixture, { slides });

    const activeArticle = container.querySelector('article.cinder-carousel__slide');
    expect(
      activeArticle?.querySelector('.carousel-slide-snippet-fixture__body')?.textContent,
    ).toContain('Slide one');
    expect(container.querySelector('.cinder-carousel__title')).toBeNull();
    expect(container.querySelector('.cinder-carousel__description')).toBeNull();
  });

  test('receives the slide index and active state', () => {
    const { container } = render(CarouselSlideSnippetFixture, { slides });

    expect(container.querySelector('[data-testid="custom-slide-0"]')?.textContent).toContain(
      'active',
    );
    expect(container.querySelector('[data-testid="custom-slide-1"]')?.textContent).toContain(
      'inactive',
    );
  });

  test('still enforces the inert/aria-hidden contract on non-active slides', () => {
    const { container } = render(CarouselSlideSnippetFixture, { slides });

    expectActiveSlide(container, 0);
  });

  test('marks every slide in the visible range active, not just currentIndex, under slidesPerView', () => {
    const { container } = render(CarouselSlideSnippetFixture, { slides, slidesPerView: 2 });

    expect(container.querySelector('[data-testid="custom-slide-0"]')?.textContent).toContain(
      'active',
    );
    expect(container.querySelector('[data-testid="custom-slide-1"]')?.textContent).toContain(
      'active',
    );
    expect(container.querySelector('[data-testid="custom-slide-2"]')?.textContent).toContain(
      'inactive',
    );
  });

  test('advances which slide is active via the normal controls', async () => {
    const { container } = render(CarouselSlideSnippetFixture, { slides });
    const nextButton = requiredInstance(
      container.querySelectorAll('.cinder-carousel__control')[1],
      HTMLElement,
    );

    await fireEvent.click(nextButton);

    expectActiveSlide(container, 1);
    expect(container.querySelector('[data-testid="custom-slide-1"]')?.textContent).toContain(
      'active',
    );
  });
});
