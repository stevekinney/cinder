/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { createRawSnippet } = await import('svelte');
const { default: Sheet } = await import('./sheet.svelte');

function textSnippet(text: string) {
  return createRawSnippet(() => ({
    render: () => `<span>${text}</span>`,
  }));
}

describe('Sheet (experimental)', () => {
  test('renders a <dialog> with the configured title', () => {
    const { container } = render(Sheet, {
      open: true,
      title: 'Settings',
      children: textSnippet('Sheet body'),
    });
    const dialog = container.querySelector('dialog');
    expect(dialog).not.toBeNull();
    expect(container.querySelector('.cinder-sheet__title')?.textContent?.trim()).toBe('Settings');
  });

  test('data-cinder-edge attribute reflects the edge prop', () => {
    const { container } = render(Sheet, {
      open: true,
      title: 'X',
      edge: 'left',
      children: textSnippet('body'),
    });
    expect(container.querySelector('dialog')?.getAttribute('data-cinder-edge')).toBe('left');
  });

  test('data-cinder-size attribute reflects the size prop', () => {
    const { container } = render(Sheet, {
      open: true,
      title: 'X',
      size: 'lg',
      children: textSnippet('body'),
    });
    expect(container.querySelector('dialog')?.getAttribute('data-cinder-size')).toBe('lg');
  });

  test('aria-modal=true by default', () => {
    const { container } = render(Sheet, {
      open: true,
      title: 'X',
      children: textSnippet('body'),
    });
    expect(container.querySelector('dialog')?.getAttribute('aria-modal')).toBe('true');
  });

  test('nonModal=true omits aria-modal', () => {
    const { container } = render(Sheet, {
      open: true,
      title: 'X',
      nonModal: true,
      children: textSnippet('body'),
    });
    expect(container.querySelector('dialog')?.getAttribute('aria-modal')).toBeNull();
  });

  test('renders a close button with aria-label="Close"', () => {
    const { container } = render(Sheet, {
      open: true,
      title: 'X',
      children: textSnippet('body'),
    });
    const close = container.querySelector('.cinder-sheet__close');
    expect(close?.getAttribute('aria-label')).toBe('Close');
  });
});
