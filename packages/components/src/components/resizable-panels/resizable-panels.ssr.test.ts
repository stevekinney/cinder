/**
 * ResizablePanels SSR contract.
 *
 * ResizablePanels is a measured splitter layout. All of its sizing logic lives
 * behind `$effect` bodies and a ResizeObserver — neither of which runs during a
 * server-side render. This means that throughout the entire SSR pass:
 *
 *   - `layoutState` is `null` (the `$state(null)` initializer, never written to)
 *   - `measuredRootPixels` is 0
 *   - `measuredHandlePixels` is 8 (the static default)
 *
 * Every function that touches `layoutState` or computes pixel-based sizes must
 * guard the unmeasured/null path and fall back to safe defaults. The original
 * bug (`TypeError: Cannot read properties of null (reading 'availablePanePixels')`)
 * was caused by at least one reader dereferencing `layoutState` without a
 * null-check during the initial SSR render.
 *
 * This test proves the SSR contract by recompiling the component in
 * `generate: 'server'` mode (bypassing the client build loaded by the test
 * runner's Bun Svelte plugin) and calling `render()` from `svelte/server`.
 * It asserts:
 *   1. The render does NOT throw.
 *   2. Panels are emitted with their expected IDs.
 *   3. A `role="separator"` handle appears between panes.
 *   4. The handle has well-formed ARIA numeric attributes derived from the
 *      equal-split unmeasured fallback (50/50 for two panes).
 *   5. No measured pixel sizes appear in the server HTML (because `layoutState`
 *      is null and no pixel measurements are available).
 *
 * Why we use the server `createRawSnippet` (not the client one): `renderToServerHtml`
 * nulls out `document` and `window` during the server-render pass. The CLIENT
 * `createRawSnippet` tries to construct DOM nodes when its `render()` function is
 * called by Svelte's snippet runtime — that crashes with `window` nulled. The
 * SERVER `createRawSnippet` from `svelte/src/index-server.js` pushes a plain
 * string into the renderer and never touches the DOM.
 *
 * Why we inline the SSR steps instead of delegating to `renderToServerHtml`: that
 * helper's `props` argument is passed through to `render()` verbatim. Creating the
 * server snippet requires a dynamic import of `svelte/src/index-server.js`, which
 * must happen BEFORE the `document`/`window` nulling. Inlining the steps keeps
 * the snippet creation and the globals-nulling in the right order without modifying
 * the shared helper.
 */
import { rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { describe, expect, test } from 'bun:test';
import { compile } from 'svelte/compiler';

import type {
  ResizablePanelDefinition,
  ResizablePanelRenderContext,
} from './resizable-panels.types.ts';

const sourcePath = new URL('./resizable-panels.svelte', import.meta.url).pathname;

const panes: ResizablePanelDefinition[] = [
  {
    id: 'sidebar',
    label: 'Sidebar',
    defaultSize: { value: 28, unit: 'percent' },
    minSize: { value: 180, unit: 'px' },
  },
  {
    id: 'editor',
    label: 'Editor',
    defaultSize: { value: 72, unit: 'percent' },
  },
];

/**
 * Compile the component in server mode and render it with `svelte/server`,
 * passing a `children` snippet created with the server-side `createRawSnippet`
 * (so no DOM access occurs during the render).
 *
 * Returns the rendered HTML body, or re-throws if the render crashes.
 */
async function renderComponentToServerHtml(): Promise<string> {
  // 1. Compile the component source in `generate: 'server'` mode.
  const source = await Bun.file(sourcePath).text();
  const compiled = compile(source, {
    filename: sourcePath,
    generate: 'server',
    css: 'external',
    dev: false,
  });

  // 2. Resolve the Svelte server entry and rewrite bare `svelte` imports in
  //    the compiled output so lifecycle helpers resolve to their SSR variants
  //    (not the client build that the test runner's Bun plugin would provide).
  const sveltePackageJson = new URL(import.meta.resolve('svelte/package.json')).pathname;
  const serverSvelteEntry = pathToFileURL(
    join(dirname(sveltePackageJson), 'src/index-server.js'),
  ).href;
  const serverCode = compiled.js.code.replaceAll(
    "from 'svelte';",
    `from ${JSON.stringify(serverSvelteEntry)};`,
  );

  // 3. Write the compiled server module next to the source so relative imports
  //    (e.g. `../../utilities/class-names.ts`) resolve without path drift.
  const tempFile = join(dirname(sourcePath), `.cinder-ssr-test-${process.pid}-${Date.now()}.mjs`);
  await writeFile(tempFile, serverCode, 'utf-8');

  try {
    // 4. Import the server module and the server-mode `createRawSnippet`.
    //    Both happen BEFORE nulling `document`/`window` so any module-level
    //    code that touches the DOM (e.g. `decode-named-character-reference`)
    //    can still run.
    const ssrModule = (await import(tempFile)) as { default: unknown };
    const { render } = (await import('svelte/server')) as typeof import('svelte/server');

    // 5. Import `createRawSnippet` from the SERVER entry, not the client one.
    //    The server variant pushes a plain string into the renderer — no DOM.
    const { createRawSnippet: serverCreateRawSnippet } = (await import(
      serverSvelteEntry
    )) as typeof import('svelte');

    // 6. Create a server-compatible snippet for the `children` prop.
    //    The server `createRawSnippet` wraps each arg value in a getter before
    //    calling `fn`, so `getPaneOrContext` IS a getter (a `() => value` fn).
    const children = serverCreateRawSnippet<
      [ResizablePanelDefinition, ResizablePanelRenderContext]
    >((getPane) => ({
      render: () => `<div class="pane-content">${getPane().label}</div>`,
    }));

    // 7. Null `document`/`window` around the render to mirror real SSR and
    //    force any accidental browser-global accesses to fail loudly.
    const originalDocument = globalThis.document;
    const originalWindow = globalThis.window;
    globalThis.document = undefined as unknown as Document;
    globalThis.window = undefined as unknown as Window & typeof globalThis;

    try {
      // The SSR module's default export is a server-only render function whose
      // shape doesn't match the public `Component<Props>` type. Route through
      // `unknown` as the shared helpers do — the types are too narrow to express
      // the dual-target (server vs client) compilation reality.
      type ComponentProps = { panes: typeof panes; children: typeof children };
      const { body } = render(ssrModule.default as import('svelte').Component<ComponentProps>, {
        props: { panes, children },
      });
      return body;
    } finally {
      globalThis.document = originalDocument;
      globalThis.window = originalWindow;
    }
  } finally {
    // Best-effort cleanup of the temp module.
    void rm(tempFile, { force: true }).catch(() => {});
  }
}

describe('ResizablePanels SSR contract', () => {
  test('renders without throwing when layoutState is null (unmeasured SSR pass)', async () => {
    // This test is the primary regression guard for the
    // `TypeError: Cannot read properties of null (reading 'availablePanePixels')`
    // crash. If any code path in the component dereferences `layoutState`
    // without a null-check during the initial render, `render()` throws and
    // this test fails.
    const html = await renderComponentToServerHtml();

    // The render() call above would have thrown if the crash were present.
    // Reaching here proves the null-deref is absent.
    expect(html).toBeTruthy();
  });

  test('emits both panel sections with their expected IDs in SSR HTML', async () => {
    const html = await renderComponentToServerHtml();

    // Both pane sections must appear in the server output with their
    // component-id-prefixed IDs.
    expect(html).toContain('sidebar');
    expect(html).toContain('editor');
    expect(html).toContain('cinder-resizable-panels__pane');
  });

  test('emits a role="separator" handle between panes in SSR HTML', async () => {
    const html = await renderComponentToServerHtml();

    expect(html).toContain('role="separator"');
    expect(html).toContain('aria-label="Resize Sidebar and Editor"');
  });

  test('emits the equal-split unmeasured fallback aria values for the handle', async () => {
    // With two panes and no measurements, `getUnmeasuredHandleAriaState` produces
    // a 50/50 split: valueNow=50, valueMin=0, valueMax=100, valueText='0px (50%)'.
    // The format (pixels first, percent in parens) matches the measured-state
    // `getHandleAriaState` so the announced string does not invert on first paint.
    // This proves the SSR path took the safe `getUnmeasuredHandleAriaState` branch
    // rather than calling `getHandleAriaState` (which requires a non-null layoutState).
    const html = await renderComponentToServerHtml();

    expect(html).toContain('aria-valuenow="50"');
    expect(html).toContain('aria-valuemin="0"');
    expect(html).toContain('aria-valuemax="100"');
    expect(html).toContain('aria-valuetext="0px (50%)"');
  });

  test('does not emit pixel-based panel size styles in SSR HTML', async () => {
    // `panelStyle(index)` returns `undefined` when `layoutState === null`,
    // so the SSR output must not contain `--_cinder-resizable-panel-size:`
    // with a pixel value. Any such value would indicate the component
    // incorrectly derived sizes from a null layoutState during the server render.
    const html = await renderComponentToServerHtml();

    expect(html).not.toContain('--_cinder-resizable-panel-size:');
  });

  test('isPaneHiddenFromInteraction reads layoutState once into a guarded local (SSR-safe)', async () => {
    // The examples-consumer SSR build reported `Cannot read properties of null
    // (reading availablePanePixels)` attributed to this function. During the
    // unmeasured SSR pass `layoutState` is null (the measuring effect has not run
    // server-side). Guarding against that null is what keeps the template-time call
    // safe. The behavioural guard is the SSR render test above (it renders the
    // component via `svelte/server` and asserts no throw); this source assertion
    // pins the SSR-safe shape so a refactor cannot silently reintroduce an
    // unguarded `layoutState.availablePanePixels` dereference on the render path.
    const source = await Bun.file(sourcePath).text();
    const fnStart = source.indexOf('function isPaneHiddenFromInteraction');
    expect(fnStart).toBeGreaterThan(-1);
    const fnBody = source.slice(fnStart, source.indexOf('}', fnStart) + 1);
    // Reads the reactive state once into a local…
    expect(fnBody).toContain('const currentLayoutState = layoutState;');
    // …and returns before any dereference when it is null.
    expect(fnBody).toContain('if (currentLayoutState === null) return false;');
    // The dereference only happens through the narrowed local, never the raw state.
    expect(fnBody).not.toMatch(/\blayoutState\.availablePanePixels/);
  });
});
