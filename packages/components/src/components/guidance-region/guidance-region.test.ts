/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { createRawSnippet } from 'svelte';

import {
  createModalSlot,
  isRelevant,
  type GuidanceClaim,
} from '../../_internal/guidance-context.ts';
import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { cleanup, render } = await import('@testing-library/svelte');
const { default: GuidanceRegion } = await import('./guidance-region.svelte');
const { default: GuidanceRegionHost } = await import('./guidance-region-host.test.svelte');

afterEach(cleanup);

describe('GuidanceRegion', () => {
  test('applies inclusive version windows', () => {
    const claim = {
      id: 'tour',
      anchor: 'search',
      content: 'Try search',
      relevantFrom: '1.2.0',
      relevantUntil: '2.0.0',
    } satisfies GuidanceClaim;

    expect(isRelevant(claim, '1.2.0')).toBe(true);
    expect(isRelevant(claim, '2.0.0')).toBe(true);
    expect(isRelevant(claim, '1.1.9')).toBe(false);
    expect(isRelevant(claim, '2.0.1')).toBe(false);
    expect(isRelevant(claim, '1.10.0')).toBe(true);
    expect(isRelevant(claim, '1.2.0-beta.1')).toBe(false);
  });

  test('scopes modal claim arbitration to each region instance', () => {
    const firstRegion = createModalSlot();
    const secondRegion = createModalSlot();
    expect(firstRegion.claim()).toBe(true);
    expect(firstRegion.claim()).toBe(false);
    expect(secondRegion.claim()).toBe(true);
    firstRegion.reset();
    expect(firstRegion.claim()).toBe(true);
  });

  test('renders application children without owning persistent storage', () => {
    const children = createRawSnippet(() => ({ render: () => '<main>Application</main>' }));
    const { container } = render(GuidanceRegion, {
      claims: [{ id: 'tour', anchor: 'search', content: 'Try search' }],
      version: '1.0.0',
      children,
    });

    expect(container.querySelector('main')?.textContent).toBe('Application');
  });

  test('requires anchored claims to name their anchor', () => {
    const anchoredClaim = {
      id: 'tour',
      anchor: 'search',
      content: 'Try search',
    } satisfies GuidanceClaim;
    const modalClaim = {
      id: 'upgrade',
      kind: 'modal',
      content: 'Upgrade now',
    } satisfies GuidanceClaim;

    expect(anchoredClaim.anchor).toBe('search');
    expect(modalClaim.kind).toBe('modal');
  });

  test('settles an active modal claim when dismissed or reset', () => {
    const source = readFileSync(new URL('./guidance-region.svelte', import.meta.url), 'utf8');
    expect(source).toContain('modalApi?.dismiss(`cinder-guidance-${id}`)');
    expect(source).toContain('modalApi.dismiss(`cinder-guidance-${claim.id}`)');
    expect(source).toContain('storage?.set(key, false)');
    expect(source).toContain('modalApi?.dismiss(`cinder-guidance-${claim.id}`)');
    expect(source).toContain('anchor.isConnected');
    expect(source).toContain('anchor.focus()');
  });

  test('wires the consumer-owned anchor to the guidance popover lifecycle', () => {
    const source = readFileSync(new URL('./guidance-region.svelte', import.meta.url), 'utf8');
    expect(source).toContain('wireTriggerAria');
    expect(source).not.toContain('wireTriggerAria={false}');
  });

  test('does not let reset settle a stale modal claim into a new claim', async () => {
    let api: import('../../_internal/guidance-context.ts').GuidanceApi | undefined;
    render(GuidanceRegionHost, {
      onReady: (value: import('../../_internal/guidance-context.ts').GuidanceApi) => {
        api = value;
      },
    });

    await Promise.resolve();
    expect(api?.claim('upgrade')).toBe(true);
    api?.resetAll();
    expect(api?.claim('upgrade')).toBe(true);
    await Promise.resolve();
    await Promise.resolve();

    expect(api?.claims()).toHaveLength(1);
  });

  test('excludes claims dismissed in storage when the region is recreated', async () => {
    const values = new Map<string, boolean>();
    const storage = {
      get: (key: string) => values.get(key) === true,
      set: (key: string, value: boolean) => values.set(key, value),
      remove: (key: string) => values.delete(key),
    };
    let firstApi: import('../../_internal/guidance-context.ts').GuidanceApi | undefined;
    const first = render(GuidanceRegionHost, {
      storage,
      onReady: (value: import('../../_internal/guidance-context.ts').GuidanceApi) => {
        firstApi = value;
      },
    });

    await Promise.resolve();
    expect(firstApi?.claims()).toHaveLength(1);
    firstApi?.dismiss('upgrade');
    expect(values.get('cinder-guidance:upgrade')).toBe(true);
    first.unmount();

    let secondApi: import('../../_internal/guidance-context.ts').GuidanceApi | undefined;
    render(GuidanceRegionHost, {
      storage,
      onReady: (value: import('../../_internal/guidance-context.ts').GuidanceApi) => {
        secondApi = value;
      },
    });
    await Promise.resolve();
    expect(secondApi?.claims()).toHaveLength(0);
    expect(secondApi?.claim('upgrade')).toBe(false);
  });

  test('canonical example claims welcome guidance from its descendant', () => {
    const example = JSON.parse(
      readFileSync(new URL('./guidance-region.examples.json', import.meta.url), 'utf8'),
    ).examples[0].code as string;
    expect(example).toContain('useGuidance');
    expect(example).toContain("guidance.claim('welcome')");
  });
});
