/**
 * MarkdownEditor SSR → hydration path test
 *
 * Verifies that the server renders <EditorSkeleton> (the SSR branch) and
 * the client hydrates the live editor without a hydration-mismatch warning.
 *
 * MarkdownEditor's SSR contract:
 *   - Server: `{#if browser}` is false → renders <EditorSkeleton>
 *   - Client: `BROWSER` from esm-env resolves to true → hydrates with the
 *     live editor inside the `{#if browser}` branch
 *
 */

import { afterEach, describe, expect, test } from 'bun:test';

import { renderThenHydrate } from '../../test/hydrate.ts';

// SSR contract verification via source analysis
// The server render produces EditorSkeleton because `browser` is false.
// We verify this contract by reading the component source rather than
// attempting to dynamically compile+import it (which is blocked per above).

const SVELTE_SOURCE = await Bun.file(
  new URL('./markdown-editor.svelte', import.meta.url).pathname,
).text();
const HYDRATE_HELPER_SOURCE = await Bun.file(
  new URL('../../test/hydrate.ts', import.meta.url).pathname,
).text();

describe('MarkdownEditor SSR contract', () => {
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
    // The EditorSkeleton {:else} is the server branch; match it without
    // depending on indentation so layout wrappers can move around it.
    const elseSkeletonMatch = /\{:else\}\s*\n\s*<EditorSkeleton/.exec(
      SVELTE_SOURCE.slice(ifBrowserStart),
    );
    const elseStart = elseSkeletonMatch === null ? -1 : ifBrowserStart + elseSkeletonMatch.index;
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
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  test('hydrates the default WYSIWYG editor from its server-rendered skeleton', async () => {
    let resolveReady: (() => void) | undefined;
    const ready = new Promise<void>((resolve) => {
      resolveReady = resolve;
    });
    const result = await renderThenHydrate(
      new URL('./markdown-editor.svelte', import.meta.url).pathname,
      {
        id: 'hydration-editor',
        label: 'Hydration editor',
        showToolbar: false,
        value: '# Hydration',
        onready: () => resolveReady?.(),
      },
    );
    cleanup = result.cleanup;

    expect(result.ssrHtml).toContain('editor-skeleton');
    await ready;
    expect(result.container.querySelector('[role="application"]')).not.toBeNull();
    expect(result.container.querySelector('[data-ready="true"]')).not.toBeNull();
    expect(result.warnings).toEqual([]);
  });
});

test('server runtime shim rejects fork on the server', () => {
  expect(HYDRATE_HELPER_SOURCE).toContain(
    `export function fork() { errors.lifecycle_function_unavailable('fork'); }`,
  );
});

test('imports the server bundle before restoring DOM globals', () => {
  const serverImportIndex = HYDRATE_HELPER_SOURCE.indexOf(
    'const serverModule = (await import(pathToFileURL(modulePath).href))',
  );
  const restoreDomIndex = HYDRATE_HELPER_SOURCE.indexOf('globalThis.document = originalDocument;');

  expect(serverImportIndex).toBeGreaterThan(-1);
  expect(restoreDomIndex).toBeGreaterThan(serverImportIndex);
});
