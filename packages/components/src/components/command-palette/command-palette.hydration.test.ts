/// <reference lib="dom" />
/**
 * Hydration contract for Command Palette.
 *
 * command-palette.svelte renders its dialog under `{#if dialogState.hydrated}`
 * (SlidingDialogState's hydrated-gated pattern — the same one Drawer uses),
 * so the overlay SURFACE must be empty on the server regardless of the
 * initial `open` prop, per OVERLAY-POLICY.md's SSR rule (hard constraint).
 *
 * This is the literal regression CIN-426 exists to fix: command-palette.svelte
 * used to render its dialog under `{#if mounted || open}`, so `open={true}`
 * during SSR emitted the dialog markup directly instead of an empty overlay
 * surface. The `open={true}`-during-SSR-still-renders-empty assertion below
 * is the one that would have caught that regression.
 *
 * KNOWN GAP (mirrors modal.hydration.test.ts's own documented limitation):
 * a genuine SSR round-trip assertion for `open={true}` — proving the SERVER
 * output is empty AND that the SAME hydrated instance then mounts the real
 * dialog markup on the client — is not exercised here beyond confirming the
 * SSR output is empty and hydration itself completes without warnings. The
 * SSR-recompile helper (`renderThenHydrate`) nulls `document` during the
 * server pass, which is incompatible with rendering raw-snippet children
 * server-side; Modal's own hydration suite hit the identical limitation and
 * documents it rather than silently dropping the assertion, so this file
 * does the same rather than asserting something the helper cannot actually
 * prove.
 */
import { describe, expect, test } from 'bun:test';
import { createRawSnippet } from 'svelte';

import { setupHappyDom } from '../../test/happy-dom.ts';
import { prepareHydrationSource, renderThenHydrate } from '../../test/hydrate.ts';

setupHappyDom();

// happy-dom does not implement HTMLDialogElement.showModal / close — stub
// them (matches command-palette.test.ts's stub) so the post-hydration
// $effect that opens the dialog doesn't throw for the open=true case.
// Unconditionally redefined, not guarded behind `if (!HTMLDialogElement
// .prototype.close)` — Bun's test runner executes every matched file in one
// shared process, so an earlier-loaded file's own (possibly less complete)
// stub would otherwise win. `configurable: true` makes redefining safe
// regardless of load order.
if (typeof HTMLDialogElement !== 'undefined') {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    value: function () {
      Object.defineProperty(this, 'open', {
        value: true,
        configurable: true,
        writable: true,
      });
      this.setAttribute('open', '');
    },
    configurable: true,
    writable: true,
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    value: function () {
      Object.defineProperty(this, 'open', {
        value: false,
        configurable: true,
        writable: true,
      });
      this.removeAttribute('open');
      this.dispatchEvent(new Event('close'));
    },
    configurable: true,
    writable: true,
  });
}

const { render } = await import('@testing-library/svelte');
const { default: CommandPalette } = await import('./command-palette.svelte');
const sourcePath = new URL('./command-palette.svelte', import.meta.url).pathname;
await prepareHydrationSource(sourcePath);

const emptyItems = createRawSnippet(() => ({
  render: () => `<span></span>`,
  setup: () => {},
}));

describe('CommandPalette hydration', () => {
  test('a closed palette SSRs to empty markup and mounts without hydration warnings', async () => {
    const result = await renderThenHydrate(CommandPalette, sourcePath, {
      open: false,
      items: emptyItems,
    });

    try {
      expect(result.ssrHtml).not.toContain('<dialog');
      expect(result.ssrHtml).not.toContain('role="listbox"');
      const hydrationWarnings = result.warnings.filter((w) =>
        w.toLowerCase().includes('hydration'),
      );
      expect(hydrationWarnings).toEqual([]);
    } finally {
      result.cleanup();
    }
  });

  test('an initially-open palette still SSRs to empty markup (the CIN-426 regression), then mounts the real dialog on the client', async () => {
    const result = await renderThenHydrate(CommandPalette, sourcePath, {
      open: true,
      items: emptyItems,
    });

    try {
      // The literal assertion this ticket exists to add: open={true} during
      // SSR must not emit the dialog. Before this fix, `{#if mounted ||
      // open}` made `open={true}` bypass the hydration gate entirely.
      expect(result.ssrHtml).not.toContain('<dialog');
      expect(result.ssrHtml).not.toContain('role="listbox"');

      const hydrationWarnings = result.warnings.filter((w) =>
        w.toLowerCase().includes('hydration'),
      );
      expect(hydrationWarnings).toEqual([]);

      // Per OVERLAY-POLICY.md's "Hydration tests" section, item 3: "Client
      // hydration produces the correct overlay markup post-mount." An empty
      // SSR pass alone does not prove the SAME hydrated instance actually
      // mounts the dialog afterward — a hydration gate that never flips
      // `hydrated`/`renderPanel` back on for an initially-open palette would
      // also pass every assertion above while leaving the palette
      // permanently empty on the client. Assert the post-hydrate DOM
      // directly to rule that out.
      const dialog = result.container.querySelector('dialog');
      expect(dialog).not.toBeNull();
      expect(dialog?.hasAttribute('open')).toBe(true);
      expect(result.container.querySelector('[role="listbox"]')).not.toBeNull();
    } finally {
      result.cleanup();
    }
  });

  test('the open dialog wires aria-modal and aria-label on the client', () => {
    // Client-only render (not a hydration round-trip) — see the KNOWN GAP
    // note at the top of this file for why. Proves the client wires the
    // dialog correctly once dialogState.hydrated flips true; it does not
    // prove server/client agreement for an initially-open palette.
    const { container } = render(CommandPalette, {
      props: { open: true, label: 'Jump to', items: emptyItems },
    });

    const dialog = container.querySelector('dialog');
    expect(dialog).not.toBeNull();
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    expect(dialog?.getAttribute('aria-label')).toBe('Jump to');
  });
});
