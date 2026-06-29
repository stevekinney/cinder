/// <reference lib="dom" />
import { describe, expect, mock, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

// setupHappyDom() MUST run before any `@testing-library/svelte` import. testing-library
// reads `globalThis.document` / `window` at module-init (top-level, not inside test bodies),
// so we register happy-dom's globals first and then dynamic-import testing-library below.
setupHappyDom();

const { fireEvent, render } = await import('@testing-library/svelte');
const { default: NewsletterSection } = await import('./newsletter-section.svelte');
const { createRawSnippet } = await import('svelte');
const runtimePatchSnippet = createRawSnippet(() => ({
  render: () => '<span></span>',
  setup: () => {},
}));
void runtimePatchSnippet;

describe('NewsletterSection', () => {
  test('renders heading copy and form controls', () => {
    const { container } = render(NewsletterSection, {
      props: {
        title: 'Stay in the loop',
        description: 'Monthly product updates.',
      },
    });
    const element = container.querySelector('.cinder-newsletter-section');
    expect(element).not.toBeNull();
    expect(container.querySelector('.cinder-newsletter-section__title')?.textContent).toContain(
      'Stay in the loop',
    );
    expect(container.querySelector('input[type="email"]')).not.toBeNull();
    expect(container.querySelector('button[type="submit"]')).not.toBeNull();
  });

  test('calls onSubmit with trimmed email from input value', async () => {
    const onSubmit = mock(() => {});
    const { container } = render(NewsletterSection, {
      props: {
        title: 'Subscribe',
        onSubmit,
      },
    });
    const input = container.querySelector('input[type="email"]');
    const form = container.querySelector('form');
    expect(input).not.toBeNull();
    expect(form).not.toBeNull();
    (input as HTMLInputElement).value = '  dev@example.com  ';
    await fireEvent.input(input!);
    await fireEvent.submit(form!);
    expect(onSubmit).toHaveBeenCalledWith('dev@example.com');
  });

  test('renders consent text when provided', () => {
    const { container } = render(NewsletterSection, {
      props: {
        title: 'Newsletter',
        consentText: 'No spam. Unsubscribe anytime.',
      },
    });
    expect(container.querySelector('.cinder-newsletter-section__consent')?.textContent).toContain(
      'No spam. Unsubscribe anytime.',
    );
  });

  test('merges custom class alongside root class', () => {
    const { container } = render(NewsletterSection, {
      props: {
        title: 'Newsletter',
        class: 'my-custom-class',
      },
    });
    const element = container.querySelector('.cinder-newsletter-section');
    expect(element?.classList.contains('cinder-newsletter-section')).toBe(true);
    expect(element?.classList.contains('my-custom-class')).toBe(true);
  });
});
