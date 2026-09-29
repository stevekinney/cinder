/// <reference lib="dom" />

import { afterEach, describe, expect, jest, test } from 'bun:test';

import { requiredInstance, setupHappyDom } from '@lostgradient/testing';

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
  test('keeps an incoming adjacent slide laid out during native scrolling', async () => {
    const { container } = render(Carousel, { slides });
    const viewport = requiredInstance(
      container.querySelector('.cinder-carousel__viewport'),
      HTMLElement,
    );
    const incoming = requiredInstance(viewport.children[1], HTMLElement);
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
    const viewport = requiredInstance(
      container.querySelector('.cinder-carousel__viewport'),
      HTMLElement,
    );
    const distantTall = requiredInstance(viewport.children[4], HTMLElement);

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
    const previousButton = requiredInstance(controls[0], HTMLButtonElement);
    const nextButton = requiredInstance(controls[1], HTMLButtonElement);

    await fireEvent.click(nextButton);
    expectActiveSlide(container, 1);

    await fireEvent.click(previousButton);
    expectActiveSlide(container, 0);
  });

  test('arrow keys and home/end move between slides', async () => {
    const { container } = render(Carousel, { slides });
    const root = requiredInstance(container.querySelector('.cinder-carousel'), HTMLElement);
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
    await tick();

    expect(container.textContent).toContain('One');
    jest.advanceTimersByTime(100);
    await tick();
    expectActiveSlide(container, 1);
  });

  test('pause control switches action label and genuinely stops autoplay from advancing', async () => {
    jest.useFakeTimers();
    const { container } = render(Carousel, { slides, autoplay: true, autoplayInterval: 50 });
    const pauseButton = requiredInstance(
      container.querySelector('.cinder-carousel__control--pause'),
      HTMLButtonElement,
    );

    expect(pauseButton.textContent).toBe('Pause');
    expect(pauseButton.getAttribute('aria-label')).toBe('Pause carousel rotation');

    await fireEvent.click(pauseButton);
    expect(pauseButton.textContent).toBe('Play');
    expect(pauseButton.getAttribute('aria-label')).toBe('Play carousel rotation');

    // Two full intervals elapse; a genuinely paused autoplay must not advance.
    jest.advanceTimersByTime(100);
    await tick();
    expectActiveSlide(container, 0);
  });

  test('pointer focus on the running rotation control still pauses on click', async () => {
    jest.useFakeTimers();
    const { container } = render(Carousel, { slides, autoplay: true, autoplayInterval: 50 });
    const pauseButton = requiredInstance(
      container.querySelector('.cinder-carousel__control--pause'),
      HTMLButtonElement,
    );
    await tick();

    await fireEvent.pointerDown(pauseButton, { pointerId: 41, pointerType: 'mouse', button: 0 });
    await fireEvent.focusIn(pauseButton);
    await fireEvent.pointerUp(pauseButton, { pointerId: 41, pointerType: 'mouse' });
    await fireEvent.click(pauseButton, { detail: 1 });

    expect(pauseButton.textContent).toBe('Play');
    jest.advanceTimersByTime(100);
    await tick();
    expectActiveSlide(container, 0);
  });

  test('canceled rotation pointer activation still pauses on focus and permits keyboard play', async () => {
    jest.useFakeTimers();
    const { container } = render(Carousel, { slides, autoplay: true, autoplayInterval: 100 });
    const rotation = requiredInstance(
      container.querySelector('.cinder-carousel__control--pause'),
      HTMLButtonElement,
    );
    await tick();
    await fireEvent.pointerDown(rotation, { pointerId: 42, pointerType: 'mouse' });
    rotation.focus();
    await tick();
    await fireEvent.pointerUp(window, { pointerId: 42, pointerType: 'mouse' });
    expect(rotation.textContent).toBe('Play');
    jest.advanceTimersByTime(200);
    await tick();
    expectActiveSlide(container, 0);

    await fireEvent.click(rotation, { detail: 0 });
    await tick();
    jest.advanceTimersByTime(100);
    await tick();
    expectActiveSlide(container, 1);
  });

  test('a pointer-invoked pause stays paused through an intervening focus transition', async () => {
    // `onFocusIn` only ever PAUSES (userPaused = true); nothing in a focus
    // transition can revert an already-paused rotation. This exercises the
    // full transition explicitly, named for the acceptance criterion, rather
    // than relying on that being an incidental side effect of another test.
    jest.useFakeTimers();
    const { container } = render(Carousel, { slides, autoplay: true, autoplayInterval: 50 });
    const root = requiredInstance(container.querySelector('.cinder-carousel'), HTMLElement);
    const rotationButton = requiredInstance(
      container.querySelector('.cinder-carousel__control--pause'),
      HTMLButtonElement,
    );
    await tick();

    await fireEvent.pointerDown(rotationButton, { pointerId: 7, pointerType: 'mouse', button: 0 });
    await fireEvent.click(rotationButton, { detail: 1 });
    expect(rotationButton.textContent).toBe('Play');

    await fireEvent.focusOut(rotationButton, { relatedTarget: root });
    await fireEvent.focusIn(root);
    jest.advanceTimersByTime(150);
    await tick();
    expectActiveSlide(container, 0);
    expect(rotationButton.textContent).toBe('Play');

    await fireEvent.focusOut(root);
    jest.advanceTimersByTime(150);
    await tick();
    expectActiveSlide(container, 0);
    expect(rotationButton.textContent).toBe('Play');
  });

  test('keyboard Play restarts rotation with focus retained on the control', async () => {
    jest.useFakeTimers();
    const { container } = render(Carousel, { slides, autoplay: true, autoplayInterval: 50 });
    const rotationButton = requiredInstance(
      container.querySelector('.cinder-carousel__control--pause'),
      HTMLButtonElement,
    );
    await tick();

    // Tabbing to the control already pauses it (focus entry — see the
    // sticky-pause test above), with no click involved yet.
    rotationButton.focus();
    await fireEvent.focusIn(rotationButton);
    expect(rotationButton.textContent).toBe('Play');
    expect(document.activeElement).toBe(rotationButton);

    // Restart. Activation via keyboard (Enter/Space) dispatches a click with
    // `detail: 0` and never moves focus off the button itself.
    await fireEvent.click(rotationButton, { detail: 0 });
    expect(rotationButton.textContent).toBe('Pause');
    expect(document.activeElement).toBe(rotationButton);

    jest.advanceTimersByTime(50);
    await tick();
    expectActiveSlide(container, 1);
    expect(document.activeElement).toBe(rotationButton);
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
    await tick();

    jest.advanceTimersByTime(1000);
    await tick();
    expectActiveSlide(container, 1);
  });

  test('keeps autoplay transitions out of the live region', async () => {
    jest.useFakeTimers();
    const { container } = render(Carousel, { slides, autoplay: true, autoplayInterval: 100 });
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
    const viewport = requiredInstance(
      container.querySelector('.cinder-carousel__viewport'),
      HTMLElement,
    );
    await tick();
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
    await tick();
    expectActiveSlide(container, 0);
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
    const viewport = requiredInstance(
      container.querySelector('.cinder-carousel__viewport'),
      HTMLElement,
    );

    await fireEvent.wheel(viewport, { deltaX: 40 });
    jest.advanceTimersByTime(50);
    expectActiveSlide(container, 0);
  });

  test('pauses autoplay while shift-wheel scrolling settles', async () => {
    jest.useFakeTimers();
    const { container } = render(Carousel, { slides, autoplay: true, autoplayInterval: 10 });
    const viewport = requiredInstance(
      container.querySelector('.cinder-carousel__viewport'),
      HTMLElement,
    );

    await fireEvent.wheel(viewport, { shiftKey: true, deltaX: 0, deltaY: 40 });
    jest.advanceTimersByTime(50);
    expectActiveSlide(container, 0);
  });

  test('ignores an ordinary vertical wheel event while a programmatic scroll is pending', async () => {
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

    await fireEvent.wheel(viewport, { deltaY: 40 });

    expect(liveRegion?.getAttribute('aria-live')).toBe('off');
  });
});
