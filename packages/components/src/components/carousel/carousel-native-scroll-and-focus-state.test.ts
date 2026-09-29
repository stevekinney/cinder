/// <reference lib="dom" />

import { afterEach, describe, expect, jest, test } from 'bun:test';

import { requiredInstance, setupHappyDom } from '@lostgradient/testing';
import { requiredChildren, TestResizeObserver } from './carousel-test-helpers.ts';

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

describe('Carousel', () => {
  test('waits for native scrolling to settle before realigning', async () => {
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
    expect(container.querySelector('.cinder-carousel')?.getAttribute('tabindex')).toBe('-1');
  });

  test('makes the scrollable viewport keyboard focusable for slide navigation', async () => {
    const { container } = render(Carousel, { slides });
    const viewport = requiredInstance(
      container.querySelector('.cinder-carousel__viewport'),
      HTMLElement,
    );
    expect(viewport.getAttribute('role')).toBe('group');
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
    const root = requiredInstance(container.querySelector('.cinder-carousel'), HTMLElement);
    const link = requiredInstance(
      container.querySelector('.cinder-carousel__link'),
      HTMLAnchorElement,
    );
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
    const viewport = requiredInstance(
      container.querySelector('.cinder-carousel__viewport'),
      HTMLElement,
    );
    const link = requiredInstance(
      container.querySelector('.cinder-carousel__link'),
      HTMLAnchorElement,
    );
    const slideElements = requiredChildren(viewport);
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
    const root = requiredInstance(container.querySelector('.cinder-carousel'), HTMLElement);
    if (!nextButton) throw new Error('Missing next control.');
    nextButton.focus();

    await fireEvent.keyDown(nextButton, { key: 'ArrowRight' });

    expect(document.activeElement).toBe(nextButton);
    expect(document.activeElement).not.toBe(root);
  });

  test('leaves modified carousel shortcuts to the focused target', () => {
    const { container } = render(Carousel, { slides });
    const root = requiredInstance(container.querySelector('.cinder-carousel'), HTMLElement);
    const event = new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });

    root.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expectActiveSlide(container, 0);
  });

  test('leaves carousel shortcuts to editable slide content', () => {
    const { container } = render(Carousel, { slides });
    const activeSlide = requiredInstance(
      container.querySelector('article.cinder-carousel__slide'),
      HTMLElement,
    );
    const input = document.createElement('input');
    activeSlide.append(input);
    input.focus();
    const event = new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      bubbles: true,
      cancelable: true,
    });

    input.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expectActiveSlide(container, 0);
  });

  test('leaves carousel shortcuts to a textarea in slide content', () => {
    const { container } = render(Carousel, { slides });
    const activeSlide = requiredInstance(
      container.querySelector('article.cinder-carousel__slide'),
      HTMLElement,
    );
    const textarea = document.createElement('textarea');
    activeSlide.append(textarea);
    textarea.focus();
    const event = new KeyboardEvent('keydown', {
      key: 'ArrowLeft',
      bubbles: true,
      cancelable: true,
    });

    textarea.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expectActiveSlide(container, 0);
  });

  test('leaves carousel shortcuts to a select in slide content', () => {
    const { container } = render(Carousel, { slides });
    const activeSlide = requiredInstance(
      container.querySelector('article.cinder-carousel__slide'),
      HTMLElement,
    );
    const select = document.createElement('select');
    select.append(document.createElement('option'), document.createElement('option'));
    activeSlide.append(select);
    select.focus();
    const event = new KeyboardEvent('keydown', {
      key: 'Home',
      bubbles: true,
      cancelable: true,
    });

    select.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expectActiveSlide(container, 0);
  });

  test('leaves carousel shortcuts to contenteditable slide content', () => {
    const { container } = render(Carousel, { slides });
    const activeSlide = requiredInstance(
      container.querySelector('article.cinder-carousel__slide'),
      HTMLElement,
    );
    const editable = document.createElement('div');
    editable.contentEditable = 'true';
    editable.tabIndex = 0;
    activeSlide.append(editable);
    editable.focus();
    const event = new KeyboardEvent('keydown', {
      key: 'End',
      bubbles: true,
      cancelable: true,
    });

    editable.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expectActiveSlide(container, 0);
  });

  test('leaves carousel shortcuts to nested keyboard widgets', () => {
    const { container } = render(Carousel, { slides });
    const activeSlide = requiredInstance(
      container.querySelector('article.cinder-carousel__slide'),
      HTMLElement,
    );
    const nestedButton = document.createElement('button');
    nestedButton.type = 'button';
    nestedButton.textContent = 'Nested action';
    activeSlide.append(nestedButton);
    nestedButton.focus();
    const event = new KeyboardEvent('keydown', {
      key: 'End',
      bubbles: true,
      cancelable: true,
    });

    nestedButton.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expectActiveSlide(container, 0);
  });

  test('renders the rotation control first when autoplay is enabled', () => {
    const { container } = render(Carousel, {
      slides,
      autoplay: true,
      controlLabels: {
        pause: 'Stop rotation',
        play: 'Resume rotation',
      },
    });
    const firstButton = requiredInstance(container.querySelector('button'), HTMLButtonElement);

    expect(firstButton.classList.contains('cinder-carousel__control--pause')).toBe(true);
    expect(firstButton.textContent).toBe('Stop rotation');
    expect(firstButton.getAttribute('aria-label')).toBe('Stop rotation');
  });

  test('does not clear initial alignment while the viewport is hidden', async () => {
    const originalResizeObserver = globalThis.ResizeObserver;
    Object.defineProperty(globalThis, 'ResizeObserver', {
      configurable: true,
      value: TestResizeObserver,
    });
    try {
      const { container } = render(Carousel, { slides, activeIndex: 2 });
      const viewport = requiredInstance(
        container.querySelector('.cinder-carousel__viewport'),
        HTMLElement,
      );
      const slideElements = requiredChildren(viewport);
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
      const observer = TestResizeObserver.latest;
      if (!observer) throw new Error('ResizeObserver was not constructed');
      observer.trigger(300);
      await waitFor(() => expect(slideElements[2]?.getAttribute('aria-hidden')).toBeNull());
      expect(slideElements[2]?.hasAttribute('inert')).toBe(false);
      const scrollTo = jest.fn();
      Object.defineProperty(viewport, 'scrollTo', { configurable: true, value: scrollTo });
      observer.trigger(300, 600);
      expect(scrollTo).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(globalThis, 'ResizeObserver', {
        configurable: true,
        value: originalResizeObserver,
      });
    }
  });

  test('reconciles after a hidden viewport returns to its cached width', async () => {
    const originalResizeObserver = globalThis.ResizeObserver;
    Object.defineProperty(globalThis, 'ResizeObserver', {
      configurable: true,
      value: TestResizeObserver,
    });
    try {
      const { container, rerender } = render(Carousel, { slides });
      const viewport = requiredInstance(
        container.querySelector('.cinder-carousel__viewport'),
        HTMLElement,
      );
      const slideElements = requiredChildren(viewport);
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

      const observer = TestResizeObserver.latest;
      if (!observer) throw new Error('ResizeObserver was not constructed');
      observer.trigger(300);
      scrollTo.mockClear();
      observer.trigger(0);
      await rerender({ slides, activeIndex: 1 });
      observer.trigger(300);

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
    const viewport = requiredInstance(
      container.querySelector('.cinder-carousel__viewport'),
      HTMLElement,
    );
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
});
