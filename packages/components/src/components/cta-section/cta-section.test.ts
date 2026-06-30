/// <reference lib="dom" />
import { describe, expect, mock, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

// setupHappyDom() MUST run before any `@testing-library/svelte` import. testing-library
// reads `globalThis.document` / `window` at module-init (top-level, not inside test bodies),
// so we register happy-dom's globals first and then dynamic-import testing-library below.
setupHappyDom();

const { fireEvent, render } = await import('@testing-library/svelte');
const { default: CtaSection } = await import('./cta-section.svelte');
const { createRawSnippet } = await import('svelte');
const runtimePatchSnippet = createRawSnippet(() => ({
  render: () => '<span></span>',
  setup: () => {},
}));
void runtimePatchSnippet;

describe('CtaSection', () => {
  test('renders title, description, and action buttons', () => {
    const { container } = render(CtaSection, {
      props: {
        title: 'Ready to ship faster?',
        description: 'Start with Cinder today.',
        primaryActionLabel: 'Start free trial',
        secondaryActionLabel: 'Book demo',
      },
    });

    const element = container.querySelector('.cinder-cta-section');
    expect(element).not.toBeNull();
    expect(container.querySelector('.cinder-cta-section__title')?.textContent).toContain(
      'Ready to ship faster?',
    );
    expect(container.querySelector('.cinder-cta-section__description')?.textContent).toContain(
      'Start with Cinder today.',
    );
    const buttons = container.querySelectorAll('.cinder-cta-section__actions .cinder-button');
    expect(buttons).toHaveLength(2);
  });

  test('fires click callbacks for primary and secondary actions', async () => {
    const onPrimaryClick = mock(() => {});
    const onSecondaryClick = mock(() => {});
    const { container } = render(CtaSection, {
      props: {
        title: 'CTA',
        primaryActionLabel: 'Primary',
        secondaryActionLabel: 'Secondary',
        onPrimaryClick,
        onSecondaryClick,
      },
    });

    const buttons = container.querySelectorAll('button');
    await fireEvent.click(buttons[0]!);
    await fireEvent.click(buttons[1]!);
    expect(onPrimaryClick).toHaveBeenCalledTimes(1);
    expect(onSecondaryClick).toHaveBeenCalledTimes(1);
  });

  test('applies tone and alignment attributes', () => {
    const { container } = render(CtaSection, {
      props: {
        title: 'CTA',
        primaryActionLabel: 'Primary',
        tone: 'accent',
        align: 'start',
      },
    });

    const root = container.querySelector('.cinder-cta-section');
    expect(root?.getAttribute('data-cinder-tone')).toBe('accent');
    expect(root?.getAttribute('data-cinder-align')).toBe('start');
  });

  test('merges custom class alongside root class', () => {
    const { container } = render(CtaSection, {
      props: {
        title: 'CTA',
        primaryActionLabel: 'Primary',
        class: 'my-custom-class',
      },
    });
    const element = container.querySelector('.cinder-cta-section');
    expect(element?.classList.contains('cinder-cta-section')).toBe(true);
    expect(element?.classList.contains('my-custom-class')).toBe(true);
  });
});
