/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';
import { createRawSnippet } from 'svelte';

import { claimModalSlot, isRelevant, resetModalSlot } from '../../_internal/guidance-context.ts';
import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { cleanup, render } = await import('@testing-library/svelte');
const { default: GuidanceRegion } = await import('./guidance-region.svelte');

afterEach(cleanup);

describe('GuidanceRegion', () => {
  test('applies inclusive version windows', () => {
    const claim = {
      id: 'tour',
      content: 'Try search',
      relevantFrom: '1.2.0',
      relevantUntil: '2.0.0',
    };

    expect(isRelevant(claim, '1.2.0')).toBe(true);
    expect(isRelevant(claim, '2.0.0')).toBe(true);
    expect(isRelevant(claim, '1.1.9')).toBe(false);
    expect(isRelevant(claim, '2.0.1')).toBe(false);
    expect(isRelevant(claim, '1.10.0')).toBe(true);
    expect(isRelevant(claim, '1.2.0-beta.1')).toBe(false);
  });

  test('allows only one modal claim across regions during a boot', () => {
    resetModalSlot();
    expect(claimModalSlot()).toBe(true);
    expect(claimModalSlot()).toBe(false);
    resetModalSlot();
    expect(claimModalSlot()).toBe(true);
  });

  test('renders application children without owning persistent storage', () => {
    const children = createRawSnippet(() => ({ render: () => '<main>Application</main>' }));
    const { container } = render(GuidanceRegion, {
      claims: [{ id: 'tour', content: 'Try search' }],
      version: '1.0.0',
      children,
    });

    expect(container.querySelector('main')?.textContent).toBe('Application');
  });
});
