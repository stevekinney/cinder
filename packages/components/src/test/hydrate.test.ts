/// <reference lib="dom" />
/**
 * Smoke test for the SSR-render-and-hydrate helper.
 *
 * Uses Input as the reference fixture: it generates ARIA wiring through
 * derived IDs, has a label association, and exercises Shape B prop spreading —
 * a representative SSR target. If hydrate works for Input, it works for
 * the Phase 1 form controls too.
 */

import { join } from 'node:path';

import { describe, expect, test } from 'bun:test';
import { tick } from 'svelte';

import {
  hydrateServerHtml,
  prepareSvelteServerSource,
  renderSvelteOnServer,
  setupHappyDom,
} from '@lostgradient/testing';

setupHappyDom();

const { default: Input } = await import('../components/input/input.svelte');

const INPUT_SOURCE = join(import.meta.dir, '..', 'components', 'input', 'input.svelte');

const inputProps = { id: 'hydrate-input', value: '', label: 'Hydrate test' };
const ariaProps = {
  id: 'hydrate-aria',
  value: '',
  description: 'Helper text',
  error: 'Validation message',
};
await prepareSvelteServerSource(INPUT_SOURCE);
// Server rendering spawns a Bun process, so it runs once at module scope, off bun's per-test clock.
const [inputHtml, ariaHtml] = await Promise.all([
  renderSvelteOnServer(INPUT_SOURCE, inputProps),
  renderSvelteOnServer(INPUT_SOURCE, ariaProps),
]);

describe('hydrateServerHtml', () => {
  test('renders Input on the server and hydrates without warnings', async () => {
    const result = hydrateServerHtml(Input, inputHtml, inputProps);
    // Hydration effects flush in a microtask; yield once so assertions see the settled DOM.
    await tick();

    try {
      expect(result.ssrHtml).toContain('cinder-input');
      expect(result.ssrHtml).toContain('hydrate-input');
      expect(result.ssrHtml).toContain('Hydrate test');

      const input = result.container.querySelector('#hydrate-input');
      expect(input).not.toBeNull();

      const mismatchWarnings = result.warnings.filter((w) => w.toLowerCase().includes('hydration'));
      expect(mismatchWarnings).toEqual([]);
    } finally {
      await result.cleanup();
    }
  });

  test('description and error elements survive hydration with their IDs', async () => {
    const result = hydrateServerHtml(Input, ariaHtml, ariaProps);
    // Hydration effects flush in a microtask; yield once so assertions see the settled DOM.
    await tick();

    try {
      const input = result.container.querySelector('#hydrate-aria');
      const describedBy = input?.getAttribute('aria-describedby') ?? '';
      expect(describedBy).toContain('hydrate-aria-description');
      expect(describedBy).toContain('hydrate-aria-error');

      expect(result.container.querySelector('#hydrate-aria-description')).not.toBeNull();
      expect(result.container.querySelector('#hydrate-aria-error')).not.toBeNull();
    } finally {
      await result.cleanup();
    }
  });
});
