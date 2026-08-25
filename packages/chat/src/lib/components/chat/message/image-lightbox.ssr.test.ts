/// <reference lib="dom" />

/**
 * ImageLightbox SSR contract (CIN-377 review).
 *
 * `hasOpenedOnce` gates whether `<Modal>` mounts at all (lazy mount — see
 * image-lightbox.svelte and image-lightbox.test.ts's "lazy Modal mount"
 * suite). That flag is written from an `$effect`, which never runs on the
 * server. A hardcoded `let hasOpenedOnce = $state(false)` therefore meant an
 * instance server-rendered with `open={true}` from the start — a deep link
 * into an already-open lightbox, or any consumer that seeds `open` truthy —
 * emitted NO `<dialog>` markup at all during SSR: a hydration flash where the
 * lightbox only pops in once the client-side effect first runs, and no
 * content whatsoever for a client that never hydrates.
 *
 * The fix seeds `hasOpenedOnce` from `open` (`$state(open)`) instead of a
 * hardcoded `false`, so an initially-open instance is SSR-correct from the
 * very first render while an initially-closed instance (the overwhelmingly
 * common case) still renders no dialog on the server at all — genuine lazy
 * SSR omission, not just a client-side lazy-mount optimization.
 */
import { describe, expect, test } from 'bun:test';
import { resolve } from 'node:path';

import { renderToServerHtml } from '../../../test/server-render.ts';

const sourcePath = resolve(import.meta.dir, 'image-lightbox.svelte');

const images = [
  { src: '/a.jpg', alt: 'Image A' },
  { src: '/b.jpg', alt: 'Image B' },
];

/**
 * Extracts the `<dialog ...>` open tag so attribute assertions can be made
 * against exactly that tag's attribute list, rather than a bare
 * `toContain('open')` — which would false-positive on unrelated substrings
 * (`aria-modal`, class names, etc.) appearing anywhere else in the markup.
 */
function extractDialogOpenTag(html: string): string {
  const match = html.match(/<dialog\b[^>]*>/);
  if (!match) {
    throw new Error('Expected the rendered HTML to contain a <dialog> tag.');
  }
  return match[0];
}

describe('ImageLightbox SSR contract', () => {
  test('an initially-open lightbox (open={true}) server-renders the dialog and current image', async () => {
    const html = await renderToServerHtml(sourcePath, {
      images,
      initialIndex: 0,
      open: true,
    });

    expect(html).toContain('<dialog');
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('src="/a.jpg"');
    expect(html).toContain('alt="Image A"');
  });

  test('an initially-open lightbox server-renders the dialog with the `open` attribute, so it is actually visible (not display:none) before hydration', async () => {
    const html = await renderToServerHtml(sourcePath, {
      images,
      initialIndex: 0,
      open: true,
    });

    const dialogOpenTag = extractDialogOpenTag(html);
    // Matches a bare `open` attribute (no value) or `open="..."` as its own
    // token, bounded by whitespace/tag-end on both sides — not merely "open"
    // as a substring of some other attribute or value.
    expect(dialogOpenTag).toMatch(/[\s]open(=["'][^"']*["'])?[\s/>]/);
  });

  test('an initially-open lightbox honors a non-zero initialIndex on the server', async () => {
    const html = await renderToServerHtml(sourcePath, {
      images,
      initialIndex: 1,
      open: true,
    });

    expect(html).toContain('src="/b.jpg"');
    expect(html).toContain('alt="Image B"');
  });

  test('an initially-closed lightbox (open={false}, the default) emits no dialog markup at all', async () => {
    const html = await renderToServerHtml(sourcePath, {
      images,
      initialIndex: 0,
      open: false,
    });

    expect(html).not.toContain('<dialog');
    expect(html).not.toContain('role="dialog"');
  });
});
