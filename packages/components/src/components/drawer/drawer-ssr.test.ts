/// <reference lib="dom" />
import {
  prepareSvelteServerSource,
  renderSvelteOnServer,
  setupHappyDom,
} from '@lostgradient/testing';
import { afterAll, afterEach, describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { resetEscapeStack, resetScrollLock } from '../../_internal/overlay.ts';
import { installDrawerDialogStubs, installDrawerStyleProbe } from './drawer-test-helpers.ts';

setupHappyDom();
installDrawerDialogStubs();
const restoreDrawerStyles = installDrawerStyleProbe();
const { cleanup } = await import('@testing-library/svelte');
const DRAWER_SOURCE = join(import.meta.dir, 'drawer.svelte');
await prepareSvelteServerSource(DRAWER_SOURCE);

afterAll(() => {
  restoreDrawerStyles();
});
afterEach(() => {
  cleanup();
  document.body.replaceChildren();
  resetScrollLock();
  resetEscapeStack();
});
describe('Drawer SSR contract', () => {
  test('gates the dialog behind the hydrated state that is set only from an effect', async () => {
    const source = await Bun.file(DRAWER_SOURCE).text();
    const hydratedGateIndex = source.indexOf('{#if dialogState.hydrated || (!modal && open)}');
    const dialogIndex = source.indexOf('<dialog', hydratedGateIndex);

    expect(source).toMatch(/\$effect\(\(\) => \{\s*dialogState\.markHydrated\(\);\s*\}\);/);
    expect(hydratedGateIndex).toBeGreaterThan(-1);
    expect(dialogIndex).toBeGreaterThan(hydratedGateIndex);
  });
  test('server output omits the dialog before hydration even when open', async () => {
    const html = await renderSvelteOnServer(DRAWER_SOURCE, { open: true, title: 'Server Drawer' });

    expect(html).not.toContain('<dialog');
    expect(html).not.toContain('Server Drawer');
  });
  test('server output includes an open non-modal drawer', async () => {
    const source = await Bun.file(DRAWER_SOURCE).text();
    const renderGate = source.indexOf('{#if dialogState.hydrated || (!modal && open)}');
    const nonModalBranch = source.indexOf('{:else if open}', renderGate);

    expect(renderGate).toBeGreaterThan(-1);
    expect(nonModalBranch).toBeGreaterThan(renderGate);
  });

  // ---------------------------------------------------------------------------
  // Bottom placement (the former Sheet). The drag handle, the 90dvh cap, and
  // the touch-target sizes are placement-specific contracts.
  // ---------------------------------------------------------------------------
});
