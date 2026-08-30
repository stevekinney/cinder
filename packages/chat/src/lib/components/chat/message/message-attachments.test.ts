import { afterEach, describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { setupHappyDom } from '../../../test/happy-dom.ts';

setupHappyDom();

const { render, cleanup } = await import('@testing-library/svelte');
const { default: MessageAttachments } = await import('./message-attachments.svelte');

afterEach(() => cleanup());

const source = readFileSync(resolve(import.meta.dir, 'message-attachments.svelte'), 'utf8');

describe('MessageAttachments image layout contract', () => {
  test('renders a resting placeholder box without changing the image element shape', () => {
    const { container } = render(MessageAttachments, {
      props: { images: [{ type: 'image', url: 'portrait.png', text: 'Portrait' }] },
    });
    const figure = container.querySelector<HTMLElement>('.message-attachment');
    const button = container.querySelector('.message-attachment-button');
    const image = container.querySelector('.message-attachment-image');

    expect(figure?.hasAttribute('data-cinder-image-placeholder')).toBe(true);
    expect(figure?.style.aspectRatio).toBe('');
    expect(button?.contains(image)).toBe(true);
    expect(image?.getAttribute('width')).toBeNull();
    expect(image?.getAttribute('height')).toBeNull();
  });

  test('reserves intrinsic image geometry and has a fallback placeholder ratio', () => {
    expect(source).toContain('aspect-ratio: 4 / 3');
    expect(source).toContain('aspect-ratio: ${dimensions.width} / ${dimensions.height}');
    expect(source).toContain('width={dimensions?.width}');
    expect(source).toContain('height={dimensions?.height}');
    expect(source).toContain('background: var(--cinder-surface-inset)');
  });

  test('keeps lazy asynchronous image loading', () => {
    expect(source).toContain("loading?: 'lazy' | 'eager'");
    expect(source).toContain('{loading}');
    expect(source).toContain('decoding="async"');
  });

  test('provides a keyboard-operable maximize affordance', () => {
    expect(source).toContain("import { Maximize2 } from '@lostgradient/cinder/icons'");
    expect(source).toContain('aria-label={`View image: ${alt}`}');
    expect(source).toContain('title="Maximize image"');
    expect(source).toContain(
      '.message-attachment-button:focus-visible .message-attachment-maximize',
    );
    expect(source).toContain('aria-hidden="true"');
  });

  test('disables affordance transitions for reduced motion', () => {
    expect(source).toContain('@media (prefers-reduced-motion: reduce)');
    expect(source).toContain('.message-attachment-maximize');
    expect(source).toContain('transition: none');
  });
});
