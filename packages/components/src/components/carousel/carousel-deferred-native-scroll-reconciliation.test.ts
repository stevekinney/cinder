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

describe('Carousel — deferred native-scroll reconciliation', () => {
  test('resumes native-scroll reconciliation after a deferred external update settles', async () => {
    jest.useFakeTimers();
    const { container, rerender } = render(Carousel, { slides, activeIndex: 0 });
    const viewport = requiredInstance(
      container.querySelector('.cinder-carousel__viewport'),
      HTMLElement,
    );
    const slideElements = requiredChildren(viewport);
    Object.defineProperty(viewport, 'scrollTo', { configurable: true, value: jest.fn() });
    Object.defineProperty(viewport, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ left: 0, width: 100 }),
    });
    function alignSlide(alignedIndex: number): void {
      slideElements.forEach((slide, index) => {
        Object.defineProperty(slide, 'getBoundingClientRect', {
          configurable: true,
          value: () => ({ left: index === alignedIndex ? 0 : 100, width: 100 }),
        });
        Object.defineProperty(slide, 'offsetLeft', { configurable: true, value: index * 100 });
      });
    }

    // An external activeIndex update arrives mid-interaction, deferring reconciliation.
    alignSlide(0);
    await fireEvent.pointerDown(viewport, { pointerId: 41, pointerType: 'touch' });
    await rerender({ slides, activeIndex: 2 });
    await fireEvent.pointerUp(window, { pointerId: 41 });

    // The deferred programmatic realignment settles on the requested slide.
    alignSlide(2);
    await fireEvent.scroll(viewport);
    await flushAnimationFrame();
    expectActiveSlide(container, 2);

    alignSlide(1);
    await fireEvent.scroll(viewport);
    await flushAnimationFrame();
    jest.advanceTimersByTime(100);
    await tick();
    expectActiveSlide(container, 1);
  });
});
