/// <reference lib="dom" />
import { join } from 'node:path';

import { afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';
import { renderToServerHtml } from '../../test/server-render.ts';

setupHappyDom();

const IMAGE_SOURCE = join(import.meta.dir, 'image.svelte');

const { render, fireEvent, cleanup } = await import('@testing-library/svelte');
const { default: Image } = await import('./image.svelte');
const { default: ImageWithFallback } =
  await import('../../test/fixtures/image-fallback-fixture.svelte');

afterEach(() => {
  cleanup();
});

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

  test('always renders a wrapper containing the img', () => {
    const { container } = render(Image, { src: '/a.jpg', alt: 'A' });
    const wrapper = container.querySelector('div.cinder-image');
    expect(wrapper).not.toBeNull();
    expect(wrapper?.querySelector('img.cinder-image__img')).not.toBeNull();
  });

  test('applies aspect-ratio to the wrapper when ratio is provided', () => {
    const { container } = render(Image, { src: '/a.jpg', alt: 'A', ratio: '16 / 9' });
    const wrapper = container.querySelector<HTMLElement>('div.cinder-image');
    expect(wrapper).not.toBeNull();
    expect(wrapper?.style.aspectRatio).toBe('16 / 9');
  });

  test('does not apply aspect-ratio when ratio is omitted', () => {
    const { container } = render(Image, { src: '/a.jpg', alt: 'A' });
    const wrapper = container.querySelector<HTMLElement>('div.cinder-image');
    expect(wrapper?.style.aspectRatio).toBe('');
  });

  test('applies a quoted background-image when placeholder is provided', () => {
    const placeholder = 'data:image/png;base64,iVBORw0KGgo=';
    const { container } = render(Image, { src: '/a.jpg', alt: 'A', placeholder });
    const wrapper = container.querySelector<HTMLElement>('div.cinder-image');
    expect(wrapper?.style.backgroundImage).toContain(placeholder);
    expect(wrapper?.style.backgroundImage).toContain('"');
  });

  test('quotes placeholder URLs so values with special characters remain valid', () => {
    const placeholder = 'https://cdn.example.com/p.jpg?w=20&blur=10';
    const { container } = render(Image, { src: '/a.jpg', alt: 'A', placeholder });
    const wrapper = container.querySelector<HTMLElement>('div.cinder-image');
    expect(wrapper?.style.backgroundImage).toContain(placeholder);
    expect(wrapper?.style.backgroundImage).toContain('url("');
  });

  test('does not set background-image when placeholder is absent', () => {
    const { container } = render(Image, { src: '/a.jpg', alt: 'A', ratio: '1 / 1' });
    const wrapper = container.querySelector<HTMLElement>('div.cinder-image');
    expect(wrapper?.style.backgroundImage).toBe('');
  });

  test('toggles data-cinder-loaded on the wrapper after the img loads', async () => {
    const { container } = render(Image, { src: '/a.jpg', alt: 'A' });
    const wrapper = container.querySelector('div.cinder-image');
    expect(wrapper?.hasAttribute('data-cinder-loaded')).toBe(false);
    const img = container.querySelector('img')!;
    await fireEvent.load(img);
    expect(wrapper?.hasAttribute('data-cinder-loaded')).toBe(true);
  });

  test('toggles data-cinder-errored on the wrapper after the img errors', async () => {
    const { container } = render(Image, { src: '/broken.jpg', alt: 'Broken' });
    const wrapper = container.querySelector('div.cinder-image');
    expect(wrapper?.hasAttribute('data-cinder-errored')).toBe(false);
    const img = container.querySelector('img')!;
    await fireEvent.error(img);
    expect(wrapper?.hasAttribute('data-cinder-errored')).toBe(true);
  });

  test('resets loaded state when src changes', async () => {
    const { container, rerender } = render(Image, { src: '/a.jpg', alt: 'A' });
    const wrapper = container.querySelector('div.cinder-image');
    await fireEvent.load(container.querySelector('img')!);
    expect(wrapper?.hasAttribute('data-cinder-loaded')).toBe(true);
    await rerender({ src: '/b.jpg', alt: 'A' });
    expect(wrapper?.hasAttribute('data-cinder-loaded')).toBe(false);
  });

  test('resets errored state when src changes', async () => {
    const { container, rerender } = render(Image, { src: '/broken.jpg', alt: 'A' });
    const wrapper = container.querySelector('div.cinder-image');
    await fireEvent.error(container.querySelector('img')!);
    expect(wrapper?.hasAttribute('data-cinder-errored')).toBe(true);
    await rerender({ src: '/fixed.jpg', alt: 'A' });
    expect(wrapper?.hasAttribute('data-cinder-errored')).toBe(false);
  });

  test('renders fallback snippet when the image errors and a fallback is provided', async () => {
    const { container } = render(ImageWithFallback, { src: '/missing.jpg', alt: 'Missing' });
    expect(container.querySelector('img')).not.toBeNull();
    const img = container.querySelector('img')!;
    await fireEvent.error(img);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('[data-testid="image-fallback"]')?.textContent).toBe(
      'Could not load image',
    );
  });

  test('renders fallback inside the wrapper when ratio is set', async () => {
    const { container } = render(ImageWithFallback, {
      src: '/missing.jpg',
      alt: 'Missing',
      ratio: '16 / 9',
    });
    const img = container.querySelector('img')!;
    await fireEvent.error(img);
    const wrapper = container.querySelector('div.cinder-image');
    expect(wrapper).not.toBeNull();
    expect((wrapper as HTMLElement).style.aspectRatio).toBe('16 / 9');
    expect(wrapper?.querySelector('[data-testid="image-fallback"]')?.textContent).toBe(
      'Could not load image',
    );
  });

  test('sets role="img" and aria-label on the wrapper when fallback renders', async () => {
    const { container } = render(ImageWithFallback, { src: '/missing.jpg', alt: 'A duck' });
    await fireEvent.error(container.querySelector('img')!);
    const wrapper = container.querySelector('div.cinder-image');
    expect(wrapper?.getAttribute('role')).toBe('img');
    expect(wrapper?.getAttribute('aria-label')).toBe('A duck');
  });

  test('does not set role or aria-label before the fallback activates', () => {
    const { container } = render(ImageWithFallback, { src: '/missing.jpg', alt: 'A duck' });
    const wrapper = container.querySelector('div.cinder-image');
    expect(wrapper?.hasAttribute('role')).toBe(false);
    expect(wrapper?.hasAttribute('aria-label')).toBe(false);
  });

  test('without a fallback snippet, an error keeps the img in place and marks the wrapper', async () => {
    const placeholder = 'data:image/png;base64,iVBORw0KGgo=';
    const { container } = render(Image, { src: '/broken.jpg', alt: 'Broken', placeholder });
    const img = container.querySelector('img')!;
    await fireEvent.error(img);
    expect(container.querySelector('img')).not.toBeNull();
    const wrapper = container.querySelector('div.cinder-image');
    expect(wrapper?.hasAttribute('data-cinder-errored')).toBe(true);
  });

  test('calls consumer onload after the internal state mutation', async () => {
    // Contract: handleLoad mutates loadedSource BEFORE invoking the consumer
    // callback. The DOM reflects the new state on the next microtask, so we
    // verify (a) the callback fired, (b) data-cinder-loaded is set once the
    // task settles.
    let handlerCalled = false;
    const { container } = render(Image, {
      src: '/a.jpg',
      alt: 'A',
      onload: () => {
        handlerCalled = true;
      },
    });
    await fireEvent.load(container.querySelector('img')!);
    expect(handlerCalled).toBe(true);
    expect(container.querySelector('div.cinder-image')?.hasAttribute('data-cinder-loaded')).toBe(
      true,
    );
  });

  test('calls consumer onerror after the internal state mutation', async () => {
    let handlerCalled = false;
    const { container } = render(Image, {
      src: '/broken.jpg',
      alt: 'Broken',
      onerror: () => {
        handlerCalled = true;
      },
    });
    await fireEvent.error(container.querySelector('img')!);
    expect(handlerCalled).toBe(true);
    expect(container.querySelector('div.cinder-image')?.hasAttribute('data-cinder-errored')).toBe(
      true,
    );
  });

  test('treats a cached/already-complete <img> as loaded on mount', () => {
    // Pre-stamp the image prototype so the attachment's `complete`/`naturalWidth`
    // probes see a cached image. Restore the prototype after the assertion.
    const proto = window.HTMLImageElement.prototype;
    const completeDescriptor = Object.getOwnPropertyDescriptor(proto, 'complete');
    const naturalWidthDescriptor = Object.getOwnPropertyDescriptor(proto, 'naturalWidth');
    Object.defineProperty(proto, 'complete', { configurable: true, get: () => true });
    Object.defineProperty(proto, 'naturalWidth', { configurable: true, get: () => 100 });
    try {
      const { container } = render(Image, { src: '/relative/cached.jpg', alt: 'Cached' });
      const wrapper = container.querySelector('div.cinder-image');
      expect(wrapper?.hasAttribute('data-cinder-loaded')).toBe(true);
    } finally {
      if (completeDescriptor) {
        Object.defineProperty(proto, 'complete', completeDescriptor);
      } else {
        delete (proto as { complete?: boolean }).complete;
      }
      if (naturalWidthDescriptor) {
        Object.defineProperty(proto, 'naturalWidth', naturalWidthDescriptor);
      } else {
        delete (proto as { naturalWidth?: number }).naturalWidth;
      }
    }
  });

  test('sets data-cinder-fallback while the fallback renders', async () => {
    const { container } = render(ImageWithFallback, { src: '/missing.jpg', alt: 'Missing' });
    const wrapper = container.querySelector('div.cinder-image');
    expect(wrapper?.hasAttribute('data-cinder-fallback')).toBe(false);
    await fireEvent.error(container.querySelector('img')!);
    expect(wrapper?.hasAttribute('data-cinder-fallback')).toBe(true);
  });

  test('marks the fallback as aria-hidden for decorative images (alt="")', async () => {
    const { container } = render(ImageWithFallback, { src: '/missing.svg', alt: '' });
    await fireEvent.error(container.querySelector('img')!);
    const wrapper = container.querySelector('div.cinder-image');
    expect(wrapper?.getAttribute('aria-hidden')).toBe('true');
    expect(wrapper?.hasAttribute('role')).toBe(false);
    expect(wrapper?.hasAttribute('aria-label')).toBe(false);
  });

  test('clears the inline background-image after the image loads', async () => {
    const placeholder = 'data:image/png;base64,iVBORw0KGgo=';
    const { container } = render(Image, { src: '/a.jpg', alt: 'A', placeholder });
    const wrapper = container.querySelector<HTMLElement>('div.cinder-image');
    expect(wrapper?.style.backgroundImage).toContain(placeholder);
    await fireEvent.load(container.querySelector('img')!);
    expect(wrapper?.style.backgroundImage).toBe('');
  });

  test('clears the inline background-image after the image errors', async () => {
    const placeholder = 'data:image/png;base64,iVBORw0KGgo=';
    const { container } = render(Image, { src: '/broken.jpg', alt: 'Broken', placeholder });
    const wrapper = container.querySelector<HTMLElement>('div.cinder-image');
    expect(wrapper?.style.backgroundImage).toContain(placeholder);
    await fireEvent.error(container.querySelector('img')!);
    expect(wrapper?.style.backgroundImage).toBe('');
  });

  test('sets aria-hidden as a boolean attribute (not a string literal)', async () => {
    const { container } = render(ImageWithFallback, { src: '/missing.svg', alt: '' });
    await fireEvent.error(container.querySelector('img')!);
    const wrapper = container.querySelector('div.cinder-image');
    // The DOM serializes booleans as "true" — the source of truth is that the
    // attribute exists with value "true" regardless of input form. This test
    // pins the wire format consumers (and AT) actually see.
    expect(wrapper?.getAttribute('aria-hidden')).toBe('true');
  });

  test('restores the img when src changes while the fallback is active', async () => {
    const { container, rerender } = render(ImageWithFallback, {
      src: '/missing.jpg',
      alt: 'Missing',
    });
    await fireEvent.error(container.querySelector('img')!);
    expect(container.querySelectorAll('[data-testid="image-fallback"]').length).toBe(1);
    expect(container.querySelectorAll('img').length).toBe(0);
    await rerender({ src: '/fixed.jpg', alt: 'Missing' });
    expect(container.querySelectorAll('img').length).toBe(1);
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

  test('class prop is merged with .cinder-image on the wrapper', () => {
    const { container } = render(Image, { src: '/a.jpg', alt: 'A', class: 'hero' });
    const wrapper = container.querySelector('div.cinder-image');
    expect(wrapper?.className).toContain('cinder-image');
    expect(wrapper?.className).toContain('hero');
  });
});

// Unlike the dialog overlays, Image renders its wrapper and <img> on the
// server — only the load/error STATE is client-only. `loaded`/`errored` derive
// from `loadedSource`/`erroredSource`, which start null, and the cached-image
// probe runs inside the client-only `{@attach detectCached}`. So the server
// HTML must contain the wrapper and image but none of the state markers
// (`data-cinder-loaded`, `data-cinder-errored`, `data-cinder-fallback`) that
// only the client can set — otherwise SSR would assert a load state that
// hasn't happened yet and hydration would mismatch.
describe('Image SSR contract', () => {
  test('emits the wrapper and <img> server-side', async () => {
    const html = await renderToServerHtml(IMAGE_SOURCE, { src: '/a.jpg', alt: 'A photo' });
    expect(html).toContain('cinder-image');
    expect(html).toContain('cinder-image__img');
    expect(html).toContain('src="/a.jpg"');
    expect(html).toContain('alt="A photo"');
  });

  test('omits client-only load/error state markers server-side', async () => {
    const html = await renderToServerHtml(IMAGE_SOURCE, {
      src: '/a.jpg',
      alt: 'A photo',
      placeholder: 'data:image/png;base64,iVBORw0KGgo=',
    });
    expect(html).not.toContain('data-cinder-loaded');
    expect(html).not.toContain('data-cinder-errored');
    expect(html).not.toContain('data-cinder-fallback');
    // The placeholder background is still emitted because nothing has loaded.
    expect(html).toContain('background-image');
  });
});
