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

describe('Carousel', () => {
  test('does not capture pointerdown from a slide link', async () => {
    const linkedSlides = [{ ...slides[0]!, href: '/details' }, ...slides.slice(1)];
    const { container } = render(Carousel, { slides: linkedSlides });
    const viewport = requiredInstance(
      container.querySelector('.cinder-carousel__viewport'),
      HTMLElement,
    );
    const link = requiredInstance(
      container.querySelector('.cinder-carousel__link'),
      HTMLAnchorElement,
    );
    const setPointerCapture = jest.fn();
    Object.defineProperty(viewport, 'setPointerCapture', {
      configurable: true,
      value: setPointerCapture,
    });

    await fireEvent.pointerDown(link, { pointerId: 7 });
    await fireEvent.pointerUp(window, { pointerId: 7 });

    expect(setPointerCapture).not.toHaveBeenCalled();
  });

  test('does not widen the interaction-layout window for a mouse press', async () => {
    const linkedSlides = [{ ...slides[0]!, href: '/details' }, ...slides.slice(1)];
    const { container } = render(Carousel, { slides: linkedSlides });
    const viewport = requiredInstance(
      container.querySelector('.cinder-carousel__viewport'),
      HTMLElement,
    );
    const link = requiredInstance(
      container.querySelector('.cinder-carousel__link'),
      HTMLAnchorElement,
    );
    const neighbor = requiredInstance(viewport.children[1], HTMLElement);

    expect(neighbor.hasAttribute('data-cinder-collapsed')).toBe(true);

    // A mouse press on the active slide's link bubbles a pointerdown to the
    // viewport, but mice have no drag recognizer here — it must not widen
    // the layout window and pop the neighbor's height in for the click.
    await fireEvent.pointerDown(link, { pointerId: 71, pointerType: 'mouse' });

    expect(neighbor.hasAttribute('data-cinder-collapsed')).toBe(true);
    await fireEvent.pointerUp(window, { pointerId: 71 });
  });

  test('does not widen the interaction-layout window for a touch tap that never scrolls', async () => {
    const linkedSlides = [{ ...slides[0]!, href: '/details' }, ...slides.slice(1)];
    const { container } = render(Carousel, { slides: linkedSlides });
    const viewport = requiredInstance(
      container.querySelector('.cinder-carousel__viewport'),
      HTMLElement,
    );
    const link = requiredInstance(
      container.querySelector('.cinder-carousel__link'),
      HTMLAnchorElement,
    );
    const neighbor = requiredInstance(viewport.children[1], HTMLElement);

    expect(neighbor.hasAttribute('data-cinder-collapsed')).toBe(true);

    // While the touch pointer is held down but hasn't caused any scroll
    // yet, the layout window must stay collapsed — it should only widen
    // once a pan actually starts moving the track.
    await fireEvent.pointerDown(link, { pointerId: 72, pointerType: 'touch' });

    expect(neighbor.hasAttribute('data-cinder-collapsed')).toBe(true);
    await fireEvent.pointerUp(window, { pointerId: 72 });
  });

  test('keeps autoplay paused until a cancelled native gesture settles', async () => {
    jest.useFakeTimers();
    const { container } = render(Carousel, {
      slides,
      autoplay: true,
      autoplayInterval: 50,
    });
    const viewport = requiredInstance(
      container.querySelector('.cinder-carousel__viewport'),
      HTMLElement,
    );
    await tick();

    await fireEvent.pointerDown(viewport, { pointerId: 73, pointerType: 'touch' });
    await fireEvent.pointerCancel(window, { pointerId: 73 });

    // The cancelled gesture owns native scrolling until the debounce expires;
    // autoplay must not move the active slide during that window.
    jest.advanceTimersByTime(99);
    expectActiveSlide(container, 0);

    // Once native scrolling settles, autoplay is allowed to resume. The
    // additional interval is the discriminating signal that settlement ran.
    jest.advanceTimersByTime(1);
    await tick();
    jest.advanceTimersByTime(50);
    await tick();
    expectActiveSlide(container, 1);
  });

  test('keeps interaction active while another pointer remains down', async () => {
    jest.useFakeTimers();
    const { container } = render(Carousel, { slides, autoplay: true, autoplayInterval: 10 });
    const viewport = requiredInstance(
      container.querySelector('.cinder-carousel__viewport'),
      HTMLElement,
    );
    const liveRegion = container.querySelector('[aria-live]');

    await fireEvent.pointerDown(viewport, { pointerId: 74, pointerType: 'touch' });
    await fireEvent.pointerDown(viewport, { pointerId: 75, pointerType: 'touch' });
    await fireEvent.pointerUp(window, { pointerId: 74 });
    jest.advanceTimersByTime(100);

    expect(liveRegion?.getAttribute('aria-live')).toBe('polite');
    await fireEvent.pointerUp(window, { pointerId: 75 });
  });

  test('resumes native-scroll settling when blur releases a tracked pointer', async () => {
    jest.useFakeTimers();
    const { container } = render(Carousel, { slides });
    const viewport = requiredInstance(
      container.querySelector('.cinder-carousel__viewport'),
      HTMLElement,
    );
    const neighbor = requiredInstance(viewport.children[1], HTMLElement);
    await tick();

    await fireEvent.pointerDown(viewport, { pointerId: 76, pointerType: 'touch' });
    await fireEvent.scroll(viewport);
    jest.advanceTimersByTime(100);
    await fireEvent.blur(window);
    jest.advanceTimersByTime(100);
    await tick();

    expect(neighbor.hasAttribute('data-cinder-collapsed')).toBe(true);
  });

  test('allows nonadjacent programmatic navigation to pass intermediate snap points', async () => {
    const css = await Bun.file(new URL('./carousel.css', import.meta.url)).text();
    expect(css).not.toContain('scroll-snap-stop: always');

    const { container } = render(Carousel, { slides });
    const root = requiredInstance(container.querySelector('.cinder-carousel'), HTMLElement);
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

    await fireEvent.keyDown(root, { key: 'End' });

    expectActiveSlide(container, 2);
    expect(scrollTo).toHaveBeenCalledWith({ left: 200, behavior: 'smooth' });
  });

  test('keeps every intermediate slide laid out during distant navigation', async () => {
    const distantSlides = [
      ...slides,
      { id: 'four', label: 'Four', description: 'Fourth' },
      { id: 'five', label: 'Five', description: 'Fifth' },
    ];
    const { container } = render(Carousel, { slides: distantSlides });
    const root = requiredInstance(container.querySelector('.cinder-carousel'), HTMLElement);
    const viewport = requiredInstance(
      container.querySelector('.cinder-carousel__viewport'),
      HTMLElement,
    );
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
    await fireEvent.keyDown(root, { key: 'End' });

    expect(
      [...viewport.children]
        .slice(1, 4)
        .every((slide) => !slide.hasAttribute('data-cinder-collapsed')),
    ).toBe(true);
  });

  test('keeps physical neighbors laid out when the initial slide is rotated', async () => {
    const { container } = render(Carousel, { slides, activeIndex: 2 });
    const viewport = requiredInstance(
      container.querySelector('.cinder-carousel__viewport'),
      HTMLElement,
    );

    await fireEvent.pointerDown(viewport, { pointerId: 21, pointerType: 'touch' });
    await fireEvent.scroll(viewport);

    expect(viewport.children[0]?.hasAttribute('data-cinder-collapsed')).toBe(false);
    expect(viewport.children[1]?.hasAttribute('data-cinder-collapsed')).toBe(true);
    await fireEvent.pointerUp(window, { pointerId: 21 });
  });

  test('keeps the visible slide laid out when smooth navigation is retargeted', async () => {
    const retargetSlides = [
      ...slides,
      { id: 'four', label: 'Four', description: 'Fourth' },
      { id: 'five', label: 'Five', description: 'Fifth' },
    ];
    const { container } = render(Carousel, { slides: retargetSlides });
    const viewport = requiredInstance(
      container.querySelector('.cinder-carousel__viewport'),
      HTMLElement,
    );
    let visibleIndex = 3;
    Object.defineProperty(viewport, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ left: 0, width: 100 }),
    });
    [...viewport.children].forEach((slide, index) => {
      Object.defineProperty(slide, 'getBoundingClientRect', {
        configurable: true,
        value: () => ({ left: (index - visibleIndex) * 100, width: 100 }),
      });
      Object.defineProperty(slide, 'offsetLeft', { configurable: true, value: index * 100 });
    });

    const dots = container.querySelectorAll('.cinder-carousel__dot');
    await fireEvent.click(dots[4]!);
    await fireEvent.click(dots[1]!);

    expect(viewport.children[3]?.hasAttribute('data-cinder-collapsed')).toBe(false);
  });

  test('realigns the active slide when an ancestor direction changes', async () => {
    const { container } = render(Carousel, { slides, activeIndex: 1 });
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
    const root = requiredInstance(container.querySelector('.cinder-carousel'), HTMLElement);
    root.setAttribute('dir', 'rtl');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(scrollTo).toHaveBeenCalledWith({ left: 100, behavior: 'auto' });
  });
});
