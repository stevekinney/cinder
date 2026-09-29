/// <reference lib="dom" />

import { afterEach, describe, expect, jest, test } from 'bun:test';

import { requiredInstance, setupHappyDom } from '@lostgradient/testing';

setupHappyDom();

const { cleanup, fireEvent, render, waitFor } = await import('@testing-library/svelte');
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

describe('motion state machine (settle-only writeback)', () => {
  test('does not announce a slide change until the gesture settles', async () => {
    jest.useFakeTimers();
    const { container } = render(Carousel, { slides });
    const viewport = requiredInstance(
      container.querySelector('.cinder-carousel__viewport'),
      HTMLElement,
    );
    const liveRegion = requiredInstance(container.querySelector('[aria-live]'), HTMLElement);
    const initialAnnouncement = liveRegion.textContent;
    Object.defineProperty(viewport, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ left: 0, width: 100 }),
    });
    [...viewport.children].forEach((slide, index) => {
      Object.defineProperty(slide, 'getBoundingClientRect', {
        configurable: true,
        value: () => ({ left: index === 1 ? 0 : 100, width: 100 }),
      });
    });

    await fireEvent.pointerDown(viewport, { pointerId: 90, pointerType: 'touch' });
    await fireEvent.scroll(viewport);
    await flushAnimationFrame();

    // Mid-gesture: the physically-nearest slide has changed, but nothing
    // has settled yet, so the live region must not have re-announced.
    expect(liveRegion.textContent).toBe(initialAnnouncement);

    await fireEvent.pointerUp(window, { pointerId: 90 });
    jest.advanceTimersByTime(100);
    await tick();

    expect(liveRegion.textContent).not.toBe(initialAnnouncement);
    expect(liveRegion.textContent).toContain('Slide two');
  });

  test('tracks the physically-nearest slide in the dot picker during a gesture, ahead of settle', async () => {
    jest.useFakeTimers();
    const { container } = render(Carousel, { slides });
    const viewport = requiredInstance(
      container.querySelector('.cinder-carousel__viewport'),
      HTMLElement,
    );
    const dots = container.querySelectorAll('.cinder-carousel__dot');
    Object.defineProperty(viewport, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ left: 0, width: 100 }),
    });
    [...viewport.children].forEach((slide, index) => {
      Object.defineProperty(slide, 'getBoundingClientRect', {
        configurable: true,
        value: () => ({ left: index === 2 ? 0 : 100, width: 100 }),
      });
    });

    await fireEvent.pointerDown(viewport, { pointerId: 91, pointerType: 'touch' });
    await fireEvent.scroll(viewport);
    await flushAnimationFrame();

    // Mid-gesture: the dot picker cosmetically tracks the nearest slide
    // even though `activeIndex` (and the article's aria-hidden/inert state)
    // has not written back yet.
    expect(dots[2]?.getAttribute('aria-current')).toBe('true');
    expectActiveSlide(container, 0);

    await fireEvent.pointerUp(window, { pointerId: 91 });
    jest.advanceTimersByTime(100);
    await tick();

    expectActiveSlide(container, 2);
    await waitFor(() => expect(dots[2]?.getAttribute('aria-current')).toBe('true'));
  });
});
