/// <reference lib="dom" />
import { join } from 'node:path';

import { afterEach, describe, expect, jest, test } from 'bun:test';

import {
  prepareSvelteServerSource,
  renderSvelteOnServer,
  requiredInstance,
  setupHappyDom,
} from '@lostgradient/testing';
import { requiredChildren } from './carousel-test-helpers.ts';

setupHappyDom();

const CAROUSEL_SOURCE = join(import.meta.dir, 'carousel.svelte');
await prepareSvelteServerSource(CAROUSEL_SOURCE);

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

describe('Carousel', () => {
  test('server-renders a nonzero active slide at the initial scroll position', async () => {
    const html = await renderSvelteOnServer(CAROUSEL_SOURCE, { slides, activeIndex: 2 });
    const document = new DOMParser().parseFromString(html, 'text/html');
    const articles = [...document.querySelectorAll<HTMLElement>('article.cinder-carousel__slide')];

    expect(articles[2]?.style.order).toBe('0');
    expect(articles[2]?.getAttribute('aria-hidden')).toBeNull();
    expect(articles[2]?.hasAttribute('inert')).toBe(false);
    expect(articles[0]?.style.order).toBe('1');
    expect(articles[0]?.hasAttribute('data-cinder-collapsed')).toBe(true);
  });

  test('animates numeric wraps that are adjacent in physical order', async () => {
    const { container } = render(Carousel, { slides, activeIndex: 2, loop: true });
    const viewport = requiredInstance(
      container.querySelector('.cinder-carousel__viewport'),
      HTMLElement,
    );
    const scrollTo = jest.fn();
    Object.defineProperty(viewport, 'scrollTo', { configurable: true, value: scrollTo });
    Object.defineProperty(viewport, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ left: 0, width: 100 }),
    });
    [...viewport.children].forEach((slide, index) => {
      Object.defineProperty(slide, 'getBoundingClientRect', {
        configurable: true,
        value: () => ({ left: index === 2 ? 0 : index === 0 ? 100 : 200, width: 100 }),
      });
      Object.defineProperty(slide, 'offsetLeft', { configurable: true, value: index * 100 });
    });
    scrollTo.mockClear();
    await fireEvent.click(container.querySelectorAll('.cinder-carousel__control')[1]!);
    expect(scrollTo).toHaveBeenCalledWith({ left: 0, behavior: 'smooth' });
  });

  test('keeps interaction active until every pointer ends', async () => {
    jest.useFakeTimers();
    const { container } = render(Carousel, { slides, autoplay: true, autoplayInterval: 10 });
    const viewport = requiredInstance(
      container.querySelector('.cinder-carousel__viewport'),
      HTMLElement,
    );
    await fireEvent.pointerDown(viewport, { pointerId: 1, pointerType: 'touch' });
    await fireEvent.pointerDown(viewport, { pointerId: 2, pointerType: 'touch' });
    await fireEvent.pointerUp(window, { pointerId: 2 });
    jest.advanceTimersByTime(50);
    expectActiveSlide(container, 0);
    await fireEvent.pointerUp(window, { pointerId: 1 });
  });

  test('keeps alignment guarded when a native gesture is cancelled', async () => {
    jest.useFakeTimers();
    const { container } = render(Carousel, { slides });
    const viewport = requiredInstance(
      container.querySelector('.cinder-carousel__viewport'),
      HTMLElement,
    );
    const scrollTo = jest.fn();
    Object.defineProperty(viewport, 'scrollTo', { configurable: true, value: scrollTo });
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

    await fireEvent.pointerDown(viewport, { pointerId: 31, pointerType: 'touch' });
    await fireEvent.pointerCancel(window, { pointerId: 31 });
    expect(scrollTo).not.toHaveBeenCalled();
  });

  test('treats a one-pixel viewport border as aligned', async () => {
    const { container } = render(Carousel, { slides });
    const viewport = requiredInstance(
      container.querySelector('.cinder-carousel__viewport'),
      HTMLElement,
    );
    const slide = requiredInstance(viewport.children[0], HTMLElement);
    const scrollTo = jest.fn();
    Object.defineProperty(viewport, 'scrollTo', { configurable: true, value: scrollTo });
    Object.defineProperty(viewport, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ left: 0, width: 100 }),
    });
    Object.defineProperty(slide, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ left: 1, width: 100 }),
    });
    await fireEvent.scroll(viewport);
    expect(scrollTo).not.toHaveBeenCalled();
  });

  test('realigns immediately, without collapsing the visible slide, after the ordered slide identities change', async () => {
    const { container, rerender: rerenderCarousel } = render(Carousel, { slides });
    const viewport = requiredInstance(
      container.querySelector('.cinder-carousel__viewport'),
      HTMLElement,
    );
    const scrollTo = jest.fn();
    Object.defineProperty(viewport, 'scrollTo', { configurable: true, value: scrollTo });
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
    scrollTo.mockClear();
    await rerenderCarousel({ slides: [slides[1]!, slides[0]!, slides[2]!] });

    // The reorder leaves `activeIndex` pointing at a slide with new geometry
    // (unaligned with the viewport), so a realignment scroll is expected —
    // but it must jump immediately (no in-flight animation window) rather
    // than the smooth transition used for ordinary navigation.
    await waitFor(() =>
      expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'auto' })),
    );

    // The slide nearest the viewport's leading edge right now (the one a
    // stale `settledIndex` would otherwise miscategorize) must stay laid
    // out, not collapsed to zero block size.
    const articles = [...container.querySelectorAll('article.cinder-carousel__slide')];
    const nearestIndex = articles.findIndex(
      (article) => requiredInstance(article, HTMLElement).getBoundingClientRect().left === 0,
    );
    expect(nearestIndex).toBeGreaterThanOrEqual(0);
    expect(articles[nearestIndex]?.hasAttribute('data-cinder-collapsed')).toBe(false);
  });

  test('reconciles the active slide when a pointer takes over a pending scroll', async () => {
    jest.useFakeTimers();
    const { container } = render(Carousel, { slides });
    const viewport = requiredInstance(
      container.querySelector('.cinder-carousel__viewport'),
      HTMLElement,
    );
    const slideElements = requiredChildren(viewport);
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

    await fireEvent.click(container.querySelectorAll('.cinder-carousel__control')[1]!);
    await waitFor(() => expect(slideElements[1]?.getAttribute('aria-hidden')).toBeNull());
    Object.defineProperty(slideElements[0], 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ left: 0, width: 100 }),
    });
    Object.defineProperty(slideElements[1], 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ left: 30, width: 100 }),
    });
    await fireEvent.pointerDown(viewport, { pointerType: 'touch', pointerId: 51 });
    await fireEvent.scroll(viewport);
    await flushAnimationFrame();
    await fireEvent.pointerUp(window, { pointerId: 51 });
    // A pointer taking over hands settle-detection to the debounce fallback —
    // the reconciled slide only writes back once that gesture settles.
    jest.advanceTimersByTime(100);
    await tick();

    expect(slideElements[0]?.getAttribute('aria-hidden')).toBeNull();
    expect(slideElements[0]?.hasAttribute('inert')).toBe(false);
  });

  test('does not start programmatic scrolling while a native drag updates the active slide', async () => {
    jest.useFakeTimers();
    const { container } = render(Carousel, { slides });
    const viewport = requiredInstance(
      container.querySelector('.cinder-carousel__viewport'),
      HTMLElement,
    );
    const slideElements = requiredChildren(viewport);
    const scrollTo = jest.fn();
    Object.defineProperty(viewport, 'scrollTo', { configurable: true, value: scrollTo });
    Object.defineProperty(viewport, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ left: 0, width: 100 }),
    });
    slideElements.forEach((slide, index) => {
      Object.defineProperty(slide, 'getBoundingClientRect', {
        configurable: true,
        value: () => ({ left: index === 1 ? 0 : 100, width: 100 }),
      });
      Object.defineProperty(slide, 'offsetLeft', { configurable: true, value: index * 100 });
    });

    await fireEvent.pointerDown(viewport, { pointerId: 12, pointerType: 'touch' });
    await fireEvent.scroll(viewport);
    await flushAnimationFrame();
    await fireEvent.pointerUp(window, { pointerId: 12 });
    jest.advanceTimersByTime(100);
    await tick();

    expectActiveSlide(container, 1);
    expect(scrollTo).not.toHaveBeenCalled();
  });

  test('preserves a parent active-index update during native scrolling', async () => {
    const { container, rerender } = render(Carousel, { slides, activeIndex: 0 });
    const viewport = requiredInstance(
      container.querySelector('.cinder-carousel__viewport'),
      HTMLElement,
    );
    const slideElements = requiredChildren(viewport);
    slideElements.forEach((slide, index) => {
      Object.defineProperty(slide, 'getBoundingClientRect', {
        configurable: true,
        value: () => ({ left: index === 1 ? 0 : 100, width: 100 }),
      });
      Object.defineProperty(slide, 'offsetLeft', { configurable: true, value: index * 100 });
    });
    Object.defineProperty(viewport, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ left: 0, width: 100 }),
    });

    await fireEvent.pointerDown(viewport, { pointerId: 32, pointerType: 'touch' });
    await rerender({ slides, activeIndex: 2 });
    await fireEvent.scroll(viewport);
    await flushAnimationFrame();

    expectActiveSlide(container, 2);
    await fireEvent.pointerUp(window, { pointerId: 32 });
  });
});
