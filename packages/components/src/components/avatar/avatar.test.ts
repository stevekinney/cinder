/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { default: Avatar } = await import('./avatar.svelte');

describe('Avatar', () => {
  test('renders an <img> when src is supplied', () => {
    const { container } = render(Avatar, { src: '/me.jpg', alt: 'Alice' });
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img?.getAttribute('src')).toBe('/me.jpg');
    expect(img?.getAttribute('alt')).toBe('Alice');
  });

  test('falls back to alt = name when alt is omitted', () => {
    const { container } = render(Avatar, { src: '/me.jpg', name: 'Alice' });
    const img = container.querySelector('img');
    expect(img?.getAttribute('alt')).toBe('Alice');
  });

  test('renders initials when no src is supplied', () => {
    const { container } = render(Avatar, { name: 'Alice Smith' });
    const initials = container.querySelector('.cinder-avatar__initials');
    expect(initials?.textContent).toBe('AS');
  });

  test('initials use only the first two name parts', () => {
    const { container } = render(Avatar, { name: 'Alice Mary Smith' });
    const initials = container.querySelector('.cinder-avatar__initials');
    expect(initials?.textContent).toBe('AM');
  });

  test('size prop sets data-cinder-size', () => {
    const { container } = render(Avatar, { name: 'A', size: 'lg' });
    expect(container.querySelector('.cinder-avatar')?.getAttribute('data-cinder-size')).toBe('lg');
  });

  test('shape prop defaults to circle', () => {
    const { container } = render(Avatar, { name: 'A' });
    expect(container.querySelector('.cinder-avatar')?.getAttribute('data-cinder-shape')).toBe(
      'circle',
    );
  });

  test('shape=square sets the data attribute', () => {
    const { container } = render(Avatar, { name: 'A', shape: 'square' });
    expect(container.querySelector('.cinder-avatar')?.getAttribute('data-cinder-shape')).toBe(
      'square',
    );
  });

  test('renders empty placeholder when neither src nor name is provided', () => {
    const { container } = render(Avatar, {});
    const placeholder = container.querySelector('.cinder-avatar__placeholder');
    expect(placeholder).not.toBeNull();
  });

  test('sr-only span exposes accessible name to AT when falling back to initials', () => {
    const { container } = render(Avatar, { name: 'Alice' });
    const srOnly = container.querySelector('.cinder-sr-only');
    expect(srOnly).not.toBeNull();
    expect(srOnly?.textContent).toBe('Alice');
    expect(srOnly?.getAttribute('aria-hidden')).not.toBe('true');
  });
});
