/// <reference lib="dom" />
import { setupHappyDom } from '@lostgradient/testing';
import { afterAll, afterEach, describe, expect, test } from 'bun:test';
import { resetEscapeStack, resetScrollLock } from '../../_internal/overlay.ts';
import {
  emptySnippet,
  installDrawerDialogStubs,
  installDrawerStyleProbe,
} from './drawer-test-helpers.ts';

setupHappyDom();
installDrawerDialogStubs();
const restoreDrawerStyles = installDrawerStyleProbe();
const { cleanup, render } = await import('@testing-library/svelte');
const { default: Drawer } = await import('./drawer.svelte');
const drawerCss = await Bun.file(new URL('./drawer.css', import.meta.url)).text();

afterAll(() => {
  restoreDrawerStyles();
});
afterEach(() => {
  cleanup();
  document.body.replaceChildren();
  resetScrollLock();
  resetEscapeStack();
});
describe('Drawer', () => {
  test('drag handle is absent by default (dragHandleVisible=false)', () => {
    const { container } = render(Drawer, {
      props: { open: true, placement: 'bottom', title: 'Test', children: emptySnippet },
    });
    expect(container.querySelector('.cinder-drawer__drag-handle')).toBeNull();
  });
  test('drag handle renders when dragHandleVisible=true with aria-hidden="true"', () => {
    const { container } = render(Drawer, {
      props: {
        open: true,
        placement: 'bottom',
        title: 'Test',
        dragHandleVisible: true,
        children: emptySnippet,
      },
    });
    const handle = container.querySelector('.cinder-drawer__drag-handle');
    expect(handle).not.toBeNull();
    expect(handle?.getAttribute('aria-hidden')).toBe('true');
  });
  test('drag handle never renders on side placements even when dragHandleVisible=true', () => {
    const { container } = render(Drawer, {
      props: {
        open: true,
        placement: 'right',
        title: 'Test',
        dragHandleVisible: true,
        children: emptySnippet,
      },
    });
    expect(container.querySelector('.cinder-drawer__drag-handle')).toBeNull();
  });
  test('drawer.css close button meets 44px touch target (2.75rem × 2.75rem)', async () => {
    const cssText = drawerCss;
    const closeRule = cssText.split('.cinder-drawer__close {')[1]?.split('}')[0];
    expect(closeRule).toContain('width: 2.75rem');
    expect(closeRule).toContain('height: 2.75rem');
  });
  test('drawer.css drag handle meets 44px touch target', async () => {
    const cssText = drawerCss;
    const handleRule = cssText.split('.cinder-drawer__drag-handle {')[1]?.split('}')[0];
    expect(handleRule).toMatch(/min-height:\s*(?:2\.75rem|var\(--cinder-touch-target-min\))/);
  });
  test('drawer.css caps the bottom panel and keeps overflow inside the body', async () => {
    const cssText = drawerCss;

    expect(cssText).toMatch(
      /\.cinder-drawer__panel\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column;[^}]*overflow:\s*hidden;/s,
    );
    expect(cssText).toMatch(
      /\.cinder-drawer__panel\[data-cinder-placement='bottom'\]\s*\{[^}]*max-height:\s*90dvh;/s,
    );
    expect(cssText).not.toMatch(/max-block-size:\s*90dvh;/s);
    expect(cssText).toMatch(
      /\.cinder-drawer__body\s*\{[^}]*flex:\s*1;[^}]*min-block-size:\s*0;[^}]*overflow-y:\s*auto;/s,
    );
    expect(cssText).toMatch(/\.cinder-drawer__header\s*\{[^}]*flex-shrink:\s*0;/s);
    expect(cssText).toMatch(/\.cinder-drawer__footer\s*\{[^}]*flex-shrink:\s*0;/s);
  });
  test('body uses the panel surface beneath header and footer', async () => {
    const cssText = drawerCss;
    expect(cssText).toMatch(
      /\.cinder-drawer__body\s*\{[^}]*background:\s*var\(--cinder-surface\)/s,
    );
  });

  // ---------------------------------------------------------------------------
  // Motion contract: every placement must have BOTH a closing rule and a
  // matching @starting-style rule, or that placement pops in with no from-state
  // while the backdrop fades (the asymmetric "eases out, pops in" defect).
  // ---------------------------------------------------------------------------
});
