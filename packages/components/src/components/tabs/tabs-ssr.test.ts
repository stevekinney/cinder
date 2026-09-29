/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';
import { tick } from 'svelte';

import {
  prepareSvelteServerSource,
  renderSvelteOnServer,
  setupHappyDom,
} from '@lostgradient/testing';

setupHappyDom();

const { render, cleanup } = await import('@testing-library/svelte');

// Unmount renders between tests; shared document.body otherwise leaks activeElement/nodes.
afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

const { default: Wrapper } = await import('../../test/fixtures/tabs-fixture.svelte');

const TABS_FIXTURE_SOURCE = new URL('../../test/fixtures/tabs-fixture.svelte', import.meta.url)
  .pathname;
await prepareSvelteServerSource(TABS_FIXTURE_SOURCE);

const items = [
  { value: 'a', title: 'A tab', body: 'A body' },
  { value: 'b', title: 'B tab', body: 'B body' },
  { value: 'c', title: 'C tab', body: 'C body' },
];

function extractTabTag(html: string, value: string): string {
  const match = html.match(new RegExp(`<button[^>]*data-cinder-value="${value}"[^>]*>`));
  if (!match) throw new Error(`no tab button found for value "${value}"`);
  return match[0];
}

function countTabStops(html: string): number {
  return (html.match(/<button[^>]*tabindex="0"[^>]*>/g) ?? []).length;
}

describe('Tabs SSR contract', () => {
  const withDisabledMiddle = [
    { value: 'a', title: 'A tab', body: 'A body' },
    { value: 'b', title: 'B tab', body: 'B body', disabled: true },
    { value: 'c', title: 'C tab', body: 'C body' },
  ];

  // Scoped to <button> tags only. The fixture also renders TabPanel, whose
  // active panel <div> unconditionally carries tabindex="0"
  // (tab-panel.svelte, independent of roving-tabindex) — an ungated
  // /tabindex="0"/g match would inflate every count below by exactly one.
  test('server-rendered HTML gives the selected enabled first tab a tabindex="0" tab stop', async () => {
    const html = await renderSvelteOnServer(TABS_FIXTURE_SOURCE, { value: 'a', items });

    expect(extractTabTag(html, 'a')).toContain('tabindex="0"');
    expect(extractTabTag(html, 'b')).toContain('tabindex="-1"');
    expect(extractTabTag(html, 'c')).toContain('tabindex="-1"');
    expect(countTabStops(html)).toBe(1);
  });

  test('server-rendered HTML gives the selected enabled tab a tabindex="0" tab stop when it is NOT the first tab', async () => {
    // Regression test: before the isFocusable direct/fallback split, this
    // exact fixture rendered TWO tabindex="0" buttons for a not-first
    // selection (the stale fallback branch claimed `a`, the direct match
    // separately claimed `b`). Asserting countTabStops(html) === 1 fails
    // even if `b` happens to still be individually correct.
    const html = await renderSvelteOnServer(TABS_FIXTURE_SOURCE, { value: 'b', items });

    expect(extractTabTag(html, 'b')).toContain('tabindex="0"');
    expect(extractTabTag(html, 'a')).toContain('tabindex="-1"');
    expect(extractTabTag(html, 'c')).toContain('tabindex="-1"');
    expect(countTabStops(html)).toBe(1);
  });

  test('server-rendered HTML gives the selected enabled tab a tabindex="0" tab stop when it is the LAST tab', async () => {
    const html = await renderSvelteOnServer(TABS_FIXTURE_SOURCE, { value: 'c', items });

    expect(extractTabTag(html, 'c')).toContain('tabindex="0"');
    expect(extractTabTag(html, 'a')).toContain('tabindex="-1"');
    expect(extractTabTag(html, 'b')).toContain('tabindex="-1"');
    expect(countTabStops(html)).toBe(1);
  });

  test('server-rendered HTML has no tab stop when the selected tab is disabled', async () => {
    // Documented, accepted degradation (see tabs.a11y.md): the "first
    // enabled tab" fallback needs every sibling registered before it can
    // resolve correctly, which a single top-down SSR pass cannot guarantee.
    const html = await renderSvelteOnServer(TABS_FIXTURE_SOURCE, {
      value: 'b',
      items: withDisabledMiddle,
    });

    expect(extractTabTag(html, 'a')).toContain('tabindex="-1"');
    expect(extractTabTag(html, 'b')).toContain('tabindex="-1"');
    expect(extractTabTag(html, 'c')).toContain('tabindex="-1"');
    expect(countTabStops(html)).toBe(0);
  });

  test('client-side render resolves the first-enabled-tab fallback after mount when the selected tab is disabled', async () => {
    const { container } = render(Wrapper, { value: 'b', items: withDisabledMiddle });
    await tick();

    expect(container.querySelector('[data-cinder-value="a"]')?.getAttribute('tabindex')).toBe('0');
    expect(container.querySelector('[data-cinder-value="b"]')?.getAttribute('tabindex')).toBe('-1');
    expect(container.querySelector('[data-cinder-value="c"]')?.getAttribute('tabindex')).toBe('-1');
    const tabStops = container.querySelectorAll('[role="tab"][tabindex="0"]');
    expect(tabStops.length).toBe(1);
  });

  test('server-rendered HTML has no tab stop when no tab matches the selected value', async () => {
    const html = await renderSvelteOnServer(TABS_FIXTURE_SOURCE, {
      value: 'does-not-exist',
      items,
    });

    expect(extractTabTag(html, 'a')).toContain('tabindex="-1"');
    expect(extractTabTag(html, 'b')).toContain('tabindex="-1"');
    expect(extractTabTag(html, 'c')).toContain('tabindex="-1"');
    expect(countTabStops(html)).toBe(0);
  });
});
