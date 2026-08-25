/// <reference lib="dom" />

/**
 * ImageLightbox SSR contract (CIN-377 review — supersedes the round-17/18
 * SSR-visible-dialog approach).
 *
 * `packages/components/src/_internal/OVERLAY-POLICY.md` § "SSR rule (hard
 * constraint)" (the canonical contract authored for CIN-374) is authoritative
 * here: every Cinder overlay's SURFACE — the floating panel, listbox, or
 * dialog — renders NOTHING on the server, regardless of its initial `open`
 * state, matching Drawer's `{#if dialogState.hydrated}` and Popover's
 * `{#if mounted && ...}` gates. The trade-off the policy explicitly accepts is
 * a one-frame render delay on the client when an overlay starts open, in
 * exchange for a single, predictable hydration model with no `open={true}`
 * server/client mismatch.
 *
 * An earlier revision briefly had Modal emit the `open` HTML attribute
 * directly during SSR (guarded by `esm-env`'s `BROWSER`) so a deep-linked
 * initially-open lightbox would be visible before hydration instead of
 * `display:none`. That was reverted: a plain attribute-open `<dialog>` is not
 * a real top-layer modal — no `::backdrop`, no focus trap, no scroll lock, no
 * inertness of the rest of the page — which is worse than the policy's
 * accepted one-frame delay, and it broke the single predictable hydration
 * model the policy exists to guarantee. Modal's own `{#if mounted}` gate (see
 * modal.svelte) is the enforcement point; this file is the executable
 * statement of what that produces for ImageLightbox specifically, since
 * ImageLightbox composes Modal and has its own `hasOpenedOnce` lazy-mount gate
 * layered on top.
 *
 * `hasOpenedOnce` (seeded from `open`, not a hardcoded `false`) governs
 * whether ImageLightbox's OWN `{#if hasOpenedOnce && currentImage}` wrapper
 * renders a `<Modal>` component invocation at all during SSR — but per the
 * policy's own scoping note ("This rule governs the overlay surface... not
 * the host component around it"), that's fine: Modal itself still renders
 * nothing internally while `mounted` is false, so whether ImageLightbox's
 * wrapper is present or absent in the server output, no `<dialog>` markup
 * ever appears either way.
 */
import { describe, expect, test } from 'bun:test';
import { resolve } from 'node:path';

import { renderToServerHtml } from '../../../test/server-render.ts';

const sourcePath = resolve(import.meta.dir, 'image-lightbox.svelte');

const images = [
  { src: '/a.jpg', alt: 'Image A' },
  { src: '/b.jpg', alt: 'Image B' },
];

describe('ImageLightbox SSR contract', () => {
  test('an initially-open lightbox (open={true}) server-renders NO visible dialog at all', async () => {
    const html = await renderToServerHtml(sourcePath, {
      images,
      initialIndex: 0,
      open: true,
    });

    expect(html).not.toContain('<dialog');
    expect(html).not.toContain('role="dialog"');
    expect(html).not.toContain('aria-modal="true"');
  });

  test('an initially-open lightbox with a non-zero initialIndex still server-renders no dialog', async () => {
    const html = await renderToServerHtml(sourcePath, {
      images,
      initialIndex: 1,
      open: true,
    });

    expect(html).not.toContain('<dialog');
    expect(html).not.toContain('src="/b.jpg"');
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
