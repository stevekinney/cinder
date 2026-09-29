/// <reference lib="dom" />
import { requiredInstance, setupHappyDom } from '@lostgradient/testing';
import { afterEach, describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { createRawSnippet } from 'svelte';
import { resetScrollLock } from '../../_internal/overlay.ts';
import { emptySnippet, installModalDialogStubs, textSnippet } from './modal-test-helpers.ts';

setupHappyDom();
installModalDialogStubs();
const { cleanup, fireEvent, render } = await import('@testing-library/svelte');
const { default: Modal } = await import('./modal.svelte');

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
  resetScrollLock();
});
describe('Modal', () => {
  test('a click on a descendant of the data-cinder-modal-backdrop element does not dismiss', async () => {
    const scrimSnippet = createRawSnippet(() => ({
      render: () =>
        `<div data-cinder-modal-backdrop style="width: 100%; height: 100%;"><button type="button" id="real-content">Real content</button></div>`,
      setup: () => {},
    }));
    let openValue = true;
    const { container } = render(Modal, {
      props: {
        get open() {
          return openValue;
        },
        set open(value: boolean) {
          openValue = value;
        },
        chrome: 'none',
        'aria-label': 'Image viewer',
        children: scrimSnippet,
      },
    });
    const content = requiredInstance(container.querySelector('#real-content'), HTMLElement);
    await fireEvent.click(content);
    expect(openValue).toBe(true);
  });
  test('dismissOnBackdropClick=false suppresses data-cinder-modal-backdrop dismissal too', async () => {
    const scrimSnippet = createRawSnippet(() => ({
      render: () => `<div data-cinder-modal-backdrop style="width: 100%; height: 100%;"></div>`,
      setup: () => {},
    }));
    let openValue = true;
    const { container } = render(Modal, {
      props: {
        get open() {
          return openValue;
        },
        set open(value: boolean) {
          openValue = value;
        },
        chrome: 'none',
        'aria-label': 'Image viewer',
        dismissOnBackdropClick: false,
        children: scrimSnippet,
      },
    });
    const scrim = requiredInstance(
      container.querySelector('[data-cinder-modal-backdrop]'),
      HTMLElement,
    );
    await fireEvent.click(scrim);
    expect(openValue).toBe(true);
  });
  test('data-cinder-modal-backdrop has no effect in the default chrome', async () => {
    // Regression guard: this marker is a chromeless-only escape hatch. A
    // consumer accidentally leaving it on content rendered in the default
    // chrome must not get surprise backdrop-equivalent dismissal there.
    const scrimSnippet = createRawSnippet(() => ({
      render: () => `<div data-cinder-modal-backdrop style="width: 100%; height: 100%;"></div>`,
      setup: () => {},
    }));
    let openValue = true;
    const { container } = render(Modal, {
      props: {
        get open() {
          return openValue;
        },
        set open(value: boolean) {
          openValue = value;
        },
        title: 'Test Modal',
        children: scrimSnippet,
      },
    });
    const scrim = requiredInstance(
      container.querySelector('[data-cinder-modal-backdrop]'),
      HTMLElement,
    );
    await fireEvent.click(scrim);
    expect(openValue).toBe(true);
  });
  test('modal.css clears the reserved scrollbar gutter for the chromeless body', async () => {
    // Regression: the base body rule's `scrollbar-gutter: stable` reserves
    // an inline-end band on classic-scrollbar platforms even when the body
    // does not overflow. On a full-bleed chromeless surface that band
    // visibly shifts centered content (e.g. an image lightbox's photo) away
    // from true viewport center.
    const css = await Bun.file(new URL('./modal.css', import.meta.url)).text();
    expect(css).toMatch(
      /\.cinder-modal__body\[data-cinder-chrome='none'\]\s*\{[^}]*scrollbar-gutter:\s*auto;/s,
    );
  });
  test('marks the footer with data-cinder-chrome="none" and modal.css resets its background/border/padding', async () => {
    // Regression: chromeless mode fills the dialog's entire content box with
    // the panel/body/footer as one full-bleed surface, but the footer kept
    // painting its own card-style background, top border, and padding —
    // breaking the "genuinely full-bleed" contract when a consumer uses
    // chrome="none" together with a footer snippet.
    const { container } = render(Modal, {
      props: {
        open: true,
        chrome: 'none',
        'aria-label': 'Image viewer',
        children: emptySnippet,
        footer: textSnippet('Footer content'),
      },
    });
    const footer = container.querySelector('.cinder-modal__footer');
    expect(footer?.getAttribute('data-cinder-chrome')).toBe('none');

    const css = await Bun.file(new URL('./modal.css', import.meta.url)).text();
    expect(css).toMatch(
      /\.cinder-modal__footer\[data-cinder-chrome='none'\]\s*\{[^}]*padding:\s*0;/s,
    );
    expect(css).toMatch(
      /\.cinder-modal__footer\[data-cinder-chrome='none'\]\s*\{[^}]*background:\s*transparent;/s,
    );
    expect(css).toMatch(
      /\.cinder-modal__footer\[data-cinder-chrome='none'\]\s*\{[^}]*border-block-start:\s*none;/s,
    );
  });
  test('desktop drag strip is omitted for chromeless content', () => {
    const source = readFileSync(new URL('./modal.svelte', import.meta.url), 'utf8');

    expect(source).toContain('host.isDesktop && !isChromeless');
    expect(source).not.toContain('host.isDesktop}<div class="cinder-modal__drag-strip"');
  });

  test('clicking the panel background dismisses (backdrop-equivalent) since the panel fills the whole dialog', async () => {
    // Regression: chrome="none" makes the panel/body fill the dialog's
    // entire content box (width/height 100%, inset 0), so a real click can
    // never land directly on `dialogElement` — event.target === dialogElement
    // is unreachable there. The panel/body ARE the backdrop-equivalent
    // surface for this chrome.
    let openValue = true;
    const { container } = render(Modal, {
      props: {
        get open() {
          return openValue;
        },
        set open(value: boolean) {
          openValue = value;
        },
        chrome: 'none',
        'aria-label': 'Image viewer',
        children: emptySnippet,
      },
    });
    const panel = requiredInstance(container.querySelector('.cinder-modal__panel'), HTMLElement);
    await fireEvent.click(panel);
    expect(openValue).toBe(false);
  });
  test('clicking the body background dismisses (backdrop-equivalent)', async () => {
    let openValue = true;
    const { container } = render(Modal, {
      props: {
        get open() {
          return openValue;
        },
        set open(value: boolean) {
          openValue = value;
        },
        chrome: 'none',
        'aria-label': 'Image viewer',
        children: emptySnippet,
      },
    });
    const body = requiredInstance(container.querySelector('.cinder-modal__body'), HTMLElement);
    await fireEvent.click(body);
    expect(openValue).toBe(false);
  });
  test('dismissOnBackdropClick=false keeps chromeless panel/body clicks from closing', async () => {
    let openValue = true;
    const { container } = render(Modal, {
      props: {
        get open() {
          return openValue;
        },
        set open(value: boolean) {
          openValue = value;
        },
        chrome: 'none',
        'aria-label': 'Image viewer',
        dismissOnBackdropClick: false,
        children: emptySnippet,
      },
    });
    const panel = requiredInstance(container.querySelector('.cinder-modal__panel'), HTMLElement);
    await fireEvent.click(panel);
    expect(openValue).toBe(true);
  });
  test('a click on real content INSIDE the chromeless body does not dismiss (event.target is the content, not the body/panel)', async () => {
    const contentSnippet = createRawSnippet(() => ({
      render: () => `<button type="button" id="real-content">Real content</button>`,
      setup: () => {},
    }));
    let openValue = true;
    const { container } = render(Modal, {
      props: {
        get open() {
          return openValue;
        },
        set open(value: boolean) {
          openValue = value;
        },
        chrome: 'none',
        'aria-label': 'Image viewer',
        children: contentSnippet,
      },
    });
    const content = requiredInstance(container.querySelector('#real-content'), HTMLElement);
    await fireEvent.click(content);
    expect(openValue).toBe(true);
  });
  test('default chrome is unaffected: clicking the panel/body does NOT dismiss (only event.target === dialogElement does)', async () => {
    // Regression guard: the chromeless-only fallback (panel/body as
    // backdrop-equivalent) must not leak into the default chrome, where
    // clicking the panel/body is a normal part of the visible card, not a
    // backdrop click.
    let openValue = true;
    const { container } = render(Modal, {
      props: {
        get open() {
          return openValue;
        },
        set open(value: boolean) {
          openValue = value;
        },
        title: 'Test Modal',
        children: emptySnippet,
      },
    });
    const panel = requiredInstance(container.querySelector('.cinder-modal__panel'), HTMLElement);
    const body = requiredInstance(container.querySelector('.cinder-modal__body'), HTMLElement);
    await fireEvent.click(panel);
    expect(openValue).toBe(true);
    await fireEvent.click(body);
    expect(openValue).toBe(true);
  });
  test('data-cinder-modal-backdrop on a consumer full-bleed child dismisses, independent of the panel/body checks', async () => {
    // Regression: the canonical chromeless composition (see
    // chromeless.example.svelte) renders a root child that fills the body
    // (width/height 100%) — every empty-surface click's target is THAT
    // child, never the body/panel, so the panel/body fallback above never
    // fires. A consumer opts a full-bleed scrim wrapper into
    // backdrop-equivalent dismissal by marking it with
    // `data-cinder-modal-backdrop`.
    const scrimSnippet = createRawSnippet(() => ({
      render: () =>
        `<div data-cinder-modal-backdrop style="width: 100%; height: 100%;"><button type="button" id="real-content">Real content</button></div>`,
      setup: () => {},
    }));
    let openValue = true;
    const { container } = render(Modal, {
      props: {
        get open() {
          return openValue;
        },
        set open(value: boolean) {
          openValue = value;
        },
        chrome: 'none',
        'aria-label': 'Image viewer',
        children: scrimSnippet,
      },
    });
    const scrim = requiredInstance(
      container.querySelector('[data-cinder-modal-backdrop]'),
      HTMLElement,
    );
    await fireEvent.click(scrim);
    expect(openValue).toBe(false);
  });
});
