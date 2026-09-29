/// <reference lib="dom" />

import { afterEach, describe, expect, jest, test } from 'bun:test';

import { requiredInstance, setupHappyDom } from '@lostgradient/testing';
import { requiredChildren } from './carousel-test-helpers.ts';

setupHappyDom();

const { cleanup, fireEvent, render, waitFor } = await import('@testing-library/svelte');
const { tick } = await import('svelte');
const { default: Carousel } = await import('./carousel.svelte');

function installMatchMediaMock(matches: boolean) {
  const originalMatchMedia = window.matchMedia;
  window.matchMedia = (query: string) =>
    ({
      matches,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => true,
    }) as MediaQueryList;
  return () => {
    window.matchMedia = originalMatchMedia;
  };
}

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
  test('ignores a vertical-dominant trackpad gesture with incidental deltaX', async () => {
    jest.useFakeTimers();
    const { container } = render(Carousel, { slides, autoplay: true, autoplayInterval: 10 });
    const viewport = requiredInstance(
      container.querySelector('.cinder-carousel__viewport'),
      HTMLElement,
    );
    const liveRegion = container.querySelector('[aria-live]');
    Object.defineProperty(viewport, 'scrollTo', { configurable: true, value: jest.fn() });
    Object.defineProperty(viewport, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ left: 0, width: 100 }),
    });
    [...viewport.children].forEach((slide, index) => {
      Object.defineProperty(slide, 'getBoundingClientRect', {
        configurable: true,
        value: () => ({ left: index === 1 ? 100 : 0, width: 100 }),
      });
      Object.defineProperty(slide, 'offsetLeft', { configurable: true, value: index * 100 });
    });

    jest.advanceTimersByTime(10);
    expect(liveRegion?.getAttribute('aria-live')).toBe('off');

    // A predominantly vertical trackpad scroll often carries a tiny
    // horizontal component; it must not be classified as carousel input.
    await fireEvent.wheel(viewport, { deltaX: 2, deltaY: 40 });

    expect(liveRegion?.getAttribute('aria-live')).toBe('off');
  });

  test('clears autoplay ownership when a pointer takes over', async () => {
    jest.useFakeTimers();
    const { container } = render(Carousel, { slides, autoplay: true, autoplayInterval: 10 });
    const viewport = requiredInstance(
      container.querySelector('.cinder-carousel__viewport'),
      HTMLElement,
    );
    const liveRegion = container.querySelector('[aria-live]');

    jest.advanceTimersByTime(10);
    await fireEvent.pointerDown(viewport, { pointerId: 1, pointerType: 'touch' });

    expect(liveRegion?.getAttribute('aria-live')).toBe('polite');
  });

  test('preserves a pending programmatic destination across an unrelated window blur', async () => {
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
        value: () => ({ left: index * 100, width: 100 }),
      });
      Object.defineProperty(slide, 'offsetLeft', { configurable: true, value: index * 100 });
    });

    await fireEvent.click(container.querySelectorAll('.cinder-carousel__control')[1]!);
    await waitFor(() => expect(scrollTo).toHaveBeenCalled());
    expectActiveSlide(container, 1);

    // A blur with no pointer interaction in progress — e.g. the user
    // focused browser chrome while the smooth transition above is still
    // animating — must not cancel the pending destination.
    window.dispatchEvent(new window.Event('blur'));

    // An intermediate scroll frame mid-animation, not yet at the
    // destination slide, must not be treated as native input that
    // overwrites the requested destination.
    Object.defineProperty(slideElements[0], 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ left: -40, width: 100 }),
    });
    await fireEvent.scroll(viewport);
    await flushAnimationFrame();

    expectActiveSlide(container, 1);
  });

  test('hover pauses autoplay until interaction ends, while focus requires explicit play', async () => {
    jest.useFakeTimers();
    const { container } = render(Carousel, { slides, autoplay: true, autoplayInterval: 100 });
    const root = requiredInstance(container.querySelector('.cinder-carousel'), HTMLElement);
    const rotationButton = requiredInstance(
      container.querySelector('.cinder-carousel__control--pause'),
      HTMLButtonElement,
    );
    await tick();

    await fireEvent.mouseEnter(root);
    jest.advanceTimersByTime(250);
    expectActiveSlide(container, 0);

    await fireEvent.mouseLeave(root);
    await tick();
    jest.advanceTimersByTime(100);
    await tick();
    expectActiveSlide(container, 1);

    await fireEvent.focusIn(root);
    jest.advanceTimersByTime(250);
    expectActiveSlide(container, 1);

    await fireEvent.focusOut(root);
    jest.advanceTimersByTime(250);
    await tick();
    expectActiveSlide(container, 1);

    rotationButton.focus();
    await fireEvent.click(rotationButton);
    await tick();
    jest.advanceTimersByTime(100);
    await tick();
    expectActiveSlide(container, 2);
  });

  test('reduced-motion preference disables autoplay', async () => {
    jest.useFakeTimers();
    const restoreMatchMedia = installMatchMediaMock(true);
    try {
      const { container } = render(Carousel, { slides, autoplay: true, autoplayInterval: 100 });

      jest.advanceTimersByTime(300);

      await waitFor(() => {
        expectActiveSlide(container, 0);
      });
    } finally {
      restoreMatchMedia();
    }
  });

  test('reduced motion hides the autoplay rotation control entirely, not merely its behavior', () => {
    // Not just "does not advance" (covered above) — the control itself must
    // not exist. A visible Play/Pause toggle for rotation that reduced motion
    // has already disabled would be a lie: nothing it does can start rotation
    // running again.
    const restoreMatchMedia = installMatchMediaMock(true);
    try {
      const { container } = render(Carousel, { slides, autoplay: true, autoplayInterval: 100 });
      expect(container.querySelector('.cinder-carousel__control--pause')).toBeNull();
    } finally {
      restoreMatchMedia();
    }
  });

  // Characterization tests (Phase 0 of the blossom-carousel gap-closing plan).
  // These pin the *contract* — what settles, when the index updates, when the
  // outgoing slide stops being interactive, and the current always-on loop
  // behavior — rather than the debounce implementation, so a settle-detection
  // rewrite (native `scrollend`, Phase 2) can land without rewriting these.
});
