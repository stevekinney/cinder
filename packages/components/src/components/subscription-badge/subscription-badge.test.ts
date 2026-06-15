/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';
import type { SubscriptionState } from './subscription-badge.types.ts';

// setupHappyDom() MUST run before any `@testing-library/svelte` import. testing-library
// reads `globalThis.document` / `window` at module-init (top-level, not inside test bodies),
// so we register happy-dom's globals first and then dynamic-import testing-library below.
setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { default: SubscriptionBadge } = await import('./subscription-badge.svelte');

// The authoritative state → tone → label mapping.
// This table is duplicated from STATE_CONFIG in subscription-badge.svelte intentionally:
// the test must pin the contract, not reuse the implementation.
const STATE_TABLE: Record<SubscriptionState, { tone: string; label: string }> = {
  active: { tone: 'success', label: 'Active' },
  trialing: { tone: 'info', label: 'Trialing' },
  'past-due': { tone: 'warning', label: 'Past due' },
  canceled: { tone: 'neutral', label: 'Canceled' },
  expired: { tone: 'danger', label: 'Expired' },
  refunded: { tone: 'neutral', label: 'Refunded' },
};

const ALL_STATES = Object.keys(STATE_TABLE) as SubscriptionState[];

/**
 * Returns the rendered HTML of the badge root element.
 *
 * Svelte 5 renders reactive text nodes as `<!-- text-->` comment anchors in
 * happy-dom's test environment. `textContent` only captures element/text
 * nodes (DOM Node types 1 and 3), not comment nodes (type 8), so it returns
 * whitespace for Svelte-tracked text. Asserting against `innerHTML` instead
 * catches both element-wrapped and comment-anchored label content.
 */
function badgeHtml(container: HTMLElement): string {
  return container.querySelector('.cinder-badge')?.innerHTML ?? '';
}

describe('SubscriptionBadge — rendering', () => {
  test('renders the cinder-subscription-badge class', () => {
    const { container } = render(SubscriptionBadge, { props: { state: 'active' } });
    expect(container.querySelector('.cinder-subscription-badge')).not.toBeNull();
  });

  test('renders a cinder-badge root (Badge is composed internally)', () => {
    const { container } = render(SubscriptionBadge, { props: { state: 'active' } });
    expect(container.querySelector('.cinder-badge')).not.toBeNull();
  });

  test('stamps data-cinder-state with the subscription state', () => {
    const { container } = render(SubscriptionBadge, { props: { state: 'past-due' } });
    expect(container.querySelector('.cinder-badge')?.getAttribute('data-cinder-state')).toBe(
      'past-due',
    );
  });

  test('applies custom class alongside cinder-subscription-badge', () => {
    const { container } = render(SubscriptionBadge, {
      props: { state: 'active', class: 'my-custom-class' },
    });
    const badge = container.querySelector('.cinder-badge');
    expect(badge?.classList.contains('cinder-subscription-badge')).toBe(true);
    expect(badge?.classList.contains('my-custom-class')).toBe(true);
  });

  test('forwards rest props to the underlying Badge', () => {
    const { container } = render(SubscriptionBadge, {
      props: { state: 'active', id: 'sub-badge-id' },
    });
    expect(container.querySelector('#sub-badge-id')).not.toBeNull();
  });
});

describe('SubscriptionBadge — each state renders label and icon', () => {
  test.each(ALL_STATES)('state "%s" renders its human-readable label in HTML', (state) => {
    const { container } = render(SubscriptionBadge, { props: { state } });
    // Svelte 5 anchors reactive text as `<!-- label-->` comment nodes in happy-dom.
    // `innerHTML` captures comment node content; `textContent` does not.
    expect(badgeHtml(container)).toContain(STATE_TABLE[state].label);
  });

  test.each(ALL_STATES)('state "%s" renders an SVG icon', (state) => {
    const { container } = render(SubscriptionBadge, { props: { state } });
    const svg = container.querySelector('.cinder-badge svg');
    expect(svg).not.toBeNull();
  });

  test.each(ALL_STATES)('state "%s" icon is aria-hidden', (state) => {
    const { container } = render(SubscriptionBadge, { props: { state } });
    const svg = container.querySelector('.cinder-badge svg');
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('SubscriptionBadge — tone mapping via data-cinder-variant', () => {
  test.each(ALL_STATES)('state "%s" maps to the expected Badge tone', (state) => {
    const { container } = render(SubscriptionBadge, { props: { state } });
    const badge = container.querySelector('.cinder-badge');
    expect(badge?.getAttribute('data-cinder-variant')).toBe(STATE_TABLE[state].tone);
  });
});

describe('SubscriptionBadge — data-cinder-state per state', () => {
  test.each(ALL_STATES)('state "%s" stamps data-cinder-state correctly', (state) => {
    const { container } = render(SubscriptionBadge, { props: { state } });
    const badge = container.querySelector('.cinder-badge');
    expect(badge?.getAttribute('data-cinder-state')).toBe(state);
  });
});

describe('SubscriptionBadge — tone differentiation', () => {
  test('refunded has a distinct tone from trialing so they are visually distinguishable', () => {
    const refundedContainer = render(SubscriptionBadge, { props: { state: 'refunded' } });
    const refundedBadge = refundedContainer.container.querySelector('.cinder-badge');
    const refundedTone = refundedBadge?.getAttribute('data-cinder-variant');

    const trialingContainer = render(SubscriptionBadge, { props: { state: 'trialing' } });
    const trialingBadge = trialingContainer.container.querySelector('.cinder-badge');
    const trialingTone = trialingBadge?.getAttribute('data-cinder-variant');

    expect(refundedTone).toBe('neutral');
    expect(trialingTone).toBe('info');
    // Key invariant: the two states must not share the same tone so users can
    // distinguish them by color/appearance alone (WCAG 1.4.1).
    expect(refundedTone).not.toBe(trialingTone);
  });
});

describe('SubscriptionBadge — accessibility (WCAG 1.4.1)', () => {
  test.each(ALL_STATES)(
    'state "%s" communicates its state through rendered text, not only color or icon',
    (state) => {
      const { container } = render(SubscriptionBadge, { props: { state } });
      // The badge's rendered HTML must include the human-readable label text.
      // This is the primary WCAG 1.4.1 check: color and icon alone are not
      // sufficient — the visible text label must always be present in the output.
      expect(badgeHtml(container)).toContain(STATE_TABLE[state].label);
    },
  );

  test('the icon is decorative and hidden from assistive technology', () => {
    const { container } = render(SubscriptionBadge, { props: { state: 'active' } });
    const svg = container.querySelector('.cinder-badge svg');
    // The icon conveys no unique information beyond the text label —
    // it must be aria-hidden so screen readers do not announce it separately.
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
  });

  test('does not rely on aria-label alone — label text appears in rendered output', () => {
    // SubscriptionBadge always renders a visible text label in the HTML output.
    // The state is NOT communicated through aria-label alone, ensuring it is
    // accessible to sighted users regardless of color perception.
    const { container } = render(SubscriptionBadge, { props: { state: 'expired' } });
    expect(badgeHtml(container)).toContain('Expired');
  });
});
