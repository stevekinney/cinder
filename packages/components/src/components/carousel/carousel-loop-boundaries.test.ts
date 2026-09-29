/// <reference lib="dom" />

import { afterEach, describe, expect, jest, test } from 'bun:test';

import { requiredInstance, setupHappyDom } from '@lostgradient/testing';

setupHappyDom();

const { cleanup, fireEvent, render } = await import('@testing-library/svelte');
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

describe('loop (default false)', () => {
  test('clamps at the last slide instead of wrapping by default', async () => {
    const { container } = render(Carousel, { slides, activeIndex: 2 });
    const controls = container.querySelectorAll('.cinder-carousel__control');
    const nextButton = requiredInstance(controls[1], HTMLButtonElement);

    await fireEvent.click(nextButton);

    expectActiveSlide(container, 2);
  });

  test('clamps at the first slide instead of wrapping by default', async () => {
    const { container } = render(Carousel, { slides, activeIndex: 0 });
    const controls = container.querySelectorAll('.cinder-carousel__control');
    const previousButton = requiredInstance(controls[0], HTMLButtonElement);

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
    const root = requiredInstance(container.querySelector('.cinder-carousel'), HTMLElement);

    await fireEvent.keyDown(root, { key: 'ArrowLeft' });

    expectActiveSlide(container, 0);
  });
});
