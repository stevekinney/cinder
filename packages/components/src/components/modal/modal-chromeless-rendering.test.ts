/// <reference lib="dom" />
import { requiredInstance, setupHappyDom } from '@lostgradient/testing';
import { afterEach, describe, expect, test } from 'bun:test';
import { resetScrollLock } from '../../_internal/overlay.ts';
import { emptySnippet, installModalDialogStubs } from './modal-test-helpers.ts';

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
  test('suppresses the header/title, applying aria-label as the accessible name instead', () => {
    const { container } = render(Modal, {
      props: {
        open: true,
        chrome: 'none',
        'aria-label': 'Image viewer',
        children: emptySnippet,
      },
    });
    const dialog = requiredInstance(container.querySelector('dialog'), HTMLDialogElement);
    expect(container.querySelector('.cinder-modal__header')).toBeNull();
    expect(dialog.getAttribute('aria-label')).toBe('Image viewer');
    expect(dialog.hasAttribute('aria-labelledby')).toBe(false);
  });
  test('still sets role="dialog" and aria-modal="true" from Modal\'s own markup', () => {
    const { container } = render(Modal, {
      props: {
        open: true,
        chrome: 'none',
        'aria-label': 'Image viewer',
        children: emptySnippet,
      },
    });
    const dialog = requiredInstance(container.querySelector('dialog'), HTMLDialogElement);
    expect(dialog.getAttribute('role')).toBe('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
  });
  test('marks the dialog and panel with data-cinder-chrome="none" so CSS can drop border/max-width/padding', () => {
    const { container } = render(Modal, {
      props: {
        open: true,
        chrome: 'none',
        'aria-label': 'Image viewer',
        children: emptySnippet,
      },
    });
    const dialog = requiredInstance(container.querySelector('dialog'), HTMLDialogElement);
    const panel = requiredInstance(container.querySelector('.cinder-modal__panel'), HTMLElement);
    const body = requiredInstance(container.querySelector('.cinder-modal__body'), HTMLElement);
    expect(dialog.getAttribute('data-cinder-chrome')).toBe('none');
    expect(panel.getAttribute('data-cinder-chrome')).toBe('none');
    expect(body.getAttribute('data-cinder-chrome')).toBe('none');
  });
  test('the default chrome renders the header/title and carries no data-cinder-chrome attribute', () => {
    const { container } = render(Modal, {
      props: {
        open: true,
        title: 'Test Modal',
        children: emptySnippet,
      },
    });
    const dialog = requiredInstance(container.querySelector('dialog'), HTMLDialogElement);
    expect(container.querySelector('.cinder-modal__header')).not.toBeNull();
    expect(dialog.hasAttribute('data-cinder-chrome')).toBe(false);
    expect(dialog.getAttribute('aria-labelledby')).not.toBeNull();
  });
  test('modal.css suppresses max-width/border/padding for data-cinder-chrome="none" without touching coordination logic', async () => {
    const css = await Bun.file(new URL('./modal.css', import.meta.url)).text();
    expect(css).toMatch(/\.cinder-modal\[data-cinder-chrome='none'\]\s*\{[^}]*max-width:\s*none;/s);
    expect(css).toMatch(
      /\.cinder-modal__panel\[data-cinder-chrome='none'\]\s*\{[^}]*border:\s*none;/s,
    );
    expect(css).toMatch(
      /\.cinder-modal__body\[data-cinder-chrome='none'\]\s*\{[^}]*padding:\s*0;/s,
    );
  });
  test('modal.css disables the shared scroll-fade\'s opaque edge overlay for data-cinder-chrome="none"', async () => {
    // The shared `.cinder-_scroll-fade` recipe fades with an OPAQUE overlay
    // painted in `--_cinder-scroll-fade-color` (--cinder-surface here) by
    // design (see _scroll-fade.css's design rules). A chromeless body is
    // transparent/full-bleed on purpose, with no surface color to fade INTO
    // — that opaque band would paint a solid stripe across arbitrary
    // full-bleed content (e.g. an image lightbox's photo). `content: none`
    // fully suppresses the generated `::after` box; a bare `opacity: 0`
    // would not be enough, since a running `animation-timeline: scroll()`
    // keyframe overrides plain `opacity` regardless of source order.
    const css = await Bun.file(new URL('./modal.css', import.meta.url)).text();
    expect(css).toMatch(
      /\.cinder-modal__body\[data-cinder-chrome='none'\]::after\s*\{[^}]*content:\s*none;/s,
    );
  });
  test('exposes --cinder-modal-backdrop as a supported backdrop-color override point', async () => {
    const css = await Bun.file(new URL('./modal.css', import.meta.url)).text();
    // Declared on .cinder-modal as a PLAIN (non-self-referencing) reference
    // to --cinder-overlay-backdrop, purely so the variables generator
    // collects --cinder-modal-backdrop into modal.variables.json/README.
    // NOT redeclared on `.cinder-modal::backdrop` at all — the fallback for
    // that pseudo-element lives on the CONSUMING `background-color`
    // property instead (see the cyclic-fallback regression test below for
    // why a redeclaration there would be actively wrong).
    expect(css.replace(/\/\*[\s\S]*?\*\//g, '')).not.toContain('--cinder-modal-backdrop:');
    expect(css).toContain(
      'background-color: var(--cinder-modal-backdrop, var(--cinder-overlay-backdrop));',
    );
  });
  test('the --cinder-modal-backdrop fallback is never a self-referencing (cyclic) custom-property declaration', async () => {
    const css = await Bun.file(new URL('./modal.css', import.meta.url)).text();
    // Regression: `--cinder-modal-backdrop: var(--cinder-modal-backdrop, fallback)`
    // is a CSS custom-property dependency CYCLE — a property referencing
    // itself in its own declaration — which the spec resolves by making the
    // property invalid at computed-value time. Cycle detection happens
    // BEFORE fallback substitution, so the fallback argument does not
    // rescue it: this form breaks the backdrop for every Modal with no
    // override at all. An earlier revision of this file made exactly this
    // mistake trying to avoid shadowing ancestor-scoped overrides; the
    // correct fix moves the fallback to the CONSUMING property
    // (`background-color`) instead of self-referencing the declaration.
    expect(css).not.toContain(
      '--cinder-modal-backdrop: var(--cinder-modal-backdrop, var(--cinder-overlay-backdrop));',
    );

    // `.cinder-modal::backdrop` must not declare --cinder-modal-backdrop at
    // all (a hard literal redeclare there would always win the cascade for
    // that exact pseudo-element, shadowing an ancestor-/:root-scoped
    // consumer override in any engine that would otherwise let it inherit
    // through) — only consume it, with the fallback on the right-hand side
    // of `background-color`.
    const backdropRuleStart = css.indexOf('.cinder-modal::backdrop {');
    const backdropRuleEnd = css.indexOf('}', backdropRuleStart);
    const backdropRule = css.slice(backdropRuleStart, backdropRuleEnd);
    expect(backdropRule).not.toContain('--cinder-modal-backdrop:');
    expect(backdropRule).toContain(
      'background-color: var(--cinder-modal-backdrop, var(--cinder-overlay-backdrop));',
    );
  });
  test('coordination (focus trap, scroll lock, escape stack, exit transition) is unchanged in chromeless mode', async () => {
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
    const dialog = requiredInstance(container.querySelector('dialog'), HTMLDialogElement);
    // Native cancel (Escape) still routes through requestClose()/onDismiss,
    // exactly like the default chrome.
    const cancelEvent = new Event('cancel', { cancelable: true });
    await fireEvent(dialog, cancelEvent);
    expect(cancelEvent.defaultPrevented).toBe(true);
    expect(openValue).toBe(false);
  });
});
