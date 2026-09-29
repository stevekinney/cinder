import { prepareSvelteServerSource, renderSvelteOnServer } from '@lostgradient/testing';
import { describe, expect, test } from 'bun:test';
const sourcePath = new URL('./resizable-panels.svelte', import.meta.url).pathname;
const fixturePath = new URL('./_resizable-panels-ssr-test.svelte', import.meta.url).pathname;
await prepareSvelteServerSource(fixturePath);

describe('ResizablePanels SSR contract', () => {
  test('renders without throwing when layoutState is null (unmeasured SSR pass)', async () => {
    // This test is the primary regression guard for the
    // `TypeError: Cannot read properties of null (reading 'availablePanePixels')`
    // crash. If any code path in the component dereferences `layoutState`
    // without a null-check during the initial render, `render()` throws and
    // this test fails.
    const html = await renderSvelteOnServer(fixturePath);

    // The render() call above would have thrown if the crash were present.
    // Reaching here proves the null-deref is absent.
    expect(html).toBeTruthy();
  });

  test('emits both panel sections with their expected IDs in SSR HTML', async () => {
    const html = await renderSvelteOnServer(fixturePath);

    // Both pane sections must appear in the server output with their
    // component-id-prefixed IDs.
    expect(html).toContain('sidebar');
    expect(html).toContain('editor');
    expect(html).toContain('cinder-resizable-panels__pane');
  });

  test('emits a role="separator" handle between panes in SSR HTML', async () => {
    const html = await renderSvelteOnServer(fixturePath);

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
    const html = await renderSvelteOnServer(fixturePath);

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
    const html = await renderSvelteOnServer(fixturePath);

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
