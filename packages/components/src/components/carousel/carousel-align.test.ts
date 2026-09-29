/// <reference lib="dom" />

import { afterEach, describe, expect, jest, test } from 'bun:test';

import { requiredInstance, setupHappyDom } from '@lostgradient/testing';
import { requiredChildren } from './carousel-test-helpers.ts';

setupHappyDom();

const { cleanup, fireEvent, render } = await import('@testing-library/svelte');
const { tick } = await import('svelte');
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

function flushAnimationFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function stubGeometry(viewport: HTMLElement, slideElements: HTMLElement[]): void {
  Object.defineProperty(viewport, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({ left: 0, width: 100 }),
  });
  slideElements.forEach((slide, index) => {
    Object.defineProperty(slide, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ left: index * 100, width: 100 }),
    });
    Object.defineProperty(slide, 'offsetLeft', { configurable: true, value: index * 100 });
  });
}

describe('align', () => {
  test("defaults to 'start': scrolls the slide's left edge to the viewport's left edge", async () => {
    const { container } = render(Carousel, { slides });
    const viewport = requiredInstance(
      container.querySelector('.cinder-carousel__viewport'),
      HTMLElement,
    );
    const slideElements = requiredChildren(viewport);
    stubGeometry(viewport, slideElements);
    const scrollTo = jest.fn();
    Object.defineProperty(viewport, 'scrollTo', { configurable: true, value: scrollTo });

    await fireEvent.click(container.querySelectorAll('.cinder-carousel__dot')[1]!);

    expect(scrollTo).toHaveBeenCalledWith({ left: 100, behavior: 'smooth' });
  });

  test("'center': scrolls so the slide's center aligns with the viewport's center", async () => {
    const { container } = render(Carousel, { slides, align: 'center' });
    const viewport = requiredInstance(
      container.querySelector('.cinder-carousel__viewport'),
      HTMLElement,
    );
    const slideElements = requiredChildren(viewport);
    // Viewport is 300px wide. `offsetLeft` (the layout position the
    // destination is computed from) is unaffected by the current scroll
    // position, but the *current* rect below is deliberately still at
    // slide 0's un-scrolled position — not yet centered — so the
    // already-aligned early return doesn't short-circuit the scroll.
    Object.defineProperty(viewport, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ left: 0, width: 300 }),
    });
    slideElements.forEach((slide, index) => {
      Object.defineProperty(slide, 'getBoundingClientRect', {
        configurable: true,
        value: () => ({ left: 0, width: 100 }),
      });
      Object.defineProperty(slide, 'offsetLeft', { configurable: true, value: index * 100 });
    });
    const scrollTo = jest.fn();
    Object.defineProperty(viewport, 'scrollTo', { configurable: true, value: scrollTo });

    await fireEvent.click(container.querySelectorAll('.cinder-carousel__dot')[1]!);

    // offsetLeft(100) - (viewportWidth(300) - slideWidth(100)) / 2 = 100 - 100 = 0.
    expect(scrollTo).toHaveBeenCalledWith({ left: 0, behavior: 'smooth' });
  });

  test("'center': nearestVisibleSlideIndex compares slide centers against the viewport's center", async () => {
    jest.useFakeTimers();
    const { container } = render(Carousel, { slides, align: 'center' });
    const viewport = requiredInstance(
      container.querySelector('.cinder-carousel__viewport'),
      HTMLElement,
    );
    // 300px viewport; slide 1 (100px wide) is centered flush on the viewport's
    // center (150) — its center sits at 150, while slides 0 and 2 sit further away.
    Object.defineProperty(viewport, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ left: 0, width: 300 }),
    });
    [...viewport.children].forEach((slide, index) => {
      Object.defineProperty(slide, 'getBoundingClientRect', {
        configurable: true,
        value: () => ({ left: index === 1 ? 100 : index === 0 ? -200 : 400, width: 100 }),
      });
    });

    await fireEvent.scroll(viewport);
    await flushAnimationFrame();
    jest.advanceTimersByTime(100);
    await tick();

    expectActiveSlide(container, 1);
  });

  test("sets data-cinder-align='center' only when align is 'center'", () => {
    const { container: centered } = render(Carousel, { slides, align: 'center' });
    const { container: start } = render(Carousel, { slides });

    expect(centered.querySelector('.cinder-carousel')?.getAttribute('data-cinder-align')).toBe(
      'center',
    );
    expect(start.querySelector('.cinder-carousel')?.getAttribute('data-cinder-align')).toBeNull();
  });
});
