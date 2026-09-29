/// <reference lib="dom" />

import { afterEach, describe, expect, jest, test } from 'bun:test';

import { setupHappyDom } from '@lostgradient/testing';

setupHappyDom();

const { cleanup, render } = await import('@testing-library/svelte');
const { default: Carousel } = await import('./carousel.svelte');

afterEach(() => {
  jest.useRealTimers();
  cleanup();
});

function expectActiveSlide(container: HTMLElement, index: number): void {
  const articles = [...container.querySelectorAll('article.cinder-carousel__slide')];
  expect(articles[index]?.getAttribute('aria-hidden')).toBeNull();
  expect(articles[index]?.hasAttribute('inert')).toBe(false);
  articles.forEach((article, articleIndex) => {
    if (articleIndex !== index) expect(article.getAttribute('aria-hidden')).toBe('true');
  });
}

describe('slidesPerView', () => {
  const fiveSlides = [
    { id: 'one', label: 'One' },
    { id: 'two', label: 'Two' },
    { id: 'three', label: 'Three' },
    { id: 'four', label: 'Four' },
    { id: 'five', label: 'Five' },
  ];

  test('defaults to a single active slide, unchanged from the base contract', () => {
    const { container } = render(Carousel, { slides: fiveSlides });
    expectActiveSlide(container, 0);
  });

  test('makes a fixed number of slides active and non-inert at once', () => {
    const { container } = render(Carousel, { slides: fiveSlides, slidesPerView: 2 });
    const articles = [...container.querySelectorAll<HTMLElement>('article.cinder-carousel__slide')];

    expect(articles[0]?.getAttribute('aria-hidden')).toBeNull();
    expect(articles[0]?.hasAttribute('inert')).toBe(false);
    expect(articles[1]?.getAttribute('aria-hidden')).toBeNull();
    expect(articles[1]?.hasAttribute('inert')).toBe(false);
    expect(articles[2]?.getAttribute('aria-hidden')).toBe('true');
    expect(articles[2]?.hasAttribute('inert')).toBe(true);
  });

  test('rounds a fractional slidesPerView up — a peeking slide is fully interactive', () => {
    const { container } = render(Carousel, { slides: fiveSlides, slidesPerView: 2.5 });
    const articles = [...container.querySelectorAll<HTMLElement>('article.cinder-carousel__slide')];

    expect(articles[0]?.hasAttribute('inert')).toBe(false);
    expect(articles[1]?.hasAttribute('inert')).toBe(false);
    expect(articles[2]?.hasAttribute('inert')).toBe(false);
    expect(articles[3]?.hasAttribute('inert')).toBe(true);
  });

  test('clamps the active range at the end of the deck rather than overrunning it', () => {
    const { container } = render(Carousel, {
      slides: fiveSlides,
      slidesPerView: 2,
      activeIndex: 4,
    });
    const articles = [...container.querySelectorAll<HTMLElement>('article.cinder-carousel__slide')];

    expect(articles[4]?.hasAttribute('inert')).toBe(false);
    expect(articles[3]?.hasAttribute('inert')).toBe(true);
  });

  test("'auto' behaves like a single active slide", () => {
    const { container } = render(Carousel, { slides: fiveSlides, slidesPerView: 'auto' });
    expectActiveSlide(container, 0);
  });

  test('announces a slide range instead of a single labelled slide', () => {
    const { container } = render(Carousel, { slides: fiveSlides, slidesPerView: 2 });
    const liveRegion = container.querySelector('[aria-live]');
    expect(liveRegion?.textContent).toBe('Slides 1–2 of 5');
  });

  test('the Next control disables once the active range reaches the last slide', () => {
    const { container } = render(Carousel, {
      slides: fiveSlides,
      slidesPerView: 2,
      activeIndex: 3,
    });
    const controls = container.querySelectorAll<HTMLButtonElement>('.cinder-carousel__control');

    // Range is [3,4] — already at the end (index 4 is the last slide).
    expect(controls[1]?.disabled).toBe(true);
  });

  test('collapses to the byte-identical range logic at slidesPerView 1', () => {
    const { container: multiView } = render(Carousel, {
      slides: fiveSlides,
      slidesPerView: 1,
      activeIndex: 2,
    });
    const { container: base } = render(Carousel, { slides: fiveSlides, activeIndex: 2 });

    expectActiveSlide(multiView, 2);
    expectActiveSlide(base, 2);
  });

  test('is mutually exclusive with loop: loop is ignored and a dev warning fires', () => {
    const warnSpy = jest.fn();
    const original = console.warn;
    console.warn = warnSpy;
    try {
      const { container } = render(Carousel, {
        slides: fiveSlides,
        slidesPerView: 2,
        loop: true,
        activeIndex: 3,
      });
      const controls = container.querySelectorAll<HTMLButtonElement>('.cinder-carousel__control');

      // loop is ignored: the range-based end-of-deck clamp still applies.
      expect(controls[1]?.disabled).toBe(true);
      expect(warnSpy).toHaveBeenCalled();
      expect(warnSpy.mock.calls[0]?.[0]).toContain('slidesPerView');
    } finally {
      console.warn = original;
    }
  });

  test('does not warn when loop is set without slidesPerView', () => {
    const warnSpy = jest.fn();
    const original = console.warn;
    console.warn = warnSpy;
    try {
      render(Carousel, { slides: fiveSlides, loop: true });
      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      console.warn = original;
    }
  });
});
