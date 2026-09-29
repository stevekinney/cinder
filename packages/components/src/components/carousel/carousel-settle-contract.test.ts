/// <reference lib="dom" />

import { afterEach, describe, expect, jest, test } from 'bun:test';

import { requiredInstance, setupHappyDom } from '@lostgradient/testing';

setupHappyDom();

const { cleanup, fireEvent, render, waitFor } = await import('@testing-library/svelte');
const { default: Carousel } = await import('./carousel.svelte');

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

function stubLinearGeometry(viewport: HTMLElement): void {
  Object.defineProperty(viewport, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({ left: 0, width: 100 }),
  });
  [...viewport.children].forEach((slide, index) => {
    Object.defineProperty(slide, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ left: index * 100, width: 100 }),
    });
    Object.defineProperty(slide, 'offsetLeft', { configurable: true, value: index * 100 });
  });
}

function stubSlideOneNearest(viewport: HTMLElement): void {
  // Everyone else sits away from the viewport's leading edge; slide 1 is
  // the only one flush with it, so it is unambiguously "nearest".
  [...viewport.children].forEach((slide, index) => {
    Object.defineProperty(slide, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ left: index === 1 ? 0 : 100, width: 100 }),
    });
  });
}

describe('settle contract', () => {
  test('settles on the nearest slide once scrolling stops', async () => {
    const { container } = render(Carousel, { slides });
    const viewport = requiredInstance(
      container.querySelector('.cinder-carousel__viewport'),
      HTMLElement,
    );
    stubLinearGeometry(viewport);
    stubSlideOneNearest(viewport);

    await fireEvent.scroll(viewport);

    await waitFor(() => expectActiveSlide(container, 1));
  });

  test('does not update the active index while the scroll gesture is still settling', async () => {
    const { container } = render(Carousel, { slides });
    const viewport = requiredInstance(
      container.querySelector('.cinder-carousel__viewport'),
      HTMLElement,
    );
    stubLinearGeometry(viewport);
    stubSlideOneNearest(viewport);

    await fireEvent.scroll(viewport);

    // Immediately after the scroll event — before any settle mechanism has
    // had a chance to run — the previously active slide is still active.
    expectActiveSlide(container, 0);
  });

  test('announces the settled slide once rather than on every intermediate scroll frame', async () => {
    jest.useFakeTimers();
    const { container } = render(Carousel, { slides });
    const viewport = requiredInstance(
      container.querySelector('.cinder-carousel__viewport'),
      HTMLElement,
    );
    stubLinearGeometry(viewport);
    const liveRegion = requiredInstance(container.querySelector('[aria-live]'), HTMLElement);
    const initialAnnouncement = liveRegion.textContent;

    // Several scroll frames fire in quick succession during a single
    // continuous gesture, all still resolving to the same nearest slide.
    await fireEvent.scroll(viewport);
    jest.advanceTimersByTime(10);
    await fireEvent.scroll(viewport);
    jest.advanceTimersByTime(10);
    await fireEvent.scroll(viewport);

    expect(liveRegion.textContent).toBe(initialAnnouncement);
  });

  test('keeps the outgoing slide non-inert until the incoming slide settles', async () => {
    const { container } = render(Carousel, { slides });
    const viewport = requiredInstance(
      container.querySelector('.cinder-carousel__viewport'),
      HTMLElement,
    );
    stubLinearGeometry(viewport);
    stubSlideOneNearest(viewport);

    await fireEvent.pointerDown(viewport, { pointerId: 91, pointerType: 'touch' });
    await fireEvent.scroll(viewport);

    // Mid-gesture: slide 0 must remain interactive even though slide 1 is
    // now the nearest slide, since settlement hasn't happened yet.
    const articles = [...container.querySelectorAll('article.cinder-carousel__slide')];
    expect(articles[0]?.hasAttribute('inert')).toBe(false);
    await fireEvent.pointerUp(window, { pointerId: 91 });
  });

  test('wraps forward to the first slide when advancing past the last slide with loop enabled', async () => {
    const { container } = render(Carousel, { slides, activeIndex: 2, loop: true });
    const controls = container.querySelectorAll('.cinder-carousel__control');
    const nextButton = requiredInstance(controls[1], HTMLButtonElement);

    await fireEvent.click(nextButton);

    expectActiveSlide(container, 0);
  });

  test('wraps backward to the last slide when reversing past the first slide with loop enabled', async () => {
    const { container } = render(Carousel, { slides, activeIndex: 0, loop: true });
    const controls = container.querySelectorAll('.cinder-carousel__control');
    const previousButton = requiredInstance(controls[0], HTMLButtonElement);

    await fireEvent.click(previousButton);

    expectActiveSlide(container, 2);
  });
});
