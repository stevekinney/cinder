/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

// setupHappyDom() MUST run before any `@testing-library/svelte` import. testing-library
// reads `globalThis.document` / `window` at module-init (top-level, not inside test bodies),
// so we register happy-dom's globals first and then dynamic-import testing-library below.
setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { default: FeatureSection } = await import('./feature-section.svelte');
const { createRawSnippet } = await import('svelte');
const runtimePatchSnippet = createRawSnippet(() => ({
  render: () => '<span></span>',
  setup: () => {},
}));
void runtimePatchSnippet;

const items = [
  { title: 'Fast setup', description: 'Get started in minutes.', icon: '⚡' },
  { title: 'Accessible defaults', description: 'WCAG-minded components.', icon: '♿' },
];

describe('FeatureSection', () => {
  test('renders heading and feature items', () => {
    const { container } = render(FeatureSection, {
      props: {
        title: 'Everything you need',
        description: 'Powerful defaults for modern apps.',
        items,
      },
    });

    const element = container.querySelector('.cinder-feature-section');
    expect(element).not.toBeNull();
    expect(container.querySelector('.cinder-feature-section__title')?.textContent).toContain(
      'Everything you need',
    );
    expect(container.querySelectorAll('.cinder-feature-section__item')).toHaveLength(2);
    expect(container.querySelector('.cinder-feature-section__item-title')?.textContent).toContain(
      'Fast setup',
    );
  });

  test('applies split layout and media position attributes', () => {
    const { container } = render(FeatureSection, {
      props: {
        title: 'Split features',
        items,
        layout: 'split',
        mediaPosition: 'start',
      },
    });
    const root = container.querySelector('.cinder-feature-section');
    expect(root?.getAttribute('data-cinder-layout')).toBe('split');
    expect(root?.getAttribute('data-cinder-media-position')).toBe('start');
  });

  test('merges custom class with root class', () => {
    const { container } = render(FeatureSection, {
      props: {
        title: 'Features',
        items,
        class: 'my-custom-class',
      },
    });
    const element = container.querySelector('.cinder-feature-section');
    expect(element?.classList.contains('cinder-feature-section')).toBe(true);
    expect(element?.classList.contains('my-custom-class')).toBe(true);
  });
});
