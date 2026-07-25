/// <reference lib="dom" />
import { join } from 'node:path';

import { afterEach, describe, expect, jest, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';
import { renderToServerHtml } from '../../test/server-render.ts';

setupHappyDom();

const CAROUSEL_SOURCE = join(import.meta.dir, 'carousel.svelte');

const { cleanup, fireEvent, render, waitFor } = await import('@testing-library/svelte');
const { default: Carousel } = await import('./carousel.svelte');

function installMatchMediaMock(matches: boolean) {
  const originalMatchMedia = window.matchMedia;
  window.matchMedia = ((query: string) =>
    ({
      matches,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => true,
    }) as MediaQueryList) as typeof window.matchMedia;
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

describe('Carousel', () => {
  test('does not capture pointerdown from a slide link', async () => {
    const linkedSlides = [{ ...slides[0]!, href: '/details' }, ...slides.slice(1)];
    const { container } = render(Carousel, { slides: linkedSlides });
    const viewport = container.querySelector('.cinder-carousel__viewport') as HTMLElement;
    const link = container.querySelector('.cinder-carousel__link') as HTMLAnchorElement;
    const setPointerCapture = jest.fn();
    Object.defineProperty(viewport, 'setPointerCapture', {
      configurable: true,
      value: setPointerCapture,
    });

    await fireEvent.pointerDown(link, { pointerId: 7 });
    await fireEvent.pointerUp(window, { pointerId: 7 });

    expect(setPointerCapture).not.toHaveBeenCalled();
  });

  test('allows nonadjacent programmatic navigation to pass intermediate snap points', async () => {
    const css = await Bun.file(new URL('./carousel.css', import.meta.url)).text();
    expect(css).not.toContain('scroll-snap-stop: always');

    const { container } = render(Carousel, { slides });
    const root = container.querySelector('.cinder-carousel') as HTMLElement;
    const viewport = container.querySelector('.cinder-carousel__viewport') as HTMLElement;
    const slideElements = [...viewport.children] as HTMLElement[];
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

  test('server-renders a nonzero active slide at the initial scroll position', async () => {
    const html = await renderToServerHtml(CAROUSEL_SOURCE, { slides, activeIndex: 2 });
    const document = new DOMParser().parseFromString(html, 'text/html');
    const articles = [...document.querySelectorAll<HTMLElement>('article.cinder-carousel__slide')];

    expect(articles[2]?.style.order).toBe('0');
    expect(articles[2]?.getAttribute('aria-hidden')).toBeNull();
    expect(articles[2]?.hasAttribute('inert')).toBe(false);
    expect(articles[0]?.style.order).toBe('1');
  });

  test('treats a one-pixel viewport border as aligned', async () => {
    const { container, rerender: rerenderCarousel } = render(Carousel, { slides });
    const viewport = container.querySelector('.cinder-carousel__viewport') as HTMLElement;
    const slide = viewport.children[0] as HTMLElement;
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

  test('realigns after the ordered slide identities change', async () => {
    const { container, rerender: rerenderCarousel } = render(Carousel, { slides });
    const viewport = container.querySelector('.cinder-carousel__viewport') as HTMLElement;
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
    await waitFor(() => expect(scrollTo).toHaveBeenCalled());
  });

  test('reconciles the active slide when a pointer takes over a pending scroll', async () => {
    const { container } = render(Carousel, { slides });
    const viewport = container.querySelector('.cinder-carousel__viewport') as HTMLElement;
    const slideElements = [...viewport.children] as HTMLElement[];
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
    await fireEvent.pointerDown(viewport);
    await fireEvent.scroll(viewport);

    expect(slideElements[0]?.getAttribute('aria-hidden')).toBeNull();
    expect(slideElements[0]?.hasAttribute('inert')).toBe(false);
  });

  test('does not start programmatic scrolling while a native drag updates the active slide', async () => {
    const { container } = render(Carousel, { slides });
    const viewport = container.querySelector('.cinder-carousel__viewport') as HTMLElement;
    const slideElements = [...viewport.children] as HTMLElement[];
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

    await fireEvent.pointerDown(viewport, { pointerId: 12 });
    await fireEvent.scroll(viewport);

    expectActiveSlide(container, 1);
    expect(scrollTo).not.toHaveBeenCalled();
  });

  test('does not clear initial alignment while the viewport is hidden', async () => {
    type ObserverCallback = (entries: ResizeObserverEntry[]) => void;
    let callback: ObserverCallback | undefined;
    class TestResizeObserver {
      constructor(next: ObserverCallback) {
        callback = next;
      }
      observe() {}
      disconnect() {}
      trigger(width: number) {
        callback?.([{ contentRect: { width } } as ResizeObserverEntry]);
      }
    }
    const originalResizeObserver = globalThis.ResizeObserver;
    Object.defineProperty(globalThis, 'ResizeObserver', {
      configurable: true,
      value: TestResizeObserver,
    });
    try {
      const { container } = render(Carousel, { slides, activeIndex: 2 });
      const viewport = container.querySelector('.cinder-carousel__viewport') as HTMLElement;
      const slideElements = [...viewport.children] as HTMLElement[];
      Object.defineProperty(viewport, 'getBoundingClientRect', {
        configurable: true,
        value: () => ({ left: 0, width: 300 }),
      });
      slideElements.forEach((slide, index) => {
        Object.defineProperty(slide, 'getBoundingClientRect', {
          configurable: true,
          value: () => ({ left: index === 2 ? 200 : 0, width: 100 }),
        });
        Object.defineProperty(slide, 'offsetLeft', { configurable: true, value: index * 100 });
      });
      callback?.([{ contentRect: { width: 300 } } as ResizeObserverEntry]);
      await waitFor(() => expect(slideElements[2]?.getAttribute('aria-hidden')).toBeNull());
      expect(slideElements[2]?.hasAttribute('inert')).toBe(false);
    } finally {
      Object.defineProperty(globalThis, 'ResizeObserver', {
        configurable: true,
        value: originalResizeObserver,
      });
    }
  });

  test('renders region semantics and first slide by default', () => {
    const { container } = render(Carousel, { slides, label: 'Highlights' });
    const root = container.querySelector('.cinder-carousel');
    expect(root?.tagName).toBe('SECTION');
    expect(root?.getAttribute('aria-roledescription')).toBe('carousel');
    expect(root?.getAttribute('aria-label')).toBe('Highlights');
    expectActiveSlide(container, 0);
  });

  test('next and previous controls change the active slide', async () => {
    const { container } = render(Carousel, { slides });
    const controls = container.querySelectorAll('.cinder-carousel__control');
    const previousButton = controls[0] as HTMLButtonElement;
    const nextButton = controls[1] as HTMLButtonElement;

    await fireEvent.click(nextButton);
    expectActiveSlide(container, 1);

    await fireEvent.click(previousButton);
    expectActiveSlide(container, 0);
  });

  test('arrow keys and home/end move between slides', async () => {
    const { container } = render(Carousel, { slides });
    const root = container.querySelector('.cinder-carousel') as HTMLElement;
    await fireEvent.keyDown(root, { key: 'End' });
    expectActiveSlide(container, 2);
    await fireEvent.keyDown(root, { key: 'Home' });
    expectActiveSlide(container, 0);
    await fireEvent.keyDown(root, { key: 'ArrowRight' });
    expect(container.textContent).toContain('Two');
  });

  test('autoplay advances slides on the configured timer', async () => {
    jest.useFakeTimers();
    const { container } = render(Carousel, { slides, autoplay: true, autoplayInterval: 100 });

    expect(container.textContent).toContain('One');
    jest.advanceTimersByTime(100);

    await waitFor(() => {
      expectActiveSlide(container, 1);
    });
  });

  test('hover and focus pause autoplay until interaction ends', async () => {
    jest.useFakeTimers();
    const { container } = render(Carousel, { slides, autoplay: true, autoplayInterval: 100 });
    const root = container.querySelector('.cinder-carousel') as HTMLElement;

    await fireEvent.mouseEnter(root);
    jest.advanceTimersByTime(250);
    expectActiveSlide(container, 0);

    await fireEvent.mouseLeave(root);
    jest.advanceTimersByTime(100);
    await waitFor(() => {
      expectActiveSlide(container, 1);
    });

    await fireEvent.focusIn(root);
    jest.advanceTimersByTime(250);
    expectActiveSlide(container, 1);

    await fireEvent.focusOut(root);
    jest.advanceTimersByTime(100);
    await waitFor(() => {
      expectActiveSlide(container, 2);
    });
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
});
