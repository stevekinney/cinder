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

  test('placeholder is decorative — it carries aria-hidden so it never appears as an anonymous node in the a11y tree', () => {
    const { container } = render(Avatar, {});
    const placeholder = container.querySelector('.cinder-avatar__placeholder');
    expect(placeholder?.getAttribute('aria-hidden')).toBe('true');
  });

  test('a consumer-supplied aria-label reaches the outer span, giving a placeholder-only avatar an accessible name', () => {
    const { container } = render(Avatar, { 'aria-label': 'Unassigned reviewer' });
    const root = container.querySelector('.cinder-avatar');
    expect(root?.getAttribute('aria-label')).toBe('Unassigned reviewer');
    // The inner placeholder stays decorative so the name is announced exactly once, on the root.
    expect(
      container.querySelector('.cinder-avatar__placeholder')?.getAttribute('aria-hidden'),
    ).toBe('true');
  });

  test('empty placeholder uses flat inset surface styling', async () => {
    const css = await Bun.file(new URL('./avatar.css', import.meta.url)).text();
    const placeholderBlock = css.match(/\.cinder-avatar__placeholder\s*\{[^}]*\}/)?.[0] ?? '';
    expect(placeholderBlock).not.toContain('linear-gradient');
    expect(placeholderBlock).toContain('background: var(--cinder-surface-inset)');
    expect(placeholderBlock).toContain('border: 1px solid var(--cinder-border-muted)');
  });

  test('falls back to initials when the image fails to load', async () => {
    const { container } = render(Avatar, { src: '/missing.jpg', name: 'Alice Smith' });
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    img?.dispatchEvent(new Event('error'));
    await Promise.resolve();
    expect(container.querySelector('img')).toBeNull();
    const initials = container.querySelector('.cinder-avatar__initials');
    expect(initials?.textContent).toBe('AS');
  });

  test('re-shows the image when src changes to a new URL after a failure', async () => {
    const { container, rerender } = render(Avatar, {
      src: '/missing.jpg',
      name: 'Alice Smith',
    });
    container.querySelector('img')?.dispatchEvent(new Event('error'));
    await Promise.resolve();
    expect(container.querySelector('img')).toBeNull();

    await rerender({ src: '/different.jpg', name: 'Alice Smith' });
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img?.getAttribute('src')).toBe('/different.jpg');
  });

  test('keeps the failure when the same failed src is re-set', async () => {
    const { container, rerender } = render(Avatar, {
      src: '/missing.jpg',
      name: 'Alice Smith',
    });
    container.querySelector('img')?.dispatchEvent(new Event('error'));
    await Promise.resolve();
    expect(container.querySelector('img')).toBeNull();

    await rerender({ src: '/missing.jpg', name: 'Alice Smith' });
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('.cinder-avatar__initials')?.textContent).toBe('AS');
  });

  test('sr-only span exposes accessible name to AT when falling back to initials', () => {
    const { container } = render(Avatar, { name: 'Alice' });
    const srOnly = container.querySelector('.cinder-sr-only');
    expect(srOnly).not.toBeNull();
    expect(srOnly?.textContent).toBe('Alice');
    expect(srOnly?.getAttribute('aria-hidden')).not.toBe('true');
  });
});
