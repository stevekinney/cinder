/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../test/happy-dom.ts';

setupHappyDom();

const { render, fireEvent } = await import('@testing-library/svelte');
const { default: Image } = await import('./image.svelte');
const { default: ImageWithFallback } =
  await import('../test/fixtures/image-fallback-fixture.svelte');

describe('Image', () => {
  test('renders an <img> with the given src and alt', () => {
    const { container } = render(Image, { src: '/a.jpg', alt: 'A photo' });
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img?.getAttribute('src')).toBe('/a.jpg');
    expect(img?.getAttribute('alt')).toBe('A photo');
  });

  test('defaults to loading="lazy" and decoding="async"', () => {
    const { container } = render(Image, { src: '/a.jpg', alt: 'A' });
    const img = container.querySelector('img');
    expect(img?.getAttribute('loading')).toBe('lazy');
    expect(img?.getAttribute('decoding')).toBe('async');
  });

  test('allows overriding loading="eager" for above-the-fold images', () => {
    const { container } = render(Image, { src: '/a.jpg', alt: 'A', loading: 'eager' });
    expect(container.querySelector('img')?.getAttribute('loading')).toBe('eager');
  });

  test('passes through empty alt for decorative images without modification', () => {
    const { container } = render(Image, { src: '/decoration.svg', alt: '' });
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img?.getAttribute('alt')).toBe('');
  });

  test('forwards width and height attributes', () => {
    const { container } = render(Image, { src: '/a.jpg', alt: 'A', width: 320, height: 240 });
    const img = container.querySelector('img');
    expect(img?.getAttribute('width')).toBe('320');
    expect(img?.getAttribute('height')).toBe('240');
  });

  test('does not render a wrapper when neither ratio nor placeholder is provided', () => {
    const { container } = render(Image, { src: '/a.jpg', alt: 'A' });
    expect(container.querySelector('div.cinder-image')).toBeNull();
    expect(container.querySelector('img.cinder-image')).not.toBeNull();
  });

  test('renders a wrapper with aspect-ratio when ratio is provided', () => {
    const { container } = render(Image, { src: '/a.jpg', alt: 'A', ratio: '16 / 9' });
    const wrapper = container.querySelector('div.cinder-image');
    expect(wrapper).not.toBeNull();
    expect((wrapper as HTMLElement).style.aspectRatio).toBe('16 / 9');
    expect(wrapper?.querySelector('img.cinder-image__img')).not.toBeNull();
  });

  test('renders a wrapper with background-image when placeholder is provided', () => {
    const placeholder = 'data:image/png;base64,iVBORw0KGgo=';
    const { container } = render(Image, { src: '/a.jpg', alt: 'A', placeholder });
    const wrapper = container.querySelector<HTMLElement>('div.cinder-image');
    expect(wrapper).not.toBeNull();
    expect(wrapper?.style.backgroundImage).toContain(placeholder);
  });

  test('applies object-fit to the <img>', () => {
    const { container } = render(Image, {
      src: '/a.jpg',
      alt: 'A',
      ratio: '1 / 1',
      objectFit: 'contain',
    });
    const img = container.querySelector('img');
    expect(img?.style.objectFit).toBe('contain');
  });

  test('object-fit defaults to cover', () => {
    const { container } = render(Image, { src: '/a.jpg', alt: 'A' });
    const img = container.querySelector('img');
    expect(img?.style.objectFit).toBe('cover');
  });

  test('toggles data-cinder-loaded on the wrapper after the img loads', async () => {
    const { container } = render(Image, { src: '/a.jpg', alt: 'A', ratio: '1 / 1' });
    const wrapper = container.querySelector('div.cinder-image');
    expect(wrapper?.hasAttribute('data-cinder-loaded')).toBe(false);
    const img = container.querySelector('img')!;
    await fireEvent.load(img);
    expect(wrapper?.hasAttribute('data-cinder-loaded')).toBe(true);
  });

  test('renders fallback snippet when the image errors', async () => {
    const { container } = render(ImageWithFallback, { src: '/missing.jpg', alt: 'Missing' });
    // Before error, img is rendered.
    expect(container.querySelector('img')).not.toBeNull();
    const img = container.querySelector('img')!;
    await fireEvent.error(img);
    // After error, img is unmounted and fallback shows.
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('[data-testid="image-fallback"]')?.textContent).toBe(
      'Could not load image',
    );
  });

  test('without a fallback snippet, an error leaves the img in place', async () => {
    const { container } = render(Image, { src: '/broken.jpg', alt: 'Broken' });
    const img = container.querySelector('img')!;
    await fireEvent.error(img);
    expect(container.querySelector('img')).not.toBeNull();
  });

  test('forwards extra HTML attributes onto the <img>', () => {
    const { container } = render(Image, {
      src: '/a.jpg',
      alt: 'A',
      id: 'hero-image',
      'data-testid': 'hero',
    });
    const img = container.querySelector('img');
    expect(img?.getAttribute('id')).toBe('hero-image');
    expect(img?.getAttribute('data-testid')).toBe('hero');
  });

  test('class prop is merged with .cinder-image on the bare img variant', () => {
    const { container } = render(Image, { src: '/a.jpg', alt: 'A', class: 'extra' });
    const img = container.querySelector('img');
    expect(img?.className).toContain('cinder-image');
    expect(img?.className).toContain('extra');
  });

  test('class prop is merged with .cinder-image on the wrapper variant', () => {
    const { container } = render(Image, { src: '/a.jpg', alt: 'A', ratio: '1 / 1', class: 'hero' });
    const wrapper = container.querySelector('div.cinder-image');
    expect(wrapper?.className).toContain('cinder-image');
    expect(wrapper?.className).toContain('hero');
  });
});
