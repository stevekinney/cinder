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

describe('onSlideChange', () => {
  test('fires with the new index and slide when internal navigation moves the active slide', async () => {
    const onSlideChange = jest.fn();
    const { container } = render(Carousel, { slides, onSlideChange });
    const controls = container.querySelectorAll('.cinder-carousel__control');

    await fireEvent.click(requiredInstance(controls[1], HTMLButtonElement));

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

    await fireEvent.click(requiredInstance(controls[0], HTMLButtonElement));

    expect(onSlideChange).not.toHaveBeenCalled();
  });
});
