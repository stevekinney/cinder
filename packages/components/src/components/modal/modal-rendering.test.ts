/// <reference lib="dom" />
import { setupHappyDom } from '@lostgradient/testing';
import { afterEach, describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resetScrollLock } from '../../_internal/overlay.ts';
import { emptySnippet, installModalDialogStubs, textSnippet } from './modal-test-helpers.ts';

setupHappyDom();
installModalDialogStubs();
const { cleanup, render } = await import('@testing-library/svelte');
const { default: Modal } = await import('./modal.svelte');

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
  resetScrollLock();
});
describe('Modal', () => {
  test('keeps dialog-owned anchored surfaces outside the dialog clipping boundary', () => {
    const css = readFileSync(new URL('./modal.css', import.meta.url), 'utf8');

    // Anchored overlays are portaled to the open dialog (the native top layer),
    // so the dialog itself must not clip their resolved bounds. Ordinary modal
    // content remains clipped by the panel below.
    expect(css).toMatch(/\.cinder-modal\s*\{[^}]*overflow:\s*visible;/s);
    expect(css).toMatch(/\.cinder-modal__panel\s*\{[^}]*overflow:\s*hidden;/s);
  });
  test('body uses the panel surface beneath header and footer', async () => {
    const css = await Bun.file(new URL('./modal.css', import.meta.url)).text();
    expect(css).toMatch(/\.cinder-modal__body\s*\{[^}]*background:\s*var\(--cinder-surface\)/s);
  });

  // Regression guard: the backdrop previously had no `transition` at all (it
  // snapped in AND out instantly), and the panel's entrance used a
  // one-directional `@keyframes` animation with no matching exit — so the
  // modal appeared but had zero exit animation. Both are now driven by
  // `transition` + `@starting-style`, the same mechanism Drawer/Sheet use,
  // so `waitForTransitionCompletion` (shared via `createSlidingDialogState`)
  // can observe completion and defer the real `dialogElement.close()`.
  test('modal.css replaces the one-directional keyframe entrance with a symmetric transition + starting-style', async () => {
    const css = await Bun.file(new URL('./modal.css', import.meta.url)).text();

    expect(css).not.toContain('@keyframes cinder-modal-enter');
    expect(css).not.toContain('animation: cinder-modal-enter');

    const backdropRuleStart = css.indexOf('.cinder-modal::backdrop {');
    const backdropRuleEnd = css.indexOf('}', backdropRuleStart);
    const backdropRule = css.slice(backdropRuleStart, backdropRuleEnd);
    expect(backdropRule).toContain('backdrop-filter');
    expect(backdropRule).toContain('transition-behavior: allow-discrete;');
    expect(css).toContain('.cinder-modal[data-cinder-closing]::backdrop');

    const panelRuleStart = css.indexOf('.cinder-modal__panel {');
    const panelRuleEnd = css.indexOf('}', panelRuleStart);
    const panelRule = css.slice(panelRuleStart, panelRuleEnd);
    expect(panelRule).toContain('transition:');
    expect(css).toContain('.cinder-modal__panel[data-cinder-closing]');

    // Modal declares two separate `@starting-style` blocks (backdrop, then
    // panel) — assert each independently rather than assuming they're
    // adjacent in the source.
    const startingStyleBlocks = Array.from(
      css.matchAll(/@starting-style\s*\{[\s\S]*?\n {2}\}/g),
    ).map((match) => match[0]);
    expect(startingStyleBlocks.length).toBe(2);
    expect(startingStyleBlocks.some((block) => block.includes('.cinder-modal::backdrop'))).toBe(
      true,
    );
    expect(startingStyleBlocks.some((block) => block.includes('.cinder-modal__panel'))).toBe(true);
  });
  test('dialog is in the DOM but has no open attribute when open=false (client-side)', () => {
    // In a browser context $effect runs, setting mounted=true, so the <dialog> is always
    // present client-side. The dialog is closed (no 'open' attribute) but not torn down,
    // which allows dialogElement.close() to fire correctly on programmatic close.
    // In SSR (no $effect), mounted stays false, so the element is absent from HTML output.
    const { container } = render(Modal, {
      props: {
        open: false,
        title: 'Test Modal',
        children: emptySnippet,
      },
    });
    const dialog = container.querySelector('dialog');
    expect(dialog).not.toBeNull();
    expect(dialog?.hasAttribute('open')).toBe(false);
  });
  test('renders a dialog element when open=true', () => {
    const { container } = render(Modal, {
      props: {
        open: true,
        title: 'Test Modal',
        children: emptySnippet,
      },
    });
    expect(container.querySelector('dialog')).not.toBeNull();
  });
  test('renders the title inside the dialog', () => {
    const { container } = render(Modal, {
      props: {
        open: true,
        title: 'My Dialog Title',
        children: emptySnippet,
      },
    });
    const title = container.querySelector('.cinder-modal__title');
    expect(title).not.toBeNull();
    expect(title?.textContent).toContain('My Dialog Title');
  });
  test('renders children content inside the body', () => {
    const { container } = render(Modal, {
      props: {
        open: true,
        title: 'Test Modal',
        children: textSnippet('Modal body content'),
      },
    });
    const body = container.querySelector('.cinder-modal__body');
    expect(body?.textContent).toContain('Modal body content');
  });
  test('renders footer snippet when provided', () => {
    const { container } = render(Modal, {
      props: {
        open: true,
        title: 'Test Modal',
        children: emptySnippet,
        footer: textSnippet('Footer content'),
      },
    });
    const footer = container.querySelector('.cinder-modal__footer');
    expect(footer).not.toBeNull();
    expect(footer?.textContent).toContain('Footer content');
  });
  test('footer is absent when footer prop is not provided', () => {
    const { container } = render(Modal, {
      props: {
        open: true,
        title: 'Test Modal',
        children: emptySnippet,
      },
    });
    expect(container.querySelector('.cinder-modal__footer')).toBeNull();
  });
  test('close button has aria-label="Close dialog"', () => {
    const { container } = render(Modal, {
      props: {
        open: true,
        title: 'Test Modal',
        children: emptySnippet,
      },
    });
    const closeButton = container.querySelector('.cinder-modal__close');
    expect(closeButton?.getAttribute('aria-label')).toBe('Close dialog');
  });
  test('closeButtonVisible=false omits the close button', () => {
    const { container } = render(Modal, {
      props: {
        open: true,
        title: 'Sticky Modal',
        closeButtonVisible: false,
        children: emptySnippet,
      },
    });

    expect(container.querySelector('.cinder-modal__close')).toBeNull();
  });
});
