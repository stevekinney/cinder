/// <reference lib="dom" />
import { afterEach, describe, expect, mock, spyOn, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

// setupHappyDom() MUST run before any `@testing-library/svelte` import. testing-library
// reads `globalThis.document` / `window` at module-init (top-level, not inside test bodies),
// so we register happy-dom's globals first and then dynamic-import testing-library below.
setupHappyDom();

const { render, fireEvent, cleanup } = await import('@testing-library/svelte');
const { default: PricingCard } = await import('./pricing-card.svelte');

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

const BASE_PROPS = {
  name: 'Pro',
  price: '$9/mo',
  features: ['Unlimited projects', '10 GB storage', 'Priority support'],
  cta: 'Get started',
  onselect: () => {},
};

describe('PricingCard', () => {
  test('renders the plan name', () => {
    const { container } = render(PricingCard, { props: { ...BASE_PROPS } });
    expect(container.querySelector('.cinder-pricing-card__name')?.textContent).toBe('Pro');
  });

  test('renders the price', () => {
    const { container } = render(PricingCard, { props: { ...BASE_PROPS } });
    expect(container.querySelector('.cinder-pricing-card__price')?.textContent).toBe('$9/mo');
  });

  test('renders all features in the list', () => {
    const { container } = render(PricingCard, { props: { ...BASE_PROPS } });
    const items = container.querySelectorAll('.cinder-pricing-card__feature');
    expect(items).toHaveLength(3);
    expect(items[0]?.textContent?.trim()).toBe('Unlimited projects');
    expect(items[1]?.textContent?.trim()).toBe('10 GB storage');
    expect(items[2]?.textContent?.trim()).toBe('Priority support');
  });

  test('renders the CTA as a button element displaying the cta label', () => {
    const { container } = render(PricingCard, { props: { ...BASE_PROPS } });
    // The cinder Button renders a real <button>
    const button = container.querySelector('.cinder-pricing-card__footer button');
    expect(button).not.toBeNull();
    expect(button?.tagName).toBe('BUTTON');
    expect(button?.textContent).toContain('Get started');
  });

  test('CTA button calls onselect when clicked', async () => {
    const onselect = mock(() => {});
    const { container } = render(PricingCard, { props: { ...BASE_PROPS, onselect } });
    const button = container.querySelector('.cinder-pricing-card__footer button');
    expect(button).not.toBeNull();
    await fireEvent.click(button!);
    expect(onselect).toHaveBeenCalledTimes(1);
  });

  test('caveat renders when provided', () => {
    const { container } = render(PricingCard, {
      props: { ...BASE_PROPS, caveat: 'Results may vary.' },
    });
    const caveat = container.querySelector('.cinder-pricing-card__caveat');
    expect(caveat).not.toBeNull();
    expect(caveat?.textContent).toBe('Results may vary.');
  });

  test('caveat has data-cinder-caveat attribute for CSS targeting', () => {
    const { container } = render(PricingCard, {
      props: { ...BASE_PROPS, caveat: 'Terms apply.' },
    });
    const caveat = container.querySelector('[data-cinder-caveat]');
    expect(caveat).not.toBeNull();
  });

  test('caveat is absent when not provided', () => {
    const { container } = render(PricingCard, { props: { ...BASE_PROPS } });
    expect(container.querySelector('.cinder-pricing-card__caveat')).toBeNull();
  });

  test('selected=true sets data-cinder-selected on root', () => {
    const { container } = render(PricingCard, { props: { ...BASE_PROPS, selected: true } });
    const root = container.querySelector('.cinder-pricing-card');
    expect(root?.hasAttribute('data-cinder-selected')).toBe(true);
  });

  test('selected=true sets aria-current="true" on root', () => {
    const { container } = render(PricingCard, { props: { ...BASE_PROPS, selected: true } });
    const root = container.querySelector('.cinder-pricing-card');
    expect(root?.getAttribute('aria-current')).toBe('true');
  });

  test('selected=false (default) does not set data-cinder-selected', () => {
    const { container } = render(PricingCard, { props: { ...BASE_PROPS } });
    const root = container.querySelector('.cinder-pricing-card');
    expect(root?.hasAttribute('data-cinder-selected')).toBe(false);
  });

  test('selected=false (default) does not set aria-current', () => {
    const { container } = render(PricingCard, { props: { ...BASE_PROPS } });
    const root = container.querySelector('.cinder-pricing-card');
    expect(root?.hasAttribute('aria-current')).toBe(false);
  });

  test('applies class prop alongside cinder-pricing-card', () => {
    const { container } = render(PricingCard, {
      props: { ...BASE_PROPS, class: 'my-custom-class' },
    });
    const root = container.querySelector('.cinder-pricing-card');
    expect(root?.classList.contains('cinder-pricing-card')).toBe(true);
    expect(root?.classList.contains('my-custom-class')).toBe(true);
  });

  test('rest props are applied to the root element', () => {
    const { container } = render(PricingCard, {
      props: { ...BASE_PROPS, 'data-testid': 'pricing-card-pro' },
    });
    expect(container.querySelector('[data-testid="pricing-card-pro"]')).not.toBeNull();
  });

  test('features list is not empty by default in tests', () => {
    const { container } = render(PricingCard, { props: { ...BASE_PROPS } });
    const list = container.querySelector('.cinder-pricing-card__features');
    expect(list).not.toBeNull();
    expect(list?.querySelectorAll('li')).toHaveLength(3);
  });

  test('caveat is visually distinct from feature items', () => {
    const { container } = render(PricingCard, {
      props: { ...BASE_PROPS, caveat: 'Disclaimer text' },
    });
    // Caveat is a <p>, features are <li> — structurally distinct
    const caveat = container.querySelector('.cinder-pricing-card__caveat');
    expect(caveat?.tagName).toBe('P');
    const features = container.querySelectorAll('.cinder-pricing-card__feature');
    expect(features).toHaveLength(3);
  });
});

describe('PricingCard each-key behavior', () => {
  test('emits a devWarn when features are updated to contain duplicate values', async () => {
    // The $effect.pre duplicate check runs before DOM mutations, so the warning
    // fires before Svelte processes the keyed each block. Start with unique
    // features, then rerender with duplicates to trigger the reactive update path.
    const warnSpy = spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const { rerender } = render(PricingCard, {
        props: { ...BASE_PROPS, features: ['Feature A', 'Feature B', 'Feature C'] },
      });
      expect(warnSpy).not.toHaveBeenCalled();

      // Rerender with duplicates — $effect.pre fires the devWarn before Svelte
      // processes the keyed each. Swallow any subsequent Svelte throw.
      try {
        await rerender({ ...BASE_PROPS, features: ['Feature A', 'Feature B', 'Feature A'] });
      } catch {
        // Svelte may throw each_key_duplicate after our warning has already fired.
      }
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Duplicate feature values'));
    } finally {
      warnSpy.mockRestore();
    }
  });

  test('does not warn when all feature values are unique', () => {
    const warnSpy = spyOn(console, 'warn').mockImplementation(() => {});
    try {
      render(PricingCard, { props: { ...BASE_PROPS } });
      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });

  test('renders updated features when list is filtered', async () => {
    const { container, rerender } = render(PricingCard, {
      props: { ...BASE_PROPS, features: ['Alpha', 'Beta', 'Gamma'] },
    });
    let items = container.querySelectorAll('.cinder-pricing-card__feature');
    expect(items).toHaveLength(3);

    await rerender({ ...BASE_PROPS, features: ['Alpha', 'Gamma'] });
    items = container.querySelectorAll('.cinder-pricing-card__feature');
    expect(items).toHaveLength(2);
    expect(items[0]?.textContent?.trim()).toBe('Alpha');
    expect(items[1]?.textContent?.trim()).toBe('Gamma');
  });
});

describe('PricingCard CSS contract', () => {
  test('CSS is wrapped in @layer cinder.components', async () => {
    const css = await Bun.file(new URL('./pricing-card.css', import.meta.url)).text();
    expect(css).toContain('@layer cinder.components');
  });

  test('selected state uses accent token not raw color', async () => {
    const css = await Bun.file(new URL('./pricing-card.css', import.meta.url)).text();
    const selectedBlock =
      css.match(/\[data-cinder-selected\][^{]*\{[^}]*\}/)?.[0] ??
      css.match(/data-cinder-selected[^}]*\}/g)?.[0] ??
      '';
    // Should use token-based accent, not raw color value
    expect(css).toContain('var(--cinder-accent)');
    // Should not use raw hex or rgb colors
    expect(selectedBlock).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
  });

  test('caveat uses text-subtle token', async () => {
    const css = await Bun.file(new URL('./pricing-card.css', import.meta.url)).text();
    const caveatBlock = css.match(/\.cinder-pricing-card__caveat\s*\{[^}]*\}/)?.[0] ?? '';
    expect(caveatBlock).toContain('var(--cinder-text-subtle)');
  });
});
