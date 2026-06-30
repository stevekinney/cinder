/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

// setupHappyDom() MUST run before any `@testing-library/svelte` import. testing-library
// reads `globalThis.document` / `window` at module-init (top-level, not inside test bodies),
// so we register happy-dom's globals first and then dynamic-import testing-library below.
setupHappyDom();

const { fireEvent, render } = await import('@testing-library/svelte');
const { default: PricingSection } = await import('./pricing-section.svelte');
const { createRawSnippet } = await import('svelte');
const runtimePatchSnippet = createRawSnippet(() => ({
  render: () => '<span></span>',
  setup: () => {},
}));
void runtimePatchSnippet;

const plans = [
  { name: 'Starter', price: '$0', features: ['3 projects'], cta: 'Start free' },
  { name: 'Pro', price: '$49', features: ['Unlimited projects'], cta: 'Upgrade', selected: true },
];

describe('PricingSection', () => {
  test('renders pricing cards from plans', () => {
    const { container } = render(PricingSection, {
      props: {
        title: 'Simple pricing',
        plans,
      },
    });

    const element = container.querySelector('.cinder-pricing-section');
    expect(element).not.toBeNull();
    expect(container.querySelectorAll('.cinder-pricing-card')).toHaveLength(2);
    expect(container.querySelector('.cinder-pricing-card__name')?.textContent).toContain('Starter');
  });

  test('calls onPlanSelect with plan and index when CTA clicked', async () => {
    let selectedName = '';
    let selectedIndex = -1;
    const { container } = render(PricingSection, {
      props: {
        plans,
        onPlanSelect: (plan: (typeof plans)[number], index: number) => {
          selectedName = plan.name;
          selectedIndex = index;
        },
      },
    });
    const buttons = container.querySelectorAll('.cinder-pricing-card button');
    await fireEvent.click(buttons[1]!);
    expect(selectedName).toBe('Pro');
    expect(selectedIndex).toBe(1);
  });

  test('applies columns data attribute and custom class', () => {
    const { container } = render(PricingSection, {
      props: {
        plans,
        columns: 4,
        class: 'my-custom-class',
      },
    });
    const root = container.querySelector('.cinder-pricing-section');
    expect(root?.getAttribute('data-cinder-columns')).toBe('4');
    expect(root?.classList.contains('my-custom-class')).toBe(true);
  });
});
