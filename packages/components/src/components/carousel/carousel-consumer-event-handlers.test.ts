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

describe('consumer event handlers', () => {
  test('invokes a consumer onkeydown before internal navigation', async () => {
    const onkeydown = jest.fn();
    const { container } = render(Carousel, { slides, onkeydown });
    const root = requiredInstance(container.querySelector('.cinder-carousel'), HTMLElement);

    await fireEvent.keyDown(root, { key: 'ArrowRight' });

    expect(onkeydown).toHaveBeenCalled();
    expectActiveSlide(container, 1);
  });

  test('lets a consumer onkeydown preventDefault suppress arrow-key navigation', async () => {
    const { container } = render(Carousel, {
      slides,
      onkeydown: (event: KeyboardEvent) => event.preventDefault(),
    });
    const root = requiredInstance(container.querySelector('.cinder-carousel'), HTMLElement);

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
    const root = requiredInstance(container.querySelector('.cinder-carousel'), HTMLElement);

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
