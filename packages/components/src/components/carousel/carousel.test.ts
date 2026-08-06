/// <reference lib="dom" />
import { join } from 'node:path';

import { afterEach, describe, expect, jest, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';
import { renderToServerHtml } from '../../test/server-render.ts';

setupHappyDom();

const CAROUSEL_SOURCE = join(import.meta.dir, 'carousel.svelte');

const { cleanup, fireEvent, render, waitFor } = await import('@testing-library/svelte');
const { tick } = await import('svelte');
const { default: Carousel } = await import('./carousel.svelte');
const { default: CarouselSlideSnippetFixture } =
  await import('../../test/fixtures/carousel-slide-snippet-fixture.svelte');

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

  test('keeps autoplay paused until a cancelled native gesture settles', async () => {
    jest.useFakeTimers();
    const { container } = render(Carousel, {
      slides,
      autoplay: true,
      autoplayInterval: 50,
    });
    const viewport = container.querySelector('.cinder-carousel__viewport') as HTMLElement;

    await fireEvent.pointerDown(viewport, { pointerId: 73, pointerType: 'touch' });
    await fireEvent.pointerCancel(window, { pointerId: 73 });

    // The cancelled gesture owns native scrolling until the debounce expires;
    // autoplay must not move the active slide during that window.
    jest.advanceTimersByTime(99);
    expectActiveSlide(container, 0);

    // Once native scrolling settles, autoplay is allowed to resume. The
    // additional interval is the discriminating signal that settlement ran.
    jest.advanceTimersByTime(1 + 50);
    await waitFor(() => expectActiveSlide(container, 1));
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

  test('resumes native-scroll settling when blur releases a tracked pointer', async () => {
    jest.useFakeTimers();
    const { container } = render(Carousel, { slides });
    const viewport = container.querySelector('.cinder-carousel__viewport') as HTMLElement;
    const neighbor = viewport.children[1] as HTMLElement;

    await fireEvent.pointerDown(viewport, { pointerId: 76, pointerType: 'touch' });
    await fireEvent.scroll(viewport);
    jest.advanceTimersByTime(100);
    window.dispatchEvent(new Event('blur'));
    jest.advanceTimersByTime(100);

    expect(neighbor.hasAttribute('data-cinder-collapsed')).toBe(true);
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
    const { container } = render(Carousel, { slides, activeIndex: 2, loop: true });
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
    jest.useFakeTimers();
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
    await fireEvent.pointerUp(window, { pointerId: 12 });
    jest.advanceTimersByTime(100);
    await tick();

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
    jest.useFakeTimers();
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
    jest.advanceTimersByTime(100);
    await tick();
    expectActiveSlide(container, 1);
  });

  test('waits for native scrolling to settle before realigning', async () => {
    jest.useFakeTimers();
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
    jest.advanceTimersByTime(100);
    await tick();
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
    jest.useFakeTimers();
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
    jest.advanceTimersByTime(100);
    await tick();

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

  test('pause control toggles aria-pressed and genuinely stops autoplay from advancing', async () => {
    jest.useFakeTimers();
    const { container } = render(Carousel, { slides, autoplay: true, autoplayInterval: 50 });
    const pauseButton = container.querySelector(
      '.cinder-carousel__control--pause',
    ) as HTMLButtonElement;

    expect(pauseButton.getAttribute('aria-pressed')).toBe('false');

    await fireEvent.click(pauseButton);
    expect(pauseButton.getAttribute('aria-pressed')).toBe('true');

    // Two full intervals elapse; a genuinely paused autoplay must not advance.
    jest.advanceTimersByTime(100);
    await tick();
    expectActiveSlide(container, 0);
  });

  test('control: without pausing, elapsing one interval DOES advance autoplay', async () => {
    // Proves the harness above can actually detect advancement — without this, a broken
    // pause toggle and a broken test harness would look identical. Uses a long interval and
    // a single elapse so the assertion can't be satisfied by loop wrap-around cycling back
    // to the expected index during waitFor's own fake-timer polling — with `loop` defaulting
    // to false (see the `loop (default false)` suite), a carousel parked at its last slide
    // no longer keeps cycling, so an ambiguous multi-tick advance can get stuck short of the
    // expected index instead of wrapping back to it.
    jest.useFakeTimers();
    const { container } = render(Carousel, { slides, autoplay: true, autoplayInterval: 1000 });

    jest.advanceTimersByTime(1000);
    await waitFor(() => expectActiveSlide(container, 1));
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
      loop: true,
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

  test('autoplay stops advancing at the last slide by default (loop defaults to false)', async () => {
    jest.useFakeTimers();
    const { container } = render(Carousel, {
      slides,
      activeIndex: 2,
      autoplay: true,
      autoplayInterval: 100,
    });

    jest.advanceTimersByTime(300);
    await tick();

    expectActiveSlide(container, 2);
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

  // Characterization tests (Phase 0 of the blossom-carousel gap-closing plan).
  // These pin the *contract* — what settles, when the index updates, when the
  // outgoing slide stops being interactive, and the current always-on loop
  // behavior — rather than the debounce implementation, so a settle-detection
  // rewrite (native `scrollend`, Phase 2) can land without rewriting these.
  describe('settle contract', () => {
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

    test('settles on the nearest slide once scrolling stops', async () => {
      const { container } = render(Carousel, { slides });
      const viewport = container.querySelector('.cinder-carousel__viewport') as HTMLElement;
      stubLinearGeometry(viewport);
      stubSlideOneNearest(viewport);

      await fireEvent.scroll(viewport);

      await waitFor(() => expectActiveSlide(container, 1));
    });

    test('does not update the active index while the scroll gesture is still settling', async () => {
      const { container } = render(Carousel, { slides });
      const viewport = container.querySelector('.cinder-carousel__viewport') as HTMLElement;
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
      const viewport = container.querySelector('.cinder-carousel__viewport') as HTMLElement;
      stubLinearGeometry(viewport);
      const liveRegion = container.querySelector('[aria-live]') as HTMLElement;
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
      const viewport = container.querySelector('.cinder-carousel__viewport') as HTMLElement;
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
      const nextButton = controls[1] as HTMLButtonElement;

      await fireEvent.click(nextButton);

      expectActiveSlide(container, 0);
    });

    test('wraps backward to the last slide when reversing past the first slide with loop enabled', async () => {
      const { container } = render(Carousel, { slides, activeIndex: 0, loop: true });
      const controls = container.querySelectorAll('.cinder-carousel__control');
      const previousButton = controls[0] as HTMLButtonElement;

      await fireEvent.click(previousButton);

      expectActiveSlide(container, 2);
    });
  });

  describe('loop (default false)', () => {
    test('clamps at the last slide instead of wrapping by default', async () => {
      const { container } = render(Carousel, { slides, activeIndex: 2 });
      const controls = container.querySelectorAll('.cinder-carousel__control');
      const nextButton = controls[1] as HTMLButtonElement;

      await fireEvent.click(nextButton);

      expectActiveSlide(container, 2);
    });

    test('clamps at the first slide instead of wrapping by default', async () => {
      const { container } = render(Carousel, { slides, activeIndex: 0 });
      const controls = container.querySelectorAll('.cinder-carousel__control');
      const previousButton = controls[0] as HTMLButtonElement;

      await fireEvent.click(previousButton);

      expectActiveSlide(container, 0);
    });

    test('disables the previous control at the first slide and the next control at the last', async () => {
      const { container, rerender } = render(Carousel, { slides, activeIndex: 0 });
      const controls = () =>
        container.querySelectorAll<HTMLButtonElement>('.cinder-carousel__control');

      expect(controls()[0]?.disabled).toBe(true);
      expect(controls()[1]?.disabled).toBe(false);

      await rerender({ slides, activeIndex: 2 });

      expect(controls()[0]?.disabled).toBe(false);
      expect(controls()[1]?.disabled).toBe(true);
    });

    test('keeps both controls enabled at the boundaries when loop is true', () => {
      const { container } = render(Carousel, { slides, activeIndex: 0, loop: true });
      const controls = container.querySelectorAll<HTMLButtonElement>('.cinder-carousel__control');

      expect(controls[0]?.disabled).toBe(false);
      expect(controls[1]?.disabled).toBe(false);
    });

    test('Arrow key navigation at a clamped boundary is a no-op rather than wrapping', async () => {
      const { container } = render(Carousel, { slides, activeIndex: 0 });
      const root = container.querySelector('.cinder-carousel') as HTMLElement;

      await fireEvent.keyDown(root, { key: 'ArrowLeft' });

      expectActiveSlide(container, 0);
    });
  });

  describe('onSlideChange', () => {
    test('fires with the new index and slide when internal navigation moves the active slide', async () => {
      const onSlideChange = jest.fn();
      const { container } = render(Carousel, { slides, onSlideChange });
      const controls = container.querySelectorAll('.cinder-carousel__control');

      await fireEvent.click(controls[1] as HTMLButtonElement);

      expect(onSlideChange).toHaveBeenCalledWith(1, slides[1]);
    });

    test('does not fire for a parent-driven activeIndex update', async () => {
      const onSlideChange = jest.fn();
      const { rerender } = render(Carousel, { slides, activeIndex: 0, onSlideChange });

      await rerender({ slides, activeIndex: 2, onSlideChange });

      expect(onSlideChange).not.toHaveBeenCalled();
    });

    test('does not fire on initial mount', () => {
      const onSlideChange = jest.fn();
      render(Carousel, { slides, activeIndex: 1, onSlideChange });

      expect(onSlideChange).not.toHaveBeenCalled();
    });

    test('does not fire when a boundary click clamps to the same index', async () => {
      const onSlideChange = jest.fn();
      const { container } = render(Carousel, { slides, activeIndex: 0, onSlideChange });
      const controls = container.querySelectorAll('.cinder-carousel__control');

      await fireEvent.click(controls[0] as HTMLButtonElement);

      expect(onSlideChange).not.toHaveBeenCalled();
    });
  });

  describe('consumer event handlers', () => {
    test('invokes a consumer onkeydown before internal navigation', async () => {
      const onkeydown = jest.fn();
      const { container } = render(Carousel, { slides, onkeydown });
      const root = container.querySelector('.cinder-carousel') as HTMLElement;

      await fireEvent.keyDown(root, { key: 'ArrowRight' });

      expect(onkeydown).toHaveBeenCalled();
      expectActiveSlide(container, 1);
    });

    test('lets a consumer onkeydown preventDefault suppress arrow-key navigation', async () => {
      const { container } = render(Carousel, {
        slides,
        onkeydown: (event: KeyboardEvent) => event.preventDefault(),
      });
      const root = container.querySelector('.cinder-carousel') as HTMLElement;

      await fireEvent.keyDown(root, { key: 'ArrowRight' });

      expectActiveSlide(container, 0);
    });

    test('invokes consumer mouseenter/mouseleave/focusin/focusout handlers alongside internal behavior', async () => {
      const onmouseenter = jest.fn();
      const onmouseleave = jest.fn();
      const onfocusin = jest.fn();
      const onfocusout = jest.fn();
      const { container } = render(Carousel, {
        slides,
        onmouseenter,
        onmouseleave,
        onfocusin,
        onfocusout,
      });
      const root = container.querySelector('.cinder-carousel') as HTMLElement;

      await fireEvent.mouseEnter(root);
      await fireEvent.mouseLeave(root);
      await fireEvent.focusIn(root);
      await fireEvent.focusOut(root);

      expect(onmouseenter).toHaveBeenCalled();
      expect(onmouseleave).toHaveBeenCalled();
      expect(onfocusin).toHaveBeenCalled();
      expect(onfocusout).toHaveBeenCalled();
    });
  });

  describe('indicators', () => {
    test('renders dots when the slide count is at or below the default limit', () => {
      const { container } = render(Carousel, { slides });

      expect(container.querySelectorAll('.cinder-carousel__dot').length).toBe(3);
      expect(container.querySelector('.cinder-carousel__counter')).toBeNull();
    });

    test('auto-degrades to a counter above the default indicator limit', () => {
      const manySlides = Array.from({ length: 9 }, (_, index) => ({
        id: `slide-${index}`,
        label: `Slide ${index}`,
      }));
      const { container } = render(Carousel, { slides: manySlides });

      expect(container.querySelectorAll('.cinder-carousel__dot').length).toBe(0);
      expect(container.querySelector('.cinder-carousel__counter')?.textContent?.trim()).toBe(
        '1 / 9',
      );
    });

    test('respects an explicit indicators="dots" override above the limit', () => {
      const manySlides = Array.from({ length: 9 }, (_, index) => ({
        id: `slide-${index}`,
        label: `Slide ${index}`,
      }));
      const { container } = render(Carousel, { slides: manySlides, indicators: 'dots' });

      expect(container.querySelectorAll('.cinder-carousel__dot').length).toBe(9);
    });

    test('indicators="none" renders neither dots nor a counter', () => {
      const { container } = render(Carousel, { slides, indicators: 'none' });

      expect(container.querySelectorAll('.cinder-carousel__dot').length).toBe(0);
      expect(container.querySelector('.cinder-carousel__counter')).toBeNull();
    });

    test('a custom indicatorLimit changes where the auto-degrade threshold sits', () => {
      const { container } = render(Carousel, { slides, indicatorLimit: 2 });

      expect(container.querySelectorAll('.cinder-carousel__dot').length).toBe(0);
      expect(container.querySelector('.cinder-carousel__counter')?.textContent?.trim()).toBe(
        '1 / 3',
      );
    });
  });

  describe('native scrollend (Tier 2 progressive enhancement)', () => {
    // The listener-attachment effect runs once at mount and checks
    // `'onscrollend' in viewportElement`, so the stub must exist on
    // `HTMLElement.prototype` *before* the carousel mounts — patching the
    // element instance after render is too late.
    function installScrollEndSupport(): () => void {
      const proto = HTMLElement.prototype as unknown as Record<string, unknown>;
      const hadOwnProperty = Object.prototype.hasOwnProperty.call(proto, 'onscrollend');
      const original = hadOwnProperty
        ? Object.getOwnPropertyDescriptor(proto, 'onscrollend')
        : undefined;
      Object.defineProperty(proto, 'onscrollend', {
        configurable: true,
        writable: true,
        value: null,
      });
      return () => {
        if (original) {
          Object.defineProperty(proto, 'onscrollend', original);
        } else {
          delete proto['onscrollend'];
        }
      };
    }

    // Geometry is left unstubbed (happy-dom's zeroed rects tie-break to index
    // 0), so `currentIndex` never moves via the independent rAF-driven
    // nearest-slide writeback in `onViewportScroll` — isolating exactly what
    // `handleSettle` (native `scrollend` vs. the debounce fallback) controls:
    // clearing the in-progress-scroll layout window around the settled slide.
    test('clears the in-progress scroll layout window from the native scrollend event, without the debounce timer', async () => {
      jest.useFakeTimers();
      const restoreScrollEndSupport = installScrollEndSupport();
      try {
        const { container } = render(Carousel, { slides });
        const viewport = container.querySelector('.cinder-carousel__viewport') as HTMLElement;
        const neighbor = viewport.children[1] as HTMLElement;

        await fireEvent.pointerDown(viewport, { pointerId: 61, pointerType: 'touch' });
        await fireEvent.scroll(viewport);

        // Mid-scroll: the layout window around the settled slide is widened.
        expect(neighbor.hasAttribute('data-cinder-collapsed')).toBe(false);

        await fireEvent.pointerUp(window, { pointerId: 61 });
        await fireEvent(viewport, new Event('scrollend'));

        expect(neighbor.hasAttribute('data-cinder-collapsed')).toBe(true);
      } finally {
        restoreScrollEndSupport();
      }
    });

    test('does not fall back to the debounce timer once native scrollend is supported', async () => {
      jest.useFakeTimers();
      const restoreScrollEndSupport = installScrollEndSupport();
      try {
        const { container } = render(Carousel, { slides });
        const viewport = container.querySelector('.cinder-carousel__viewport') as HTMLElement;
        const neighbor = viewport.children[1] as HTMLElement;

        await fireEvent.pointerDown(viewport, { pointerId: 62, pointerType: 'touch' });
        await fireEvent.scroll(viewport);
        await fireEvent.pointerUp(window, { pointerId: 62 });

        jest.advanceTimersByTime(1000);

        // The debounce timer alone (no scrollend dispatched) must not settle —
        // native support means the fallback timer is never armed.
        expect(neighbor.hasAttribute('data-cinder-collapsed')).toBe(false);

        await fireEvent(viewport, new Event('scrollend'));
        expect(neighbor.hasAttribute('data-cinder-collapsed')).toBe(true);
      } finally {
        restoreScrollEndSupport();
      }
    });
  });

  describe('nearestVisibleSlideIndex snapport awareness', () => {
    test('resolves nearest against scroll-padding-inline-start, not the border-box edge', async () => {
      jest.useFakeTimers();
      const { container } = render(Carousel, { slides });
      const viewport = container.querySelector('.cinder-carousel__viewport') as HTMLElement;
      // A 40px inset snapport: slide 1 sits at physical left 40, flush with
      // the padded edge, while slide 0 (at the true border-box edge, left 0)
      // is 40px further from the snapport's leading edge.
      viewport.style.scrollPaddingInlineStart = '40px';
      Object.defineProperty(viewport, 'getBoundingClientRect', {
        configurable: true,
        value: () => ({ left: 0, width: 140 }),
      });
      [...viewport.children].forEach((slide, index) => {
        Object.defineProperty(slide, 'getBoundingClientRect', {
          configurable: true,
          value: () => ({ left: index === 1 ? 40 : index === 0 ? 0 : 140, width: 100 }),
        });
      });

      await fireEvent.scroll(viewport);
      await flushAnimationFrame();
      jest.advanceTimersByTime(100);
      await tick();

      expectActiveSlide(container, 1);
    });

    test('falls back to the border-box edge when no scroll-padding is set', async () => {
      const { container } = render(Carousel, { slides });
      const viewport = container.querySelector('.cinder-carousel__viewport') as HTMLElement;
      Object.defineProperty(viewport, 'getBoundingClientRect', {
        configurable: true,
        value: () => ({ left: 0, width: 100 }),
      });
      [...viewport.children].forEach((slide, index) => {
        Object.defineProperty(slide, 'getBoundingClientRect', {
          configurable: true,
          value: () => ({ left: index === 0 ? 0 : 100, width: 100 }),
        });
      });

      await fireEvent.scroll(viewport);
      await flushAnimationFrame();

      expectActiveSlide(container, 0);
    });
  });

  describe('motion state machine (settle-only writeback)', () => {
    test('does not announce a slide change until the gesture settles', async () => {
      jest.useFakeTimers();
      const { container } = render(Carousel, { slides });
      const viewport = container.querySelector('.cinder-carousel__viewport') as HTMLElement;
      const liveRegion = container.querySelector('[aria-live]') as HTMLElement;
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
      const viewport = container.querySelector('.cinder-carousel__viewport') as HTMLElement;
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

  describe('slide snippet', () => {
    test('renders inside the slide article, replacing the built-in body', () => {
      const { container } = render(CarouselSlideSnippetFixture, { slides });

      const activeArticle = container.querySelector('article.cinder-carousel__slide');
      expect(
        activeArticle?.querySelector('.carousel-slide-snippet-fixture__body')?.textContent,
      ).toContain('Slide one');
      expect(container.querySelector('.cinder-carousel__title')).toBeNull();
      expect(container.querySelector('.cinder-carousel__description')).toBeNull();
    });

    test('receives the slide index and active state', () => {
      const { container } = render(CarouselSlideSnippetFixture, { slides });

      expect(container.querySelector('[data-testid="custom-slide-0"]')?.textContent).toContain(
        'active',
      );
      expect(container.querySelector('[data-testid="custom-slide-1"]')?.textContent).toContain(
        'inactive',
      );
    });

    test('still enforces the inert/aria-hidden contract on non-active slides', () => {
      const { container } = render(CarouselSlideSnippetFixture, { slides });

      expectActiveSlide(container, 0);
    });

    test('advances which slide is active via the normal controls', async () => {
      const { container } = render(CarouselSlideSnippetFixture, { slides });
      const nextButton = container.querySelectorAll('.cinder-carousel__control')[1] as HTMLElement;

      await fireEvent.click(nextButton);

      expectActiveSlide(container, 1);
      expect(container.querySelector('[data-testid="custom-slide-1"]')?.textContent).toContain(
        'active',
      );
    });
  });

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
      const articles = [
        ...container.querySelectorAll<HTMLElement>('article.cinder-carousel__slide'),
      ];

      expect(articles[0]?.getAttribute('aria-hidden')).toBeNull();
      expect(articles[0]?.hasAttribute('inert')).toBe(false);
      expect(articles[1]?.getAttribute('aria-hidden')).toBeNull();
      expect(articles[1]?.hasAttribute('inert')).toBe(false);
      expect(articles[2]?.getAttribute('aria-hidden')).toBe('true');
      expect(articles[2]?.hasAttribute('inert')).toBe(true);
    });

    test('rounds a fractional slidesPerView up — a peeking slide is fully interactive', () => {
      const { container } = render(Carousel, { slides: fiveSlides, slidesPerView: 2.5 });
      const articles = [
        ...container.querySelectorAll<HTMLElement>('article.cinder-carousel__slide'),
      ];

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
      const articles = [
        ...container.querySelectorAll<HTMLElement>('article.cinder-carousel__slide'),
      ];

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

  describe('align', () => {
    function stubGeometry(viewport: HTMLElement, slides: HTMLElement[]): void {
      Object.defineProperty(viewport, 'getBoundingClientRect', {
        configurable: true,
        value: () => ({ left: 0, width: 100 }),
      });
      slides.forEach((slide, index) => {
        Object.defineProperty(slide, 'getBoundingClientRect', {
          configurable: true,
          value: () => ({ left: index * 100, width: 100 }),
        });
        Object.defineProperty(slide, 'offsetLeft', { configurable: true, value: index * 100 });
      });
    }

    test("defaults to 'start': scrolls the slide's left edge to the viewport's left edge", async () => {
      const { container } = render(Carousel, { slides });
      const viewport = container.querySelector('.cinder-carousel__viewport') as HTMLElement;
      const slideElements = [...viewport.children] as HTMLElement[];
      stubGeometry(viewport, slideElements);
      const scrollTo = jest.fn();
      Object.defineProperty(viewport, 'scrollTo', { configurable: true, value: scrollTo });

      await fireEvent.click(container.querySelectorAll('.cinder-carousel__dot')[1]!);

      expect(scrollTo).toHaveBeenCalledWith({ left: 100, behavior: 'smooth' });
    });

    test("'center': scrolls so the slide's center aligns with the viewport's center", async () => {
      const { container } = render(Carousel, { slides, align: 'center' });
      const viewport = container.querySelector('.cinder-carousel__viewport') as HTMLElement;
      const slideElements = [...viewport.children] as HTMLElement[];
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
      const viewport = container.querySelector('.cinder-carousel__viewport') as HTMLElement;
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

  describe('mouse drag-to-scroll', () => {
    function dispatchMousePointer(
      target: EventTarget,
      type: string,
      init: { clientX?: number; movementX?: number; pointerId?: number } = {},
    ): void {
      target.dispatchEvent(
        new PointerEvent(type, {
          pointerId: init.pointerId ?? 1,
          pointerType: 'mouse',
          clientX: init.clientX ?? 0,
          movementX: init.movementX ?? 0,
          bubbles: true,
          cancelable: true,
        }),
      );
    }

    test('marks the viewport dragging once a mouse drag crosses the threshold', () => {
      const { container } = render(Carousel, { slides });
      const viewport = container.querySelector('.cinder-carousel__viewport') as HTMLElement;

      dispatchMousePointer(viewport, 'pointerdown', { clientX: 0 });
      dispatchMousePointer(viewport, 'pointermove', { clientX: 20, movementX: 20 });

      expect(viewport.hasAttribute('data-cinder-dragging')).toBe(true);
      dispatchMousePointer(window, 'pointerup', { clientX: 20 });
    });

    test('does not treat a touch pointer as a mouse drag — the native scroller still owns it', () => {
      const { container } = render(Carousel, { slides });
      const viewport = container.querySelector('.cinder-carousel__viewport') as HTMLElement;

      viewport.dispatchEvent(
        new PointerEvent('pointerdown', {
          pointerId: 2,
          pointerType: 'touch',
          clientX: 0,
          bubbles: true,
        }),
      );
      viewport.dispatchEvent(
        new PointerEvent('pointermove', {
          pointerId: 2,
          pointerType: 'touch',
          clientX: 20,
          movementX: 20,
          bubbles: true,
        }),
      );

      // The mouse-only drag engine never engages for touch — the existing
      // touch-pan interaction-layout widening is what's tracking this instead.
      expect(viewport.hasAttribute('data-cinder-dragging')).toBe(false);
    });

    test('does not attach the drag engine under prefers-reduced-motion', () => {
      const restoreMatchMedia = installMatchMediaMock(true);
      try {
        const { container } = render(Carousel, { slides });
        const viewport = container.querySelector('.cinder-carousel__viewport') as HTMLElement;

        dispatchMousePointer(viewport, 'pointerdown', { clientX: 0 });
        dispatchMousePointer(viewport, 'pointermove', { clientX: 50, movementX: 50 });

        expect(viewport.hasAttribute('data-cinder-dragging')).toBe(false);
        dispatchMousePointer(window, 'pointerup', { clientX: 50 });
      } finally {
        restoreMatchMedia();
      }
    });

    test('suppresses the click on slide content that follows a real mouse drag', () => {
      const linkedSlides = [{ ...slides[0]!, href: '/details' }, ...slides.slice(1)];
      const { container } = render(Carousel, { slides: linkedSlides });
      const viewport = container.querySelector('.cinder-carousel__viewport') as HTMLElement;
      const link = container.querySelector('.cinder-carousel__link') as HTMLAnchorElement;

      dispatchMousePointer(viewport, 'pointerdown', { clientX: 0 });
      dispatchMousePointer(viewport, 'pointermove', { clientX: 20, movementX: 20 });
      dispatchMousePointer(window, 'pointerup', { clientX: 20 });

      const click = new MouseEvent('click', { bubbles: true, cancelable: true });
      link.dispatchEvent(click);

      expect(click.defaultPrevented).toBe(true);
    });

    test('does not suppress an ordinary click on slide content with no drag', () => {
      const linkedSlides = [{ ...slides[0]!, href: '/details' }, ...slides.slice(1)];
      const { container } = render(Carousel, { slides: linkedSlides });
      const viewport = container.querySelector('.cinder-carousel__viewport') as HTMLElement;
      const link = container.querySelector('.cinder-carousel__link') as HTMLAnchorElement;

      dispatchMousePointer(viewport, 'pointerdown', { clientX: 0 });
      dispatchMousePointer(window, 'pointerup', { clientX: 0 });

      const click = new MouseEvent('click', { bubbles: true, cancelable: true });
      link.dispatchEvent(click);

      expect(click.defaultPrevented).toBe(false);
    });
  });
});
