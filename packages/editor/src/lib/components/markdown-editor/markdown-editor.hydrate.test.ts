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

import { prepareSvelteServerSource, renderThenHydrate } from '@lostgradient/testing';
import { flushSync, tick } from 'svelte';
import MarkdownEditor from './markdown-editor.svelte';
import type { MarkdownEditorProps } from './markdown-editor.types.ts';

const sourcePath = new URL('./markdown-editor.svelte', import.meta.url).pathname;
const SVELTE_SOURCE = await Bun.file(sourcePath).text();
const { createReactiveProps } = await import('./markdown-editor-reactive-props-harness.svelte.ts');

// Compile the server graph before the timed hydration assertion. The editor's
// first server compilation can exceed Bun's per-test timeout when the complete
// package suite is cold; the test should measure render and hydrate behavior.
await prepareSvelteServerSource(sourcePath);
describe('MarkdownEditor SSR contract', () => {
  test('renders EditorSkeleton in the {:else} branch of {#if browser}', () => {
    // The component has: {#if browser} ... {:else} <EditorSkeleton .../> {/if}
    // This is the server-rendered path. Verify the structure exists.
    expect(SVELTE_SOURCE).toMatch(/\{:else\}[\s\S]*?EditorSkeleton/);
  });

  test('EditorSkeleton is in the server branch immediately before the closing {/if}', () => {
    // The component structure is:
    //   {#if browser}
    //     ... live editor ...
    //   {:else if currentMode !== 'preview'}
    //     <EditorSkeleton .../>
    //   {/if}
    // A preview-mode server render shows the preview's loading region instead
    // (COR-525). Verify the else→skeleton→close-if sequence exists directly.
    expect(SVELTE_SOURCE).toMatch(
      /\{:else if currentMode !== 'preview'\}\s*\n\s*<EditorSkeleton[^>]*\/>\s*\n\s*\{\/if\}/,
    );
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
    const elseSkeletonMatch = /\{:else if currentMode !== 'preview'\}\s*\n\s*<EditorSkeleton/.exec(
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
  let cleanup: (() => Promise<void>) | undefined;

  afterEach(async () => {
    await cleanup?.();
    cleanup = undefined;
  });

  test('hydrates the default WYSIWYG editor from its server-rendered skeleton', async () => {
    let resolveReady: (() => void) | undefined;
    const ready = new Promise<void>((resolve) => {
      resolveReady = resolve;
    });
    const result = await renderThenHydrate(
      MarkdownEditor,
      sourcePath,
      {
        id: 'hydration-editor',
        label: 'Hydration editor',
        toolbarEnabled: false,
        value: '# Hydration',
        onReady: () => resolveReady?.(),
      },
      {
        id: 'hydration-editor',
        label: 'Hydration editor',
        toolbarEnabled: false,
        value: '# Hydration',
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

describe('MarkdownEditor preview hydration (COR-525)', () => {
  const previewProps = {
    id: 'preview-hydration',
    label: 'Template',
    mode: 'preview',
    value: 'Hello {{name}}',
    placeholderDefinitions: { candidates: [{ path: 'name', types: ['string'] }] },
    placeholderValues: { name: 'Ada' },
  } as const;
  let cleanup: (() => Promise<void>) | undefined;

  afterEach(async () => {
    await cleanup?.();
    cleanup = undefined;
  });

  async function untilTrue(condition: () => boolean): Promise<void> {
    for (let iteration = 0; iteration < 200; iteration += 1) {
      if (condition()) return;
      await tick();
    }
    throw new Error('untilTrue: condition did not become true within 200 ticks');
  }

  test('server output and the first hydration pass render the same inert loading region', async () => {
    const result = await renderThenHydrate(MarkdownEditor, sourcePath, { ...previewProps });
    cleanup = result.cleanup;

    const server = document.createElement('div');
    server.innerHTML = result.ssrHtml;
    const serverRegion = server.querySelector('#preview-hydration-preview');
    expect(serverRegion?.textContent?.trim()).toBe('Loading preview');
    expect(serverRegion?.querySelector('.markdown-editor-preview-loading[inert]')).not.toBeNull();
    expect(result.ssrHtml).not.toContain('editor-skeleton');

    const hydratedRegion = result.container.querySelector('#preview-hydration-preview');
    expect(hydratedRegion?.outerHTML).toBe(serverRegion?.outerHTML);
    expect(result.warnings).toEqual([]);

    await untilTrue(
      () => result.container.querySelector('.markdown-editor-preview-content') !== null,
    );
    expect(hydratedRegion?.textContent).toContain('Hello Ada');
    expect(result.container.querySelector('.ProseMirror')).toBeNull();
  });

  test('rapid mode changes right after hydration settle on the latest mode', async () => {
    const reactive = createReactiveProps({ ...previewProps });
    const result = await renderThenHydrate(
      MarkdownEditor,
      sourcePath,
      reactive.props as unknown as MarkdownEditorProps,
      { ...previewProps },
    );
    cleanup = result.cleanup;

    for (const mode of ['source', 'preview', 'source', 'preview']) {
      reactive.set('mode', mode);
      flushSync();
    }
    await untilTrue(
      () => result.container.querySelector('.markdown-editor-preview-content') !== null,
    );
    const wrapper = result.container.querySelector<HTMLElement>('.markdown-editor-wrapper');
    expect(wrapper?.dataset['mode']).toBe('preview');
    expect(result.container.textContent).toContain('Hello Ada');
    expect(result.container.querySelectorAll('.markdown-editor-preview')).toHaveLength(1);
    expect(result.container.querySelector<HTMLElement>('.markdown-editor-surface')?.hidden).toBe(
      true,
    );
    expect(result.warnings).toEqual([]);
  });
});
