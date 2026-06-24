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
const { default: JsonSchemaEditorImplementation } =
  await import('./json-schema-editor-impl.svelte');

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

  test('json-schema-editor-impl.svelte scopes form validation count to the form view', async () => {
    const source = await Bun.file(
      new URL('./json-schema-editor-impl.svelte', import.meta.url),
    ).text();

    expect(source).toContain('const toolbarValidationErrorCount = $derived');
    expect(source).toContain("view === 'form' ? localValidationErrorCount : 0");
    expect(source).toContain('localValidationErrorCount={toolbarValidationErrorCount}');
  });

  test('property-editor.svelte aggregates nested validation counts from every child editor path', async () => {
    const source = await Bun.file(new URL('./property-editor.svelte', import.meta.url)).text();

    expect(source).toContain('let childValidationCounts = $state<Record<string, number>>({})');
    expect(source).toContain("setChildValidationErrorCount('properties', count)");
    expect(source).toContain("setChildValidationErrorCount('items', count)");
    expect(source).toContain('{@const branchKey = compositionBranchKeys[keyword][branchIndex]}');
    expect(source).toContain('setChildValidationErrorCount(`${keyword}:${branchKey}`, count)');
    expect(source).toContain('setChildValidationErrorCount(`${keyword}:${removedBranchKey}`, 0)');
    expect(source).toContain('onvalidationerrorcount?.(0)');
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
   * The editor's shortcut router (see `json-schema-editor-impl.svelte`) keys off
   * `metaKey` on Mac and `ctrlKey` elsewhere, decided by its `detectMacPlatform()`
   * (userAgentData.platform first, then navigator.platform, only `/Mac/`). The test
   * mirrors that exact detection so it always fires the modifier the handler expects
   * — a mismatched heuristic would silently no-op the keydown and let the assertions
   * pass for the wrong reason.
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
    const textarea = screen.getByRole('textbox', { name: 'JSON' });
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

    // Derive the primary modifier with the EXACT logic the component's
    // detectMacPlatform() uses — prefer navigator.userAgentData.platform, fall
    // back to navigator.platform, and only `/Mac/` counts as Mac. Using a
    // different heuristic (e.g. reading navigator.platform alone, or treating iOS
    // as Mac) could disagree with the handler and fire the wrong modifier, making
    // the keydown silently no-op and the assertions pass for the wrong reason.
    const detectMacPlatform = (): boolean => {
      if (typeof navigator === 'undefined') return false;
      const modernPlatform = (navigator as Navigator & { userAgentData?: { platform?: string } })
        .userAgentData?.platform;
      if (typeof modernPlatform === 'string' && modernPlatform.length > 0) {
        return /Mac/.test(modernPlatform);
      }
      return /Mac/.test(navigator.platform);
    };
    const primaryModifier: { metaKey: true } | { ctrlKey: true } = detectMacPlatform()
      ? { metaKey: true }
      : { ctrlKey: true };

    // Fire from a genuinely focused, NON-EDITABLE control inside the region so the
    // keydown takes the real bubbling path to the region's handler. The handler
    // deliberately ignores shortcuts whose target is a text field (isEditableTarget
    // — so native undo wins while typing), so we focus the Undo toolbar button, a
    // focusable non-editable surface the shortcut is meant to act from.
    const focusTarget = undoButton as HTMLElement;
    focusTarget.focus();
    expect(region.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).toBe(focusTarget);

    // Keyboard call: undo shortcut bubbles to the editor undo handler.
    // The dual assertion (undo disabled AND redo enabled) cannot be satisfied by a
    // no-op keydown, which would leave redo disabled.
    await fireEvent.keyDown(document.activeElement as HTMLElement, {
      key: 'z',
      ...primaryModifier,
    });
    await flushEffects();
    expect(undoButton?.hasAttribute('disabled')).toBe(true);
    expect(redoButton?.hasAttribute('disabled')).toBe(false);

    // The undo disabled the button we were focused on, which can blur it. Re-focus
    // a STABLE enabled non-editable control (the now-enabled Redo button) so the redo
    // shortcut fires from a genuine in-region focus, not an ambiguous focus state.
    const redoFocusTarget = redoButton as HTMLElement;
    redoFocusTarget.focus();
    expect(region.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).toBe(redoFocusTarget);

    // Redo shortcut (Shift + primary modifier + z) redoes the same edit.
    await fireEvent.keyDown(document.activeElement as HTMLElement, {
      key: 'z',
      ...primaryModifier,
      shiftKey: true,
    });
    await flushEffects();
    expect(undoButton?.hasAttribute('disabled')).toBe(false);
    expect(redoButton?.hasAttribute('disabled')).toBe(true);
  });
});
