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

function flushAnimationFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
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

  test('does not widen the interaction-layout window for a mouse press', async () => {
    const linkedSlides = [{ ...slides[0]!, href: '/details' }, ...slides.slice(1)];
    const { container } = render(Carousel, { slides: linkedSlides });
    const viewport = container.querySelector('.cinder-carousel__viewport') as HTMLElement;
    const link = container.querySelector('.cinder-carousel__link') as HTMLAnchorElement;
    const neighbor = viewport.children[1] as HTMLElement;

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
    const viewport = container.querySelector('.cinder-carousel__viewport') as HTMLElement;
    const link = container.querySelector('.cinder-carousel__link') as HTMLAnchorElement;
    const neighbor = viewport.children[1] as HTMLElement;

    expect(neighbor.hasAttribute('data-cinder-collapsed')).toBe(true);

    // While the touch pointer is held down but hasn't caused any scroll
    // yet, the layout window must stay collapsed — it should only widen
    // once a pan actually starts moving the track.
    await fireEvent.pointerDown(link, { pointerId: 72, pointerType: 'touch' });

    expect(neighbor.hasAttribute('data-cinder-collapsed')).toBe(true);
    await fireEvent.pointerUp(window, { pointerId: 72 });
  });

  test('settles a cancelled native gesture after the scroll-end debounce', async () => {
    jest.useFakeTimers();
    const { container } = render(Carousel, { slides });
    const viewport = container.querySelector('.cinder-carousel__viewport') as HTMLElement;
    const neighbor = viewport.children[1] as HTMLElement;

    await fireEvent.pointerDown(viewport, { pointerId: 73, pointerType: 'touch' });
    await fireEvent.pointerCancel(window, { pointerId: 73 });

    // pointercancel terminates the browser pointer stream, so native-scroll
    // ownership must settle from the scroll-end debounce rather than waiting
    // for a pointerup that will never arrive.
    jest.advanceTimersByTime(100);
    expect(neighbor.hasAttribute('data-cinder-collapsed')).toBe(true);
  });

  test('keeps interaction active while another pointer remains down', async () => {
    jest.useFakeTimers();
    const { container } = render(Carousel, { slides, autoplay: true, autoplayInterval: 10 });
    const viewport = container.querySelector('.cinder-carousel__viewport') as HTMLElement;
    const liveRegion = container.querySelector('[aria-live]');

    await fireEvent.pointerDown(viewport, { pointerId: 74, pointerType: 'touch' });
    await fireEvent.pointerDown(viewport, { pointerId: 75, pointerType: 'touch' });
    await fireEvent.pointerUp(window, { pointerId: 74 });
    jest.advanceTimersByTime(100);

    expect(liveRegion?.getAttribute('aria-live')).toBe('polite');
    await fireEvent.pointerUp(window, { pointerId: 75 });
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

  test('keeps every intermediate slide laid out during distant navigation', async () => {
    const distantSlides = [
      ...slides,
      { id: 'four', label: 'Four', description: 'Fourth' },
      { id: 'five', label: 'Five', description: 'Fifth' },
    ];
    const { container } = render(Carousel, { slides: distantSlides });
    const root = container.querySelector('.cinder-carousel') as HTMLElement;
    const viewport = container.querySelector('.cinder-carousel__viewport') as HTMLElement;
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
    const viewport = container.querySelector('.cinder-carousel__viewport') as HTMLElement;

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
    const viewport = container.querySelector('.cinder-carousel__viewport') as HTMLElement;
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
    const root = container.querySelector('.cinder-carousel') as HTMLElement;
    root.setAttribute('dir', 'rtl');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(scrollTo).toHaveBeenCalledWith({ left: 100, behavior: 'auto' });
  });

  test('server-renders a nonzero active slide at the initial scroll position', async () => {
    const html = await renderToServerHtml(CAROUSEL_SOURCE, { slides, activeIndex: 2 });
    const document = new DOMParser().parseFromString(html, 'text/html');
    const articles = [...document.querySelectorAll<HTMLElement>('article.cinder-carousel__slide')];

    expect(articles[2]?.style.order).toBe('0');
    expect(articles[2]?.getAttribute('aria-hidden')).toBeNull();
    expect(articles[2]?.hasAttribute('inert')).toBe(false);
    expect(articles[0]?.style.order).toBe('1');
    expect(articles[0]?.hasAttribute('data-cinder-collapsed')).toBe(true);
  });

  test('animates numeric wraps that are adjacent in physical order', async () => {
    const { container } = render(Carousel, { slides, activeIndex: 2 });
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
    const viewport = container.querySelector('.cinder-carousel__viewport') as HTMLElement;
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

    await fireEvent.pointerDown(viewport, { pointerId: 31, pointerType: 'touch' });
    await fireEvent.pointerCancel(window, { pointerId: 31 });
    expect(scrollTo).not.toHaveBeenCalled();
  });

  test('treats a one-pixel viewport border as aligned', async () => {
    const { container } = render(Carousel, { slides });
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

  test('realigns immediately, without collapsing the visible slide, after the ordered slide identities change', async () => {
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
      (article) => (article as HTMLElement).getBoundingClientRect().left === 0,
    );
    expect(nearestIndex).toBeGreaterThanOrEqual(0);
    expect(articles[nearestIndex]?.hasAttribute('data-cinder-collapsed')).toBe(false);
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
    await fireEvent.pointerDown(viewport, { pointerType: 'touch' });
    await fireEvent.scroll(viewport);
    await flushAnimationFrame();

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

    await fireEvent.pointerDown(viewport, { pointerId: 12, pointerType: 'touch' });
    await fireEvent.scroll(viewport);
    await flushAnimationFrame();

    expectActiveSlide(container, 1);
    expect(scrollTo).not.toHaveBeenCalled();
  });

  test('preserves a parent active-index update during native scrolling', async () => {
    const { container, rerender } = render(Carousel, { slides, activeIndex: 0 });
    const viewport = container.querySelector('.cinder-carousel__viewport') as HTMLElement;
    const slideElements = [...viewport.children] as HTMLElement[];
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

  test('resumes native-scroll reconciliation after a deferred external update settles', async () => {
    const { container, rerender } = render(Carousel, { slides, activeIndex: 0 });
    const viewport = container.querySelector('.cinder-carousel__viewport') as HTMLElement;
    const slideElements = [...viewport.children] as HTMLElement[];
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

    // A later, independent native-scroll gesture must still update the index —
    // the settled deferral must not permanently suppress reconciliation.
    alignSlide(1);
    await fireEvent.scroll(viewport);
    await flushAnimationFrame();
    expectActiveSlide(container, 1);
  });

  test('waits for native scrolling to settle before realigning', async () => {
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

    await fireEvent.scroll(viewport);
    await flushAnimationFrame();
    expectActiveSlide(container, 1);
    expect(scrollTo).not.toHaveBeenCalled();
  });

  test('keeps a stable focus target for keyboard navigation', () => {
    const { container } = render(Carousel, {
      slides: [{ ...slides[0]!, href: '/details' }, ...slides.slice(1)],
    });
    expect(container.querySelector('.cinder-carousel')?.getAttribute('tabindex')).toBe('0');
  });

  test('makes the scrollable viewport keyboard focusable for slide navigation', async () => {
    const { container } = render(Carousel, { slides });
    const viewport = container.querySelector('.cinder-carousel__viewport') as HTMLElement;
    expect(viewport.getAttribute('tabindex')).toBe('0');

    viewport.focus();
    await fireEvent.keyDown(viewport, { key: 'ArrowRight' });

    expect(document.activeElement).toBe(viewport);
    expectActiveSlide(container, 1);
  });

  test('moves focus to the stable root before making the active slide inert', async () => {
    const { container } = render(Carousel, {
      slides: [{ ...slides[0]!, href: '/details' }, ...slides.slice(1)],
    });
    const root = container.querySelector('.cinder-carousel') as HTMLElement;
    const link = container.querySelector('.cinder-carousel__link') as HTMLAnchorElement;
    link.focus();

    await fireEvent.keyDown(link, { key: 'ArrowRight' });

    expect(document.activeElement).toBe(root);
    expectActiveSlide(container, 1);
  });

  test('transfers focus off the outgoing slide before native scrolling makes it inert', async () => {
    const { container } = render(Carousel, {
      slides: [{ ...slides[0]!, href: '/details' }, ...slides.slice(1)],
    });
    const viewport = container.querySelector('.cinder-carousel__viewport') as HTMLElement;
    const link = container.querySelector('.cinder-carousel__link') as HTMLAnchorElement;
    const slideElements = [...viewport.children] as HTMLElement[];
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
    link.focus();
    expect(document.activeElement).toBe(link);

    await fireEvent.scroll(viewport);
    await flushAnimationFrame();

    expect(document.activeElement).toBe(viewport);
    expectActiveSlide(container, 1);
  });

  test('keeps focus on carousel controls during keyboard navigation', async () => {
    const { container } = render(Carousel, { slides });
    const nextButton = container.querySelectorAll<HTMLButtonElement>(
      '.cinder-carousel__control',
    )[1];
    const root = container.querySelector('.cinder-carousel') as HTMLElement;
    if (!nextButton) throw new Error('Missing next control.');
    nextButton.focus();

    await fireEvent.keyDown(nextButton, { key: 'ArrowRight' });

    expect(document.activeElement).toBe(nextButton);
    expect(document.activeElement).not.toBe(root);
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
      trigger(width: number, height = 0) {
        callback?.([{ contentRect: { width, height } } as ResizeObserverEntry]);
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
      const scrollTo = jest.fn();
      Object.defineProperty(viewport, 'scrollTo', { configurable: true, value: scrollTo });
      callback?.([{ contentRect: { width: 300, height: 600 } } as ResizeObserverEntry]);
      expect(scrollTo).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(globalThis, 'ResizeObserver', {
        configurable: true,
        value: originalResizeObserver,
      });
    }
  });

  test('reconciles after a hidden viewport returns to its cached width', async () => {
    type ObserverCallback = (entries: ResizeObserverEntry[]) => void;
    let callback: ObserverCallback | undefined;
    class TestResizeObserver {
      constructor(next: ObserverCallback) {
        callback = next;
      }
      observe() {}
      disconnect() {}
    }
    const originalResizeObserver = globalThis.ResizeObserver;
    Object.defineProperty(globalThis, 'ResizeObserver', {
      configurable: true,
      value: TestResizeObserver,
    });
    try {
      const { container, rerender } = render(Carousel, { slides });
      const viewport = container.querySelector('.cinder-carousel__viewport') as HTMLElement;
      const slideElements = [...viewport.children] as HTMLElement[];
      const scrollTo = jest.fn();
      Object.defineProperty(viewport, 'scrollTo', { configurable: true, value: scrollTo });
      Object.defineProperty(viewport, 'getBoundingClientRect', {
        configurable: true,
        value: () => ({ left: 0, width: 300 }),
      });
      slideElements.forEach((slide, index) => {
        Object.defineProperty(slide, 'getBoundingClientRect', {
          configurable: true,
          value: () => ({ left: index * 100, width: 100 }),
        });
        Object.defineProperty(slide, 'offsetLeft', { configurable: true, value: index * 100 });
      });

      callback?.([{ contentRect: { width: 300 } } as ResizeObserverEntry]);
      scrollTo.mockClear();
      callback?.([{ contentRect: { width: 0 } } as ResizeObserverEntry]);
      await rerender({ slides, activeIndex: 1 });
      callback?.([{ contentRect: { width: 300 } } as ResizeObserverEntry]);

      expect(scrollTo).toHaveBeenCalledWith({ left: 100, behavior: 'auto' });
    } finally {
      Object.defineProperty(globalThis, 'ResizeObserver', {
        configurable: true,
        value: originalResizeObserver,
      });
    }
  });

  test('coalesces scroll geometry reads to one animation frame', async () => {
    const { container } = render(Carousel, { slides });
    const viewport = container.querySelector('.cinder-carousel__viewport') as HTMLElement;
    const readCount = jest.fn();
    Object.defineProperty(viewport, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ left: 0, width: 300 }),
    });
    [...viewport.children].forEach((slide, index) => {
      Object.defineProperty(slide, 'getBoundingClientRect', {
        configurable: true,
        value: () => {
          readCount();
          return { left: index * 100, width: 100 };
        },
      });
    });
    await flushAnimationFrame();
    readCount.mockClear();
    await Promise.all(Array.from({ length: 5 }, () => fireEvent.scroll(viewport)));
    expect(readCount).not.toHaveBeenCalled();
    await flushAnimationFrame();
    expect(readCount).toHaveBeenCalledTimes(6);
  });

  test('keeps an incoming adjacent slide laid out during native scrolling', async () => {
    const { container } = render(Carousel, { slides });
    const viewport = container.querySelector('.cinder-carousel__viewport') as HTMLElement;
    const incoming = viewport.children[1] as HTMLElement;
    await fireEvent.pointerDown(viewport, { pointerId: 4, pointerType: 'touch' });
    await fireEvent.scroll(viewport);
    expect(incoming.hasAttribute('data-cinder-collapsed')).toBe(false);
    expect(incoming.getAttribute('aria-hidden')).toBe('true');
    expect(incoming.hasAttribute('inert')).toBe(true);
  });

  test('keeps distant tall slides collapsed during pointer scrolling', async () => {
    const distantTallSlides = [
      slides[0]!,
      slides[1]!,
      slides[2]!,
      { id: 'four', label: 'Slide four', description: 'Fourth' },
      {
        id: 'five',
        label: 'Slide five',
        description: Array.from({ length: 40 }, () => 'Distant tall content').join(' '),
      },
    ];
    const { container } = render(Carousel, { slides: distantTallSlides });
    const viewport = container.querySelector('.cinder-carousel__viewport') as HTMLElement;
    const distantTall = viewport.children[4] as HTMLElement;

    expect(distantTall.hasAttribute('data-cinder-collapsed')).toBe(true);
    await fireEvent.pointerDown(viewport, { pointerId: 8, pointerType: 'touch' });
    await fireEvent.scroll(viewport);

    expect(distantTall.hasAttribute('data-cinder-collapsed')).toBe(true);
    await fireEvent.pointerUp(window, { pointerId: 8 });
  });

  test('collapses a tall adjacent slide when a short active slide is settled', () => {
    const tallSlides = [
      { ...slides[0]!, description: 'Short active slide' },
      {
        ...slides[1]!,
        description: Array.from({ length: 20 }, () => 'Tall adjacent content').join(' '),
      },
      slides[2]!,
    ];
    const { container } = render(Carousel, { slides: tallSlides });
    const articles = [...container.querySelectorAll<HTMLElement>('article.cinder-carousel__slide')];

    expect(articles[0]?.hasAttribute('data-cinder-collapsed')).toBe(false);
    expect(articles[1]?.hasAttribute('data-cinder-collapsed')).toBe(true);
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

  test('keeps autoplay transitions out of the live region', async () => {
    jest.useFakeTimers();
    const { container } = render(Carousel, { slides, autoplay: true, autoplayInterval: 100 });
    const viewport = container.querySelector('.cinder-carousel__viewport') as HTMLElement;
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

    const liveRegion = container.querySelector('[aria-live]');
    expect(liveRegion?.getAttribute('aria-live')).toBe('off');
    jest.advanceTimersByTime(100);
    expect(liveRegion?.getAttribute('aria-live')).toBe('off');
  });

  test('autoplay jumps immediately across the physical wrap boundary', async () => {
    jest.useFakeTimers();
    const { container } = render(Carousel, {
      slides,
      activeIndex: 2,
      autoplay: true,
      autoplayInterval: 100,
    });
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
        value: () => ({ left: index === 0 ? 100 : 0, width: 100 }),
      });
      Object.defineProperty(slide, 'offsetLeft', { configurable: true, value: index * 100 });
    });

    jest.advanceTimersByTime(100);
    await waitFor(() => expectActiveSlide(container, 0));
    expect(scrollTo).toHaveBeenCalledWith({ left: 0, behavior: 'smooth' });
  });

  test('pauses autoplay while wheel scrolling settles', async () => {
    jest.useFakeTimers();
    const { container } = render(Carousel, { slides, autoplay: true, autoplayInterval: 10 });
    const viewport = container.querySelector('.cinder-carousel__viewport') as HTMLElement;

    await fireEvent.wheel(viewport, { deltaX: 40 });
    jest.advanceTimersByTime(50);
    expectActiveSlide(container, 0);
  });

  test('pauses autoplay while shift-wheel scrolling settles', async () => {
    jest.useFakeTimers();
    const { container } = render(Carousel, { slides, autoplay: true, autoplayInterval: 10 });
    const viewport = container.querySelector('.cinder-carousel__viewport') as HTMLElement;

    await fireEvent.wheel(viewport, { shiftKey: true, deltaX: 0, deltaY: 40 });
    jest.advanceTimersByTime(50);
    expectActiveSlide(container, 0);
  });

  test('ignores an ordinary vertical wheel event while a programmatic scroll is pending', async () => {
    jest.useFakeTimers();
    const { container } = render(Carousel, { slides, autoplay: true, autoplayInterval: 10 });
    const viewport = container.querySelector('.cinder-carousel__viewport') as HTMLElement;
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

    await fireEvent.wheel(viewport, { deltaY: 40 });

    expect(liveRegion?.getAttribute('aria-live')).toBe('off');
  });

  test('ignores a vertical-dominant trackpad gesture with incidental deltaX', async () => {
    jest.useFakeTimers();
    const { container } = render(Carousel, { slides, autoplay: true, autoplayInterval: 10 });
    const viewport = container.querySelector('.cinder-carousel__viewport') as HTMLElement;
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
    const viewport = container.querySelector('.cinder-carousel__viewport') as HTMLElement;
    const liveRegion = container.querySelector('[aria-live]');

    jest.advanceTimersByTime(10);
    await fireEvent.pointerDown(viewport, { pointerId: 1, pointerType: 'touch' });

    expect(liveRegion?.getAttribute('aria-live')).toBe('polite');
  });

  test('preserves a pending programmatic destination across an unrelated window blur', async () => {
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
    window.dispatchEvent(new Event('blur'));

    // An intermediate scroll frame mid-animation, not yet at the
    // destination slide, must not be treated as native input that
    // overwrites the requested destination.
    Object.defineProperty(slideElements[0]!, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ left: -40, width: 100 }),
    });
    await fireEvent.scroll(viewport);
    await flushAnimationFrame();

    expectActiveSlide(container, 1);
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
