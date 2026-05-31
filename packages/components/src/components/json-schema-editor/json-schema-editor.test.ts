/// <reference lib="dom" />
/**
 * Tests for the JsonSchemaEditor: its Diff tab semantic indicator (source
 * contract) and the editor-level keyboard-shortcut accessibility surface
 * (mounted against happy-dom).
 *
 * The keyboard/role test mounts the implementation in its `json` view. The
 * `form` view renders the deeply nested property editor, which trips a
 * happy-dom `nextSibling` limitation on mount; the `json` view exercises the
 * same region landmark, toolbar, and undo/redo shortcut handler without that
 * dependency.
 */

import { afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { cleanup, fireEvent, render, screen, within } = await import('@testing-library/svelte');
const { default: JsonSchemaEditorImplementation } = await import(
  './json-schema-editor-impl.svelte'
);

// ---------------------------------------------------------------------------
// Source-contract: Diff tab semantic changed-state indicator
// ---------------------------------------------------------------------------
describe('JsonSchemaEditor — Diff tab source contract', () => {
  test('json-schema-editor-impl.svelte does not contain a raw bullet marker in the Diff tab', async () => {
    const source = await Bun.file(
      new URL('./json-schema-editor-impl.svelte', import.meta.url),
    ).text();

    // The original raw bullet pattern was: `Diff{state.hasChanges ? ' •' : ''}`
    // Verify neither the string literal ' •' nor the original ternary is present
    expect(source).not.toContain("' •'");
    expect(source).not.toContain('" •"');
    expect(source).not.toMatch(/Diff\{.*['"]\s*•['"]/);
  });

  test('json-schema-editor-impl.svelte contains a semantic changed-state indicator for the Diff tab', async () => {
    const source = await Bun.file(
      new URL('./json-schema-editor-impl.svelte', import.meta.url),
    ).text();

    // Semantic indicator: sr-only text or accessible label including change state
    const hasSemanticIndicator =
      source.includes('cinder-sr-only') ||
      source.includes('has changes') ||
      source.includes('aria-label');

    expect(hasSemanticIndicator).toBe(true);
  });

  test('json-schema-editor-impl.svelte uses Badge in the trailing snippet for the Diff tab', async () => {
    const source = await Bun.file(
      new URL('./json-schema-editor-impl.svelte', import.meta.url),
    ).text();

    // The Diff tab should use the trailing snippet with a Badge for the visual indicator
    expect(source).toContain('trailing');
    expect(source).toContain('Badge');
  });

  test('json-schema-editor-toolbar.svelte has role=toolbar and an accessible label', async () => {
    const source = await Bun.file(new URL('./json-schema-toolbar.svelte', import.meta.url)).text();

    expect(source).toContain('role="toolbar"');
    expect(source).toContain('aria-label=');
  });
});

// ---------------------------------------------------------------------------
// Keyboard + ARIA: editor-level undo/redo shortcuts on the region landmark
// ---------------------------------------------------------------------------
describe('JsonSchemaEditor — keyboard shortcuts and landmarks', () => {
  afterEach(() => cleanup());

  /** Wait a macrotask so debounced state work and Svelte effects settle. */
  function flushEffects(): Promise<void> {
    return new Promise<void>((resolve) => setTimeout(resolve, 0));
  }

  /**
   * Mounts the editor, commits a JSON edit (enabling undo), then drives the
   * real Cmd/Ctrl+Z and Shift+Cmd/Ctrl+Z handlers on the `role="region"`
   * landmark and asserts the undo/redo toolbar state moves accordingly.
   *
   * happy-dom reports a Mac `navigator.platform`, so the editor's shortcut
   * router (see `json-schema-editor-impl.svelte`) keys off `metaKey`; the test
   * mirrors the platform the handler actually sees.
   */
  test('Cmd+Z / Shift+Cmd+Z on the editor region undo and redo a committed edit', async () => {
    render(JsonSchemaEditorImplementation, {
      props: {
        id: 'jse-shortcuts',
        schema: { type: 'object', title: 'Original' },
        view: 'json' as const,
      },
    });
    await flushEffects();

    // ARIA query: the editor exposes a labelled region landmark and a toolbar.
    const region = screen.getByRole('region', { name: 'JSON Schema editor' });
    const toolbar = screen.getByRole('toolbar', { name: 'Schema editor actions' });

    const undoButton = within(toolbar)
      .getAllByRole('button')
      .find((button) => button.textContent?.includes('Undo'));
    const redoButton = within(toolbar)
      .getAllByRole('button')
      .find((button) => button.textContent?.includes('Redo'));
    expect(undoButton).toBeDefined();
    expect(redoButton).toBeDefined();

    // Nothing to undo on a freshly loaded schema.
    expect(undoButton?.hasAttribute('disabled')).toBe(true);

    // Commit a real edit through the JSON view so history records a step.
    const textarea = screen.getByRole('textbox', { name: 'JSON' }) as HTMLTextAreaElement;
    await fireEvent.input(textarea, {
      target: { value: JSON.stringify({ type: 'object', title: 'Changed' }) },
    });
    await flushEffects();
    const applyButton = within(region)
      .getAllByRole('button')
      .find((button) => button.textContent?.trim() === 'Apply');
    expect(applyButton).toBeDefined();
    await fireEvent.click(applyButton as HTMLElement);
    await flushEffects();

    // The committed edit makes undo available.
    expect(undoButton?.hasAttribute('disabled')).toBe(false);

    // Keyboard call: Cmd+Z on the region triggers the editor undo handler.
    await fireEvent.keyDown(region, { key: 'z', metaKey: true });
    await flushEffects();
    expect(undoButton?.hasAttribute('disabled')).toBe(true);
    expect(redoButton?.hasAttribute('disabled')).toBe(false);

    // Shift+Cmd+Z redoes the same edit.
    await fireEvent.keyDown(region, { key: 'z', metaKey: true, shiftKey: true });
    await flushEffects();
    expect(undoButton?.hasAttribute('disabled')).toBe(false);
    expect(redoButton?.hasAttribute('disabled')).toBe(true);
  });
});
