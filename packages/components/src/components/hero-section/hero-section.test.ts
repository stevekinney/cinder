/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

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
});
