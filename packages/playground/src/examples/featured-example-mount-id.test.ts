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
 */

import { describe, expect, it } from 'bun:test';
import { join } from 'node:path';

const EXAMPLES_DIR = join(import.meta.dir);

/** Read a featured example file relative to this test's directory. */
async function readExample(relativePath: string): Promise<string> {
  return Bun.file(join(EXAMPLES_DIR, relativePath)).text();
}

/** True when the source declares a `mountIdPrefix` prop via `$props()`. */
function declaresMountIdPrefixProp(source: string): boolean {
  return /let\s*\{[^}]*\bmountIdPrefix\b[^}]*\}\s*:\s*\{[^}]*\}\s*=\s*\$props\(\)/.test(source);
}

/**
 * True when the source reads its per-instance `$props.id()` fallback. `mountIdPrefix`
 * cannot default to `$props.id()` inside the destructure (Svelte's placement rule),
 * so the idiom is a separate `const uid = $props.id()` and `mountIdPrefix ?? uid` at
 * every id site. Without the fallback, a standalone copy (no injected prefix) would
 * emit `undefined`-based ids and two standalone copies would still collide.
 */
function declaresPropsIdFallback(source: string): boolean {
  return (
    /const\s+uid\s*=\s*\$props\.id\(\)/.test(source) && /mountIdPrefix\s*\?\?\s*uid/.test(source)
  );
}

/** True when the source derives at least one id from the `mountIdPrefix ?? uid` base. */
function derivesIdFromMountPrefix(source: string): boolean {
  return /\$derived\([^)]*mountIdPrefix\s*\?\?\s*uid/.test(source);
}

/**
 * Every featured (alphabetically-first, or `featured = true`) example the doc
 * page double-mounts. Each emitted at least one hardcoded element id before the
 * #399 fix; those literals are recorded so the guard asserts they are gone from
 * the call sites. Keep this list in sync with the example set — every example
 * whose first scenario reaches the DOM with an `id`/`name` belongs here.
 */
export const FEATURED_EXAMPLES = [
  {
    component: 'accordion',
    file: 'accordion/basic.example.svelte',
    oldHardcodedIds: ['item-1', 'item-2', 'item-3'],
  },
  {
    component: 'autocomplete',
    file: 'autocomplete/async.example.svelte',
    oldHardcodedIds: ['autocomplete-async'],
  },
  {
    component: 'chat',
    file: 'chat/basic.example.svelte',
    oldHardcodedIds: ['playground-basic-chat'],
  },
  {
    component: 'checkbox',
    file: 'checkbox/basic.example.svelte',
    oldHardcodedIds: ['checkbox-terms', 'checkbox-newsletter'],
  },
  {
    component: 'color-field',
    file: 'color-field/basic.example.svelte',
    oldHardcodedIds: ['color-field-basic'],
  },
  {
    component: 'combobox',
    file: 'combobox/basic.example.svelte',
    oldHardcodedIds: ['combobox-fruit'],
  },
  {
    component: 'command-menu',
    file: 'command-menu/slash-in-textarea.example.svelte',
    oldHardcodedIds: ['command-menu-textarea'],
  },
  {
    component: 'date-range-field',
    file: 'date-range-field/basic.example.svelte',
    oldHardcodedIds: ['basic-date-range'],
  },
  {
    component: 'drawer',
    file: 'drawer/basic.example.svelte',
    oldHardcodedIds: ['drawer-side', 'drawer-size', 'drawer-use-trigger-ref'],
  },
  {
    component: 'dropdown',
    file: 'dropdown/basic.example.svelte',
    oldHardcodedIds: ['dropdown-basic'],
  },
  {
    component: 'form-field',
    file: 'form-field/basic.example.svelte',
    oldHardcodedIds: ['full-name'],
  },
  {
    component: 'form-section',
    file: 'form-section/account-settings.example.svelte',
    oldHardcodedIds: ['display-name', 'account-email', 'public-profile', 'marketing-emails'],
  },
  { component: 'input', file: 'input/basic.example.svelte', oldHardcodedIds: ['name'] },
  {
    component: 'json-schema-editor',
    file: 'json-schema-editor/basic.example.svelte',
    oldHardcodedIds: ['basic-jse'],
  },
  {
    component: 'markdown-editor',
    file: 'markdown-editor/basic.example.svelte',
    oldHardcodedIds: ['playground-markdown-editor'],
  },
  {
    component: 'modal',
    file: 'modal/basic.example.svelte',
    oldHardcodedIds: ['invite-name', 'invite-email'],
  },
  {
    component: 'phone-input',
    file: 'phone-input/basic.example.svelte',
    oldHardcodedIds: ['basic-phone'],
  },
  {
    component: 'pin-input',
    file: 'pin-input/alphanumeric.example.svelte',
    oldHardcodedIds: ['invite-code'],
  },
  {
    component: 'radio-group',
    file: 'radio-group/basic.example.svelte',
    oldHardcodedIds: ['basic-plan', 'basic-plan-free', 'basic-plan-pro', 'basic-plan-team'],
  },
  { component: 'rating', file: 'rating/basic.example.svelte', oldHardcodedIds: ['basic-rating'] },
  {
    component: 'review-editor',
    file: 'review-editor/basic.example.svelte',
    oldHardcodedIds: ['playground-review-editor-basic'],
  },
  {
    component: 'search-field',
    file: 'search-field/basic.example.svelte',
    oldHardcodedIds: ['search-field-basic'],
  },
  {
    component: 'segmented-control',
    file: 'segmented-control/basic.example.svelte',
    oldHardcodedIds: ['playground-view'],
  },
  { component: 'select', file: 'select/basic.example.svelte', oldHardcodedIds: ['country'] },
  {
    component: 'skip-link',
    file: 'skip-link/basic.example.svelte',
    oldHardcodedIds: ['skip-link-example-main'],
  },
  {
    component: 'tag-input',
    file: 'tag-input/basic.example.svelte',
    oldHardcodedIds: ['basic-tag-input'],
  },
  { component: 'textarea', file: 'textarea/basic.example.svelte', oldHardcodedIds: ['bio'] },
  {
    component: 'toggle',
    file: 'toggle/basic.example.svelte',
    oldHardcodedIds: ['email-notifications'],
  },
] as const;

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

describe('mountIdPrefix derivation — two mounts never collide (#399)', () => {
  /**
   * Models the exact idiom every featured example uses for an emitted id:
   * `${mountIdPrefix ?? uid}-${suffix}`. The duplicate-id bug existed because a
   * hardcoded literal produced the SAME string in both the Overview and Examples
   * mounts. The fix makes every id a function of the per-mount prefix, so this
   * pure-function check is the structural proof the source-shape guards above
   * pin in each file: distinct prefixes ⇒ distinct ids, by construction.
   */
  const derivedId = (prefix: string, suffix: string): string => `${prefix}-${suffix}`;

  it('produces distinct ids for the two mount containers', () => {
    const overview = derivedId('overview-mount-basic', 'field');
    const examples = derivedId('example-mount-basic', 'field');
    expect(overview).not.toBe(examples);
  });

  it('keeps every child id distinct across mounts when one prefix scopes many suffixes', () => {
    const suffixes = ['label', 'description', 'error', 'listbox'];
    const overviewIds = suffixes.map((suffix) => derivedId('overview-mount-basic', suffix));
    const exampleIds = suffixes.map((suffix) => derivedId('example-mount-basic', suffix));
    const all = new Set([...overviewIds, ...exampleIds]);
    expect(all.size).toBe(overviewIds.length + exampleIds.length);
  });

  it('falls back to the per-instance $props.id() so two standalone copies also differ', () => {
    // No injected prefix → each copy reads its own stable `$props.id()` (modeled
    // here as two distinct uids), so even unscoped duplicates never collide.
    expect(derivedId('s1abc', 'field')).not.toBe(derivedId('s2xyz', 'field'));
  });
});
