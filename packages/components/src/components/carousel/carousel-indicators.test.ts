/// <reference lib="dom" />

import { afterEach, describe, expect, jest, test } from 'bun:test';

import { setupHappyDom } from '@lostgradient/testing';

setupHappyDom();

const { cleanup, render } = await import('@testing-library/svelte');
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
    expect(container.querySelector('.cinder-carousel__counter')?.textContent?.trim()).toBe('1 / 9');
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
    expect(container.querySelector('.cinder-carousel__counter')?.textContent?.trim()).toBe('1 / 3');
  });
});
