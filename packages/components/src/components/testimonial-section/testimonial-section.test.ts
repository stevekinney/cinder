/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

// setupHappyDom() MUST run before any `@testing-library/svelte` import. testing-library
// reads `globalThis.document` / `window` at module-init (top-level, not inside test bodies),
// so we register happy-dom's globals first and then dynamic-import testing-library below.
setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { default: TestimonialSection } = await import('./testimonial-section.svelte');
const { createRawSnippet } = await import('svelte');
const runtimePatchSnippet = createRawSnippet(() => ({
  render: () => '<span></span>',
  setup: () => {},
}));
void runtimePatchSnippet;

const testimonials = [
  {
    quote: 'Cinder cut our implementation time in half.',
    name: 'Alex Rivera',
    role: 'Staff Engineer',
    company: 'Northstar',
  },
  {
    quote: 'We ship polished interfaces every sprint.',
    name: 'Sam Kim',
    role: 'Product Designer',
    company: 'Orbit',
  },
];

describe('TestimonialSection', () => {
  test('renders testimonials with author metadata', () => {
    const { container } = render(TestimonialSection, {
      props: {
        title: 'Loved by product teams',
        testimonials,
      },
    });

    const element = container.querySelector('.cinder-testimonial-section');
    expect(element).not.toBeNull();
    expect(container.querySelectorAll('.cinder-testimonial-section__item')).toHaveLength(2);
    expect(container.querySelector('.cinder-testimonial-section__quote')?.textContent).toContain(
      'Cinder cut our implementation time in half.',
    );
    expect(container.querySelector('.cinder-testimonial-section__name')?.textContent).toContain(
      'Alex Rivera',
    );
  });

  test('supports single layout and column attributes', () => {
    const { container } = render(TestimonialSection, {
      props: {
        testimonials,
        layout: 'single',
        columns: 2,
      },
    });
    const root = container.querySelector('.cinder-testimonial-section');
    expect(root?.getAttribute('data-cinder-layout')).toBe('single');
    expect(root?.getAttribute('data-cinder-columns')).toBe('2');
  });

  test('merges custom class alongside base class', () => {
    const { container } = render(TestimonialSection, {
      props: {
        testimonials,
        class: 'my-custom-class',
      },
    });
    const element = container.querySelector('.cinder-testimonial-section');
    expect(element?.classList.contains('cinder-testimonial-section')).toBe(true);
    expect(element?.classList.contains('my-custom-class')).toBe(true);
  });
});
