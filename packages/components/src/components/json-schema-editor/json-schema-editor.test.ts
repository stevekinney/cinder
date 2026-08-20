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
import type { JsonSchemaEditorChangeEvent } from './json-schema-editor-types.ts';

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

  test('json-schema-editor-toolbar.svelte has role=toolbar and an accessible label', async () => {
    const source = await Bun.file(new URL('./json-schema-toolbar.svelte', import.meta.url)).text();

    expect(source).toContain('role="toolbar"');
    expect(source).toContain('aria-label=');
  });

  test('toolbar actions are icon-only with accessible labels', async () => {
    const source = await Bun.file(new URL('./json-schema-toolbar.svelte', import.meta.url)).text();

    expect(source).toContain('iconOnly');
    expect(source).toContain('label="Undo"');
    expect(source).toContain('label="Redo"');
    expect(source).toContain('label="Revert"');
    expect(source).toContain('label="Copy JSON" iconOnly');
  });

  test('property editor uses Collapsible for every optional disclosure', async () => {
    const source = await Bun.file(new URL('./property-editor.svelte', import.meta.url)).text();
    const constraintsSource = await Bun.file(
      new URL('./property-editor-constraints.svelte', import.meta.url),
    ).text();
    const disclosureSource = `${source}\n${constraintsSource}`;

    expect(constraintsSource).toContain(
      "import Collapsible from '@lostgradient/cinder/collapsible'",
    );
    expect(constraintsSource).toContain("import Input from '@lostgradient/cinder/input'");
    expect(constraintsSource).not.toContain("from '../collapsible/collapsible.svelte'");
    expect(constraintsSource).not.toContain("from '../input/input.svelte'");
    expect(source).toContain("import Collapsible from '@lostgradient/cinder/collapsible'");
    expect(source).not.toContain("from '../collapsible/collapsible.svelte'");
    expect(disclosureSource).not.toContain('<details');
    expect(disclosureSource).not.toContain('<summary');
    expect(disclosureSource.match(/<Collapsible/g)?.length).toBe(3);
  });

  test('json-schema-editor-impl.svelte scopes form validation count to the form view', async () => {
    const source = await Bun.file(
      new URL('./json-schema-editor-impl.svelte', import.meta.url),
    ).text();

    expect(source).toContain('const toolbarValidationErrorCount = $derived');
    expect(source).toContain("view === 'form' ? localValidationErrorCount : 0");
    expect(source).toContain('localValidationErrorCount={toolbarValidationErrorCount}');
  });

  test('json-schema-editor-impl.svelte retains enum drafts through undo and redo', async () => {
    const source = await Bun.file(
      new URL('./json-schema-editor-impl.svelte', import.meta.url),
    ).text();

    const undoHandler = source.slice(
      source.indexOf('function handleUndo'),
      source.indexOf('function handleRedo'),
    );
    const redoHandler = source.slice(
      source.indexOf('function handleRedo'),
      source.indexOf('function handleRevert'),
    );
    expect(undoHandler).not.toContain('enumDrafts = {}');
    expect(redoHandler).not.toContain('enumDrafts = {}');
  });

  test('property-editor.svelte aggregates nested validation counts from every child editor path', async () => {
    const source = await Bun.file(new URL('./property-editor.svelte', import.meta.url)).text();

    expect(source).toContain('let childValidationCounts = $state<Record<string, number>>({})');
    expect(source).toContain("setChildValidationErrorCount('properties', count)");
    expect(source).toContain("setChildValidationErrorCount('items', count)");
    expect(source).toContain('{@const branchKey = compositionBranchKeys[keyword][branchIndex]}');
    expect(source).toContain('setChildValidationErrorCount(`${keyword}:${branchKey}`, count)');
    expect(source).toContain('setChildValidationErrorCount(`${keyword}:${removedBranchKey}`, 0)');
    expect(source).not.toContain('.toSpliced(');
    expect(source).toContain('onvalidationErrorcount?.(0)');
  });

  test('property-editor.svelte retains enum draft errors while collapsed', async () => {
    const source = await Bun.file(new URL('./property-editor.svelte', import.meta.url)).text();

    expect(source).toContain('const retainedDraftCount = $derived');
    expect(source).toContain('draftPath === `${path}/enum`');
    expect(source).toContain('Math.max(');
  });
});

// ---------------------------------------------------------------------------
// Mounted: Diff tab Badge indicator only appears once a change is committed
// ---------------------------------------------------------------------------
describe('JsonSchemaEditor — Diff tab Badge indicator', () => {
  afterEach(() => cleanup());

  /** Wait a macrotask so debounced state work and Svelte effects settle. */
  function flushEffects(): Promise<void> {
    return new Promise<void>((resolve) => setTimeout(resolve, 0));
  }

  test('renders a Badge in the Diff tab only after a change is committed', async () => {
    render(JsonSchemaEditorImplementation, {
      props: {
        id: 'jse-diff-badge',
        defaultSchema: { type: 'string' },
        view: 'json' as const,
      },
    });
    await flushEffects();

    const diffTab = screen.getByRole('tab', { name: /Diff/ });

    // Before any edit is committed, editorState.hasChanges is false — the
    // {#if editorState.hasChanges} branch around the Badge must not render it.
    expect(diffTab.querySelector('.cinder-badge')).toBeNull();

    // Commit a real edit through the JSON view (same sequence as the
    // 'Apply disables for an invalid draft...' test below).
    await fireEvent.click(screen.getByRole('button', { name: 'Edit JSON' }));
    const textarea = screen.getByRole('textbox', { name: 'JSON' });
    await fireEvent.input(textarea, {
      target: { value: JSON.stringify({ type: 'string', title: 'Changed' }) },
    });
    await flushEffects();
    const applyButton = screen
      .getAllByRole('button')
      .find((button) => button.textContent?.trim() === 'Apply');
    expect(applyButton).toBeDefined();
    await fireEvent.click(applyButton as HTMLElement);
    await flushEffects();

    await fireEvent.click(diffTab);
    await flushEffects();

    const badge = diffTab.querySelector('.cinder-badge');
    expect(badge).not.toBeNull();
    expect(badge?.textContent).toBe('●');
    expect(badge?.getAttribute('aria-hidden')).toBe('true');
  });

  test('renders the Diff badge and lines for a committed property reordering', async () => {
    render(JsonSchemaEditorImplementation, {
      props: {
        id: 'jse-reorder-diff-badge',
        defaultSchema: {
          type: 'object',
          properties: { first: { type: 'string' }, second: { type: 'number' } },
        },
        view: 'json' as const,
      },
    });
    await flushEffects();

    await fireEvent.click(screen.getByRole('button', { name: 'Edit JSON' }));
    const textarea = screen.getByRole('textbox', { name: 'JSON' });
    await fireEvent.input(textarea, {
      target: {
        value: JSON.stringify({
          type: 'object',
          properties: { second: { type: 'number' }, first: { type: 'string' } },
        }),
      },
    });
    await flushEffects();
    const applyButton = screen
      .getAllByRole('button')
      .find((button) => button.textContent?.trim() === 'Apply');
    await fireEvent.click(applyButton as HTMLElement);
    await flushEffects();

    const diffTab = screen.getByRole('tab', { name: /Diff/ });
    await fireEvent.click(diffTab);
    await flushEffects();

    expect(diffTab.querySelector('.cinder-badge')).not.toBeNull();
    expect(screen.getByRole('group', { name: 'JSON diff' })).not.toBeNull();
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
        defaultSchema: { type: 'object', title: 'Original' },
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
    await fireEvent.click(screen.getByRole('button', { name: 'Edit JSON' }));
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

// ---------------------------------------------------------------------------
// json-view.svelte: draft meta-schema check resets between drafts
// ---------------------------------------------------------------------------
describe('JsonSchemaEditor — JSON view draft validity', () => {
  afterEach(() => cleanup());

  function flushEffects(): Promise<void> {
    return new Promise<void>((resolve) => setTimeout(resolve, 0));
  }

  // Regression: json-view.svelte's draft meta-schema check runs async
  // (validateMetaSchema dynamically imports Ajv). It used to leave the
  // *previous* draft's result in place until the new one resolved — so
  // typing a valid draft, then quickly typing something invalid, could
  // report Apply as available (and show no error) for content that was
  // never actually checked. Reset-to-null while pending closes that
  // window; this asserts the final state is correct after a valid draft
  // is immediately followed by an invalid one.
  test('Apply disables for an invalid draft typed right after a valid one', async () => {
    render(JsonSchemaEditorImplementation, {
      props: {
        id: 'jse-draft-validity',
        defaultSchema: { type: 'string' },
        view: 'json' as const,
      },
    });
    await flushEffects();

    await fireEvent.click(screen.getByRole('button', { name: 'Edit JSON' }));
    const textarea = screen.getByRole('textbox', { name: 'JSON' });

    await fireEvent.input(textarea, { target: { value: '{"type":"number"}' } });
    await flushEffects();
    const applyButton = screen
      .getAllByRole('button')
      .find((button) => button.textContent?.trim() === 'Apply') as HTMLElement;
    expect(applyButton.hasAttribute('disabled')).toBe(false);

    await fireEvent.input(textarea, { target: { value: '{"type":"not-a-real-type"}' } });
    await flushEffects();
    expect(applyButton.hasAttribute('disabled')).toBe(true);
  });
});

describe('JsonSchemaEditor — controlled and uncontrolled schema inputs', () => {
  afterEach(() => cleanup());

  function flushEffects(): Promise<void> {
    return new Promise<void>((resolve) => setTimeout(resolve, 0));
  }

  test('uses defaultSchema as an uncontrolled seed and exposes an editable textarea only after Edit JSON', async () => {
    render(JsonSchemaEditorImplementation, {
      props: {
        id: 'jse-uncontrolled',
        defaultSchema: { type: 'string' },
        view: 'json' as const,
      },
    });
    await flushEffects();

    const region = screen.getByRole('region', { name: 'JSON Schema editor' });
    expect(region.querySelector('.cinder-code-block')?.textContent).toContain('"type": "string"');
    expect(screen.queryByRole('textbox', { name: 'JSON' })).toBeNull();

    await fireEvent.click(screen.getByRole('button', { name: 'Edit JSON' }));
    const textarea = screen.getByRole('textbox', { name: 'JSON' });
    expect((textarea as HTMLTextAreaElement).value).toBe('{\n  "type": "string"\n}');
    expect(document.activeElement).toBe(textarea);
  });

  test('emits controlled edits and synchronizes later parent schema updates', async () => {
    const changes: string[] = [];
    const observedChanges: string[] = [];
    const { container, rerender } = render(JsonSchemaEditorImplementation, {
      props: {
        id: 'jse-controlled',
        schema: { type: 'string' },
        view: 'json' as const,
        onValueChangeRequest: (event: JsonSchemaEditorChangeEvent) =>
          changes.push(event.jsonString),
        onSchemaChange: (event: JsonSchemaEditorChangeEvent) =>
          observedChanges.push(event.jsonString),
      },
    });
    await flushEffects();
    const editor = within(container);

    await fireEvent.click(editor.getByRole('button', { name: 'Edit JSON' }));
    const textarea = editor.getByRole('textbox', { name: 'JSON' });
    await fireEvent.input(textarea, { target: { value: '{"type":"number"}' } });
    await flushEffects();
    await fireEvent.click(editor.getByRole('button', { name: 'Apply' }));
    await flushEffects();

    expect(changes).toEqual(['{\n  "type": "number"\n}']);
    expect(observedChanges).toEqual([]);

    await rerender({
      id: 'jse-controlled',
      schema: { type: 'number' },
      view: 'json' as const,
      onValueChangeRequest: (event: JsonSchemaEditorChangeEvent) => changes.push(event.jsonString),
      onSchemaChange: (event: JsonSchemaEditorChangeEvent) =>
        observedChanges.push(event.jsonString),
    });
    await flushEffects();

    expect(observedChanges).toEqual(['{\n  "type": "number"\n}']);
    expect(editor.getAllByRole('button', { name: 'Edit JSON' }).at(-1)).toBeDefined();

    await rerender({
      id: 'jse-controlled',
      schema: { type: 'boolean' },
      view: 'json' as const,
      onValueChangeRequest: (event: JsonSchemaEditorChangeEvent) => changes.push(event.jsonString),
      onSchemaChange: (event: JsonSchemaEditorChangeEvent) =>
        observedChanges.push(event.jsonString),
    });
    await flushEffects();

    const region = screen.getByRole('region', { name: 'JSON Schema editor' });
    expect(region.querySelector('.cinder-code-block')?.textContent).toContain('"type": "boolean"');
  });

  test('preserves a dirty JSON draft when a controlled parent recreates its unchanged schema', async () => {
    const onValueChangeRequest = (_event: JsonSchemaEditorChangeEvent) => undefined;
    const { rerender } = render(JsonSchemaEditorImplementation, {
      props: {
        id: 'jse-controlled-draft',
        schema: { type: 'string' },
        view: 'json' as const,
        onValueChangeRequest,
      },
    });
    await flushEffects();

    await fireEvent.click(screen.getByRole('button', { name: 'Edit JSON' }));
    await fireEvent.input(screen.getByRole('textbox', { name: 'JSON' }), {
      target: { value: '{"type":"number"}' },
    });
    await flushEffects();

    await rerender({
      id: 'jse-controlled-draft',
      schema: { type: 'string' },
      view: 'diff' as const,
      onValueChangeRequest,
    });
    await flushEffects();

    await rerender({
      id: 'jse-controlled-draft',
      schema: { type: 'string' },
      view: 'json' as const,
      onValueChangeRequest,
    });
    await flushEffects();

    expect(
      document.querySelector<HTMLTextAreaElement>('textarea.cinder-jse-json-view__textarea')?.value,
    ).toBe('{"type":"number"}');
  });

  test('settles a controlled rejection that restores the previous schema', async () => {
    const changes: string[] = [];
    const { container, rerender } = render(JsonSchemaEditorImplementation, {
      props: {
        id: 'jse-controlled-rejection',
        schema: { type: 'string' },
        view: 'json' as const,
        onValueChangeRequest: (event: JsonSchemaEditorChangeEvent) =>
          changes.push(event.jsonString),
      },
    });
    await flushEffects();
    const editor = within(container);

    await fireEvent.click(editor.getByRole('button', { name: 'Edit JSON' }));
    await fireEvent.input(editor.getByRole('textbox', { name: 'JSON' }), {
      target: { value: '{"type":"number"}' },
    });
    await flushEffects();
    await fireEvent.click(editor.getByRole('button', { name: 'Apply' }));
    await flushEffects();

    await rerender({
      id: 'jse-controlled-rejection',
      schema: { type: 'string' },
      view: 'json' as const,
      onValueChangeRequest: (event: JsonSchemaEditorChangeEvent) => changes.push(event.jsonString),
    });
    await flushEffects();

    expect(changes).toEqual(['{\n  "type": "number"\n}']);
    expect(editor.getAllByRole('button', { name: 'Edit JSON' }).at(-1)).toBeDefined();
  });
});
