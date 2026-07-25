/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { setupHappyDom } from '../../test/happy-dom.ts';

// setupHappyDom() MUST run before any `@testing-library/svelte` import. testing-library
// reads `globalThis.document` / `window` at module-init (top-level, not inside test bodies),
// so we register happy-dom's globals first and then dynamic-import testing-library below.
setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { default: HeroSection } = await import('./hero-section.svelte');
const { createRawSnippet } = await import('svelte');
const runtimePatchSnippet = createRawSnippet(() => ({
  render: () => '<span></span>',
  setup: () => {},
}));
void runtimePatchSnippet;

const HERO_SECTION_CSS = readFileSync(join(import.meta.dir, 'hero-section.css'), 'utf8');

describe('HeroSection', () => {
  test('renders title and optional description copy', () => {
    const { container } = render(HeroSection, {
      props: {
        title: 'Ship faster with Cinder',
        description: 'Build polished interfaces in minutes.',
      },
    });

    const element = container.querySelector('.cinder-hero-section');
    expect(element).not.toBeNull();
    expect(container.querySelector('.cinder-hero-section__title')?.textContent).toContain(
      'Ship faster with Cinder',
    );
    expect(container.querySelector('.cinder-hero-section__description')?.textContent).toContain(
      'Build polished interfaces in minutes.',
    );
  });

  test('omits media data attribute when media snippet is not provided', () => {
    const { container } = render(HeroSection, {
      props: {
        title: 'Hero',
      },
    });
    expect(
      container.querySelector('.cinder-hero-section')?.hasAttribute('data-cinder-has-media'),
    ).toBe(false);
  });

  test('applies alignment and media position data attributes', () => {
    const { container } = render(HeroSection, {
      props: {
        title: 'Hero',
        align: 'center',
        mediaPosition: 'start',
      },
    });
    const root = container.querySelector('.cinder-hero-section');
    expect(root?.getAttribute('data-cinder-align')).toBe('center');
    expect(root?.getAttribute('data-cinder-media-position')).toBe('start');
  });

  test('merges custom class with cinder-hero-section root class', () => {
    const { container } = render(HeroSection, {
      props: {
        title: 'Hero',
        class: 'my-custom-class',
      },
    });

    const element = container.querySelector('.cinder-hero-section');
    expect(element?.classList.contains('cinder-hero-section')).toBe(true);
    expect(element?.classList.contains('my-custom-class')).toBe(true);
  });

  test('gives intrinsic media a full-width aspect-ratio box without a card frame', () => {
    const media = createRawSnippet(() => ({
      render: () => '<img src="placeholder.png" alt="Product preview" />',
    }));
    const { container } = render(HeroSection, {
      props: { title: 'Hero', media },
    });

    expect(container.querySelector('.cinder-hero-section__media-ratio')).not.toBeNull();
    expect(container.querySelector('.cinder-hero-section__media img')?.getAttribute('alt')).toBe(
      'Product preview',
    );
    expect(HERO_SECTION_CSS).toContain('inline-size: 100%;');
    expect(HERO_SECTION_CSS).toContain('position: absolute;');
    expect(HERO_SECTION_CSS).not.toContain('cinder-hero-section__media {\n    border:');
  });

  test('splits media layouts at the 48rem container threshold', () => {
    expect(HERO_SECTION_CSS).toContain('@container cinder-hero-section (min-width: 48rem)');
    expect(HERO_SECTION_CSS).not.toContain('@container cinder-hero-section (min-width: 64rem)');
  });
});
