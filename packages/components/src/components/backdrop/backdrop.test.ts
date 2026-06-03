/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

// setupHappyDom() MUST run before any `@testing-library/svelte` import. testing-library
// reads `globalThis.document` / `window` at module-init (top-level, not inside test bodies),
// so we register happy-dom's globals first and then dynamic-import testing-library below.
setupHappyDom();

const { render, fireEvent } = await import('@testing-library/svelte');
const { default: Backdrop } = await import('./backdrop.svelte');
const { _resetScrollLock } = await import('../../_internal/overlay.ts');

describe('Backdrop', () => {
  test('renders the scrim when open=true', () => {
    const { container } = render(Backdrop, { props: { open: true } });
    expect(container.querySelector('.cinder-backdrop')).not.toBeNull();
  });

  test('does not render the scrim when open=false', () => {
    const { container } = render(Backdrop, { props: { open: false } });
    expect(container.querySelector('.cinder-backdrop')).toBeNull();
  });

  test('childless scrim is aria-hidden (decorative chrome)', () => {
    const { container } = render(Backdrop, { props: { open: true } });
    const backdrop = container.querySelector('.cinder-backdrop');
    expect(backdrop?.getAttribute('aria-hidden')).toBe('true');
  });

  test('scrim with children is NOT aria-hidden so announced content (e.g. a Spinner) reaches AT', async () => {
    const { createRawSnippet } = await import('svelte');
    const children = createRawSnippet(() => ({
      render: () => '<span role="status">Loading…</span>',
    }));
    const { container } = render(Backdrop, { props: { open: true, children } });
    const backdrop = container.querySelector('.cinder-backdrop');
    // aria-hidden must be absent — otherwise the role="status" live region is silenced.
    expect(backdrop?.hasAttribute('aria-hidden')).toBe(false);
    expect(backdrop?.querySelector('[role="status"]')?.textContent).toBe('Loading…');
  });

  test('invisible=false does not add the invisible modifier class', () => {
    const { container } = render(Backdrop, { props: { open: true, invisible: false } });
    const backdrop = container.querySelector('.cinder-backdrop');
    expect(backdrop?.classList.contains('cinder-backdrop--invisible')).toBe(false);
  });

  test('invisible=true adds the invisible modifier class', () => {
    const { container } = render(Backdrop, { props: { open: true, invisible: true } });
    const backdrop = container.querySelector('.cinder-backdrop');
    expect(backdrop?.classList.contains('cinder-backdrop--invisible')).toBe(true);
  });

  test('invisible=true sets data-cinder-invisible attribute', () => {
    const { container } = render(Backdrop, { props: { open: true, invisible: true } });
    const backdrop = container.querySelector('.cinder-backdrop');
    expect(backdrop?.hasAttribute('data-cinder-invisible')).toBe(true);
  });

  test('invisible=false does not set data-cinder-invisible attribute', () => {
    const { container } = render(Backdrop, { props: { open: true, invisible: false } });
    const backdrop = container.querySelector('.cinder-backdrop');
    expect(backdrop?.hasAttribute('data-cinder-invisible')).toBe(false);
  });

  test('onclick fires when the backdrop is clicked', async () => {
    let clicked = false;
    const { container } = render(Backdrop, {
      props: { open: true, onclick: () => (clicked = true) },
    });
    const backdrop = container.querySelector('.cinder-backdrop') as HTMLElement;
    expect(backdrop).not.toBeNull();
    await fireEvent.click(backdrop);
    expect(clicked).toBe(true);
  });

  test('applies custom class prop alongside cinder-backdrop', () => {
    const { container } = render(Backdrop, {
      props: { open: true, class: 'my-custom-class' },
    });
    const backdrop = container.querySelector('.cinder-backdrop');
    const classAttr = backdrop?.getAttribute('class') ?? '';
    expect(classAttr).toContain('cinder-backdrop');
    expect(classAttr).toContain('my-custom-class');
  });
});

// Body-scroll-lock lifecycle. `lockBodyScroll()` sets `document.body.style.overflow
// = 'hidden'` and restores the prior value on release. The lock is keyed to the
// rendered scrim element (bind:this + onoutroend), NOT directly to `open`, so it
// survives the fade-out outro. Each test resets the module-scope counted lock first
// so a leak in one test can't mask a regression in another.
describe('Backdrop body-scroll lock', () => {
  test('locks body scroll while open and restores it when closed', async () => {
    _resetScrollLock();
    expect(document.body.style.overflow).toBe('');

    const { rerender } = render(Backdrop, { props: { open: true } });
    expect(document.body.style.overflow).toBe('hidden');

    // Closing tears down the scrim (happy-dom runs no real outro timer, so the
    // element unmounts immediately — exercising the bind:this/$effect-cleanup
    // release path, the destroy-time safety net for zero-duration transitions).
    await rerender({ open: false });
    expect(document.body.style.overflow).toBe('');
  });

  test('does not lock body scroll when lockScroll=false', () => {
    _resetScrollLock();
    render(Backdrop, { props: { open: true, lockScroll: false } });
    expect(document.body.style.overflow).toBe('');
  });

  test('releases the lock when lockScroll is toggled false while open', async () => {
    _resetScrollLock();
    const { rerender } = render(Backdrop, { props: { open: true, lockScroll: true } });
    expect(document.body.style.overflow).toBe('hidden');

    await rerender({ open: true, lockScroll: false });
    expect(document.body.style.overflow).toBe('');

    await rerender({ open: true, lockScroll: true });
    expect(document.body.style.overflow).toBe('hidden');
    _resetScrollLock();
  });

  test('releases the lock when the component is destroyed while open', () => {
    _resetScrollLock();
    const { unmount } = render(Backdrop, { props: { open: true } });
    expect(document.body.style.overflow).toBe('hidden');

    // Whole-component teardown (parent unmounts Backdrop without toggling open):
    // the $effect cleanup must still run and release the lock.
    unmount();
    expect(document.body.style.overflow).toBe('');
  });

  test('keeps the lock held across a rapid close→reopen toggle', async () => {
    // Rapid-toggle race (Cursor Bugbot): open → close (outro starts) → reopen
    // before the outro completes. A stale outro callback must NOT release the lock
    // while the scrim is open and visible. The onoutroend guard (`if (!open)`)
    // ensures only a genuine close clears the tracked element.
    _resetScrollLock();
    const { rerender } = render(Backdrop, { props: { open: true } });
    expect(document.body.style.overflow).toBe('hidden');

    await rerender({ open: false });
    await rerender({ open: true });
    // The scrim is open again; scroll must remain locked.
    expect(document.body.style.overflow).toBe('hidden');

    await rerender({ open: false });
    expect(document.body.style.overflow).toBe('');
  });
});
