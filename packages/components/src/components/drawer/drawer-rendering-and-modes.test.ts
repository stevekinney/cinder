/// <reference lib="dom" />
import { requiredInstance, setupHappyDom } from '@lostgradient/testing';
import { afterAll, afterEach, describe, expect, test } from 'bun:test';
import { createRawSnippet, tick } from 'svelte';
import { resetEscapeStack, resetScrollLock } from '../../_internal/overlay.ts';
import {
  emptySnippet,
  finishCloseTransition,
  installDrawerDialogStubs,
  installDrawerStyleProbe,
} from './drawer-test-helpers.ts';

setupHappyDom();
installDrawerDialogStubs();
const restoreDrawerStyles = installDrawerStyleProbe();
const { cleanup, fireEvent, render } = await import('@testing-library/svelte');
const { default: Drawer } = await import('./drawer.svelte');
const { findNearestOpenTopLayer } = await import('../portal/portal.utilities.svelte.ts');
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
  test('data-testid pass-through reaches the dialog element', () => {
    const { container } = render(Drawer, {
      props: {
        open: true,
        title: 'Test',
        'data-testid': 'my-drawer',
        children: emptySnippet,
      },
    });
    const dialog = container.querySelector('dialog');
    expect(dialog?.getAttribute('data-testid')).toBe('my-drawer');
  });
  test('class prop is merged with cinder-drawer', () => {
    const { container } = render(Drawer, {
      props: {
        open: true,
        title: 'Test',
        class: 'custom-class',
        children: emptySnippet,
      },
    });
    const dialog = container.querySelector('dialog');
    expect(dialog?.classList.contains('cinder-drawer')).toBe(true);
    expect(dialog?.classList.contains('custom-class')).toBe(true);
  });

  // ---- 20. Parent-driven open/close state machine ----
  // (Escape-stack release across cycles is pinned separately in the
  // "Drawer escape-stack hygiene" describe below.)
  test('rapid open/close cycling: scroll lock cleans up correctly', async () => {
    let openValue = false;
    const { container, rerender } = render(Drawer, {
      props: {
        get open() {
          return openValue;
        },
        set open(value: boolean) {
          openValue = value;
        },
        title: 'State Machine',
        children: emptySnippet,
      },
    });

    // Open
    openValue = true;
    await rerender({
      get open() {
        return openValue;
      },
      set open(value: boolean) {
        openValue = value;
      },
      title: 'State Machine',
      children: emptySnippet,
    });
    expect(document.body.style.overflow).toBe('hidden');

    // Close via parent-driven state change
    openValue = false;
    await rerender({
      get open() {
        return openValue;
      },
      set open(value: boolean) {
        openValue = value;
      },
      title: 'State Machine',
      children: emptySnippet,
    });
    await finishCloseTransition(container);
    expect(document.body.style.overflow).toBe('');
  });

  // ---- 21. UA [open] display semantics ----
  test('closed drawer has no open attribute on the <dialog>', () => {
    const { container } = render(Drawer, {
      props: { open: false, title: 'Test', children: emptySnippet },
    });
    const dialog = container.querySelector('dialog');
    expect(dialog).not.toBeNull();
    expect(dialog?.hasAttribute('open')).toBe(false);
    expect(dialog?.open).toBe(false);
  });

  // ---- Additional: aria-modal is always set ----
  test('dialog always has aria-modal="true"', () => {
    const { container } = render(Drawer, {
      props: { open: true, title: 'Test', children: emptySnippet },
    });
    expect(container.querySelector('dialog')?.getAttribute('aria-modal')).toBe('true');
  });
  test('modal=false renders an aside instead of a dialog', () => {
    const { container } = render(Drawer, {
      props: { modal: false, open: true, title: 'Inspector', children: emptySnippet },
    });

    expect(container.querySelector('dialog')).toBeNull();
    const aside = container.querySelector('aside.cinder-drawer');
    expect(aside).not.toBeNull();
    expect(aside?.getAttribute('aria-modal')).toBeNull();
    expect(aside?.getAttribute('aria-labelledby')).toBeTruthy();
    expect(aside?.querySelector('.cinder-drawer__panel')).not.toBeNull();
  });
  test('modal=false does not lock body scroll', () => {
    render(Drawer, {
      props: { modal: false, open: true, title: 'Inspector', children: emptySnippet },
    });

    expect(document.body.style.overflow).toBe('');
  });
  test('modal=false close button closes immediately', async () => {
    let openValue = true;
    const props = () => ({
      modal: false,
      get open() {
        return openValue;
      },
      set open(value: boolean) {
        openValue = value;
      },
      title: 'Inspector',
      children: emptySnippet,
    });
    const { container, rerender } = render(Drawer, { props: props() });

    await fireEvent.click(
      requiredInstance(container.querySelector('.cinder-drawer__close'), HTMLButtonElement),
    );
    expect(openValue).toBe(false);
    await rerender(props());
    await tick();
    expect(container.querySelector('aside.cinder-drawer')).toBeNull();
  });
  test('modal=false exposes a portal boundary outside the panel overflow context', () => {
    const child = createRawSnippet(() => ({
      render: () => '<button data-testid="nested-trigger">Nested trigger</button>',
      setup: () => {},
    }));
    const { container } = render(Drawer, {
      props: { modal: false, open: true, title: 'Inspector', children: child },
    });

    const aside = requiredInstance(container.querySelector('aside.cinder-drawer'), HTMLElement);
    const scope = requiredInstance(
      aside.querySelector('.cinder-drawer__portal-scope'),
      HTMLElement,
    );
    const trigger = requiredInstance(
      aside.querySelector('[data-testid="nested-trigger"]'),
      HTMLElement,
    );

    expect(aside.dataset['cinderPortalOwner']).toBe(scope.id);
    expect(drawerCss).toMatch(/\.cinder-drawer__portal-scope\s*\{[^}]*display:\s*contents;/s);
    expect(drawerCss).toMatch(/\.cinder-drawer__portal-scope\s*\{[^}]*pointer-events:\s*auto;/s);
    expect(findNearestOpenTopLayer(trigger)).toBe(scope);
  });
});
