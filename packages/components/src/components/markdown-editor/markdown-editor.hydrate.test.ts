/**
 * MarkdownEditor SSR → hydration path test
 *
 * Verifies that the server renders <EditorSkeleton> (the SSR branch) and
 * the client hydrates without a hydration-mismatch warning.
 *
 * MarkdownEditor's SSR contract:
 *   - Server: `{#if browser}` is false → renders <EditorSkeleton>
 *   - Client: `BROWSER` from esm-env resolves to true → hydrates with the
 *     live editor inside the `{#if browser}` branch
 *
 * LIVE-EDITOR HYDRATION STATUS — BLOCKED (tracking note):
 * =========================================================
 * The `renderThenHydrate` helper works by compiling the .svelte source in
 * `generate: 'server'` mode, writing the compiled output to a temp .mjs file,
 * and dynamically importing it. When Bun resolves that .mjs file's imports,
 * `@lostgradient/cinder/editor/component-runtime` matches the "node" conditional export
 * (no "bun" condition exists), which points to `./dist/server/…` — a file
 * that does not exist in the development tree.
 *
 * Root cause: `@lostgradient/cinder/editor/component-runtime` bundles ProseMirror symbols.
 * ProseMirror touches the DOM at module-evaluation time, so the package.json
 * uses a server-specific "node" export to provide a stub — but the stub's
 * dist is not built in development. The Svelte preload plugin (which maps
 * imports to src/) only applies to the Bun native module loader, not to
 * dynamically imported .mjs files the helper writes to disk.
 *
 * To unblock full live-editor hydration, one of:
 * (a) Add a "bun" condition to `@lostgradient/cinder/editor/component-runtime` → src file.
 * (b) Implement a Playwright browser test that exercises real hydration.
 * (c) Build the dist before running these tests.
 *
 * This test verifies the parts that CAN be tested without full hydration:
 * reading the SSR output statically and asserting on the skeleton contract.
 * Those assertions are correct and meaningful for the SSR side of the contract.
 */

import { describe, expect, test } from 'bun:test';

// SSR contract verification via source analysis
// The server render produces EditorSkeleton because `browser` is false.
// We verify this contract by reading the component source rather than
// attempting to dynamically compile+import it (which is blocked per above).

const SVELTE_SOURCE = await Bun.file(
  new URL('./markdown-editor.svelte', import.meta.url).pathname,
).text();

describe('MarkdownEditor SSR contract (source-level verification)', () => {
  test('renders EditorSkeleton in the {:else} branch of {#if browser}', () => {
    // The component has: {#if browser} ... {:else} <EditorSkeleton .../> {/if}
    // This is the server-rendered path. Verify the structure exists.
    expect(SVELTE_SOURCE).toMatch(/\{:else\}[\s\S]*?EditorSkeleton/);
  });

  test('EditorSkeleton is in the {:else} immediately before the closing {/if}', () => {
    // The component structure is:
    //   {#if browser}
    //     ... live editor ...
    //   {:else}
    //     <EditorSkeleton .../>
    //   {/if}
    // Verify the else→skeleton→close-if sequence exists directly.
    expect(SVELTE_SOURCE).toMatch(/\{:else\}\s*\n\s*<EditorSkeleton[^>]*\/>\s*\n\s*\{\/if\}/);
  });

  test('BROWSER import guard: effects use `if (!browser) return` early-return pattern', () => {
    // The two dynamic-import effects each guard with `if (!browser) return;`
    // This is the runtime SSR safety mechanism — effects never fire on the server.
    const earlyReturnGuards = SVELTE_SOURCE.match(/if \(!browser\) return;/g) ?? [];
    expect(earlyReturnGuards.length).toBeGreaterThanOrEqual(2);
  });

  test('server output does not render the live editor (role=application) element', () => {
    // The live editor div has role="application". Svelte's SSR renderer won't
    // emit it because it's inside `{#if browser}`.
    // Extract the browser branch by finding the outer {#if browser} … {:else} boundary.
    // Use index-based extraction rather than a non-greedy regex to avoid matching
    // the inner {:else} inside {#if mode === 'wysiwyg'} that appears before the
    // browser/server boundary.
    const ifBrowserStart = SVELTE_SOURCE.indexOf('{#if browser}');
    expect(ifBrowserStart).toBeGreaterThan(-1);
    // The EditorSkeleton {:else} is: {:else}\n    <EditorSkeleton — find this sequence.
    const elseSkeletonMarker = '{:else}\n    <EditorSkeleton';
    const elseStart = SVELTE_SOURCE.indexOf(elseSkeletonMarker, ifBrowserStart);
    expect(elseStart).toBeGreaterThan(ifBrowserStart);
    const browserBranch = SVELTE_SOURCE.slice(ifBrowserStart + '{#if browser}'.length, elseStart);
    expect(browserBranch).toContain('role="application"');
  });

  test('EditorSkeleton is referenced by name in the component source', () => {
    // Confirms the SSR-rendered skeleton component is present in the source.
    expect(SVELTE_SOURCE).toContain('EditorSkeleton');
  });
});

describe('MarkdownEditor hydration status', () => {
  // Acceptance criterion from the plan: "Default-mode (wysiwyg) hydrate test passes,
  // OR live-editor hydration is explicitly marked blocked/unmet with a tracking note."
  //
  // Full renderThenHydrate is blocked by `@lostgradient/cinder/editor/component-runtime` having no
  // "bun" conditional export — the "node" export points to a missing dist file.
  // See file header for the three unblocking options. When unblocked, replace this
  // todo with a real renderThenHydrate assertion.
  test.skip('live-editor hydration BLOCKED — cinder/editor/component-runtime missing "bun" conditional export (see file header)', () => {});
});
