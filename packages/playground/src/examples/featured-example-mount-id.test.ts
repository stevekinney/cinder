/**
 * Regression tests for issue #399 — duplicate element IDs across the Overview
 * and Examples mounts of a component's featured example.
 *
 * The bug: the doc page (`/page/<slug>`) mounts a component's featured/first
 * example TWICE in non-snapshot mode — once in the Overview live-preview
 * container (`#overview-mount-<scenario>`) and once in the Examples section
 * (`#example-mount-<scenario>`). The affected example files hardcoded static
 * `id` attributes (`id="basic-tag-input"`, `id="bio"`, …), so both mounts
 * emitted identical element IDs into the same document. Duplicate IDs are
 * invalid HTML and break `aria-labelledby` / `aria-describedby` (axe
 * `duplicate-id-aria`).
 *
 * The fix: each mount receives a unique `mountIdPrefix` prop (its container's
 * DOM id) from `component-page.svelte`. The example derives every element id it
 * emits from that prefix, so the two mounts produce fully distinct id trees.
 * The default is `$props.id()` — Svelte 5's per-instance stable id — so two
 * standalone copies of an example never collide even when no prefix is injected.
 * Most cinder field components derive their `-label` / `-description` / `-error`
 * / `-listbox` child ids from the single `id`, so prefixing that one id cascades
 * to all of them.
 *
 * Why source-text analysis instead of a browser test?
 *
 *   The shared `componentPage.open()` fixture forces `?snapshot=1`, and in
 *   snapshot mode ONLY the `example-mount-*` container renders — the Overview
 *   mount is suppressed. So the duplicate-id bug cannot reproduce through the
 *   standard fixture, and a snapshot-mode Playwright test would pass even on the
 *   OLD buggy code (a useless regression guard). The non-snapshot doc page is
 *   heavy (README/Shiki, scroll-spy, the #405 live preview, an iframe shell) and
 *   renders asynchronously, making a document-wide duplicate-id scan flaky.
 *
 *   The bug and the fix are both deterministic source-level properties: a static
 *   `id` literal at the component call site (broken) vs. an `id` derived from the
 *   `mountIdPrefix` prop (fixed). Asserting that property in the source pins the
 *   contract precisely, in milliseconds, with no browser. This mirrors the
 *   established `selection-popover-examples.test.ts` precedent.
 *
 * The featured-example registry and the source-shape predicates live in the
 * sibling {@link ./featured-examples.ts} module (not this test file) so the
 * strip-harness full-corpus sweep can cross-check its count against the same
 * list without importing from a test.
 */

import { describe, expect, it } from 'bun:test';
import { join } from 'node:path';

import {
  declaresMountIdPrefixProp,
  declaresPropsIdFallback,
  derivesIdFromMountPrefix,
  FEATURED_EXAMPLES,
} from './featured-examples.ts';

const EXAMPLES_DIR = join(import.meta.dir);

/** Read a featured example file relative to this test's directory. */
async function readExample(relativePath: string): Promise<string> {
  return Bun.file(join(EXAMPLES_DIR, relativePath)).text();
}

describe('featured example mounts — no duplicate element IDs (#399)', () => {
  for (const { component, file, oldHardcodedIds } of FEATURED_EXAMPLES) {
    describe(component, () => {
      it('declares a mountIdPrefix prop so the doc page can scope each mount', async () => {
        const source = await readExample(file);
        expect(declaresMountIdPrefixProp(source)).toBe(true);
      });

      it('falls back to a per-instance $props.id() when no prefix is injected', async () => {
        const source = await readExample(file);
        expect(declaresPropsIdFallback(source)).toBe(true);
      });

      it('derives at least one element id from the mountIdPrefix base', async () => {
        const source = await readExample(file);
        expect(derivesIdFromMountPrefix(source)).toBe(true);
      });

      for (const oldId of oldHardcodedIds) {
        it(`no longer hardcodes id="${oldId}" / name="${oldId}" at a call site`, async () => {
          const source = await readExample(file);
          expect(source).not.toMatch(new RegExp(`\\b(?:id|name|target|for)=["']${oldId}["']`));
        });
      }
    });
  }
});
