/// <reference lib="dom" />
/**
 * Hydration contract for Modal.
 *
 * Modal renders a native `<dialog role="dialog">` whose `aria-labelledby` points
 * at a `$props.id()`-generated title id and whose optional `aria-describedby` is
 * consumer-supplied. Two things matter for hydration:
 *
 * 1. A closed modal emits no dialog on the server, then mounts cleanly on the
 *    client without hydration warnings.
 * 2. The title id is derived deterministically, so the `aria-labelledby`
 *    relationship the server would emit is exactly the one the client resolves —
 *    we assert that the open dialog's `aria-labelledby` resolves to the title
 *    element and that `aria-describedby` is wired through.
 *
 * KNOWN GAP: the open-dialog test below is a CLIENT-ONLY render, not a hydration
 * round-trip. Modal's open body uses an attachment, and the SSR-recompile helper
 * nulls `document` during the server pass, which is incompatible with rendering
 * raw-snippet children server-side. So that test proves the client wires
 * `aria-labelledby`/`aria-describedby` correctly, but does NOT prove the SSR HTML
 * and the hydrated client agree on those ids for an initially-open dialog. The
 * SSR-stable $props.id() derivation makes drift unlikely, but it is not asserted here.
 */
import { describe, expect, test } from 'bun:test';
import { createRawSnippet } from 'svelte';

import { setupHappyDom } from '../../test/happy-dom.ts';
import { renderThenHydrate } from '../../test/hydrate.ts';

setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { default: Modal } = await import('./modal.svelte');
const sourcePath = new URL('./modal.svelte', import.meta.url).pathname;

const bodyContent = createRawSnippet(() => ({
  render: () => `<p id="modal-body-copy">Are you sure?</p>`,
}));

describe('Modal hydration', () => {
  test('a closed modal SSRs to empty markup and mounts without hydration warnings', async () => {
    const result = await renderThenHydrate(Modal, sourcePath, {
      open: false,
      title: 'Confirm',
      children: bodyContent,
    });

    try {
      // Closed modal emits no dialog on the server (only empty {#if} markers).
      expect(result.ssrHtml).not.toContain('<dialog');
      expect(result.ssrHtml).not.toContain('role="dialog"');
      const hydrationWarnings = result.warnings.filter((w) =>
        w.toLowerCase().includes('hydration'),
      );
      expect(hydrationWarnings).toEqual([]);
    } finally {
      result.cleanup();
    }
  });

  test('the open dialog wires aria-labelledby to the title and aria-describedby through', () => {
    const { container } = render(Modal, {
      props: {
        open: true,
        title: 'Delete file',
        describedById: 'modal-body-copy',
        children: bodyContent,
      },
    });

    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.getAttribute('aria-modal')).toBe('true');

    // aria-labelledby resolves to the title <h2>, whose id comes from $props.id().
    const labelledBy = dialog?.getAttribute('aria-labelledby');
    expect(labelledBy).toBeTruthy();
    const titleElement = container.querySelector(`#${labelledBy}`);
    expect(titleElement?.textContent).toContain('Delete file');

    // The consumer-supplied describedById is forwarded verbatim.
    expect(dialog?.getAttribute('aria-describedby')).toBe('modal-body-copy');
  });
});
