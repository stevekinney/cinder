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
import type { JsonSchemaEditorChangeEvent, JsonSchemaValue } from './json-schema-editor-types.ts';

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

  function latestJsonButton(
    container: HTMLElement,
    label: 'Edit JSON' | 'Apply',
  ): HTMLButtonElement {
    const button = Array.from(container.querySelectorAll<HTMLButtonElement>('button'))
      .filter((candidate) => candidate.textContent?.trim() === label)
      .at(-1);
    if (button === undefined) throw new Error(`Expected the latest ${label} button.`);
    return button;
  }

  function latestJsonTextarea(container: HTMLElement): HTMLTextAreaElement {
    const textareas = container.querySelectorAll<HTMLTextAreaElement>(
      '.cinder-jse-json-view__textarea',
    );
    const textarea = textareas[textareas.length - 1];
    if (textarea === undefined) throw new Error('Expected the latest JSON textarea.');
    return textarea;
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

  test('keeps the textarea focused after discarding a malformed source draft', async () => {
    render(JsonSchemaEditorImplementation, {
      props: {
        id: 'jse-malformed-discard-focus',
        schema: '{not-valid',
        view: 'json' as const,
      },
    });
    await flushEffects();

    const textarea = screen.getAllByRole<HTMLTextAreaElement>('textbox').at(-1);
    if (textarea === undefined) throw new Error('Expected a JSON textarea for malformed source.');
    await fireEvent.input(textarea, { target: { value: '{"type":"string"}' } });
    await flushEffects();
    await fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    await flushEffects();

    expect(document.activeElement).toBe(textarea);
  });

  test('treats schema without a request handler as a locally managed seed', async () => {
    const { rerender } = render(JsonSchemaEditorImplementation, {
      props: {
        id: 'jse-schema-seed',
        schema: { type: 'string' },
        view: 'json' as const,
      },
    });
    await flushEffects();

    await fireEvent.click(screen.getByRole('button', { name: 'Edit JSON' }));
    await fireEvent.input(screen.getByRole('textbox', { name: 'JSON' }), {
      target: { value: '{"type":"number"}' },
    });
    await flushEffects();
    await fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    await flushEffects();

    expect(screen.getByRole('region', { name: 'JSON Schema editor' }).textContent).toContain(
      '"type": "number"',
    );

    await rerender({
      id: 'jse-schema-seed',
      schema: { type: 'string' },
      view: 'json' as const,
      onValueChangeRequest: () => undefined,
    });
    await flushEffects();

    expect(screen.getByRole('region', { name: 'JSON Schema editor' }).textContent).toContain(
      '"type": "string"',
    );
  });

  test('emits controlled edits and synchronizes later parent schema updates', async () => {
    const changes: string[] = [];
    const observedChanges: string[] = [];
    const { container, rerender } = render(JsonSchemaEditorImplementation, {
      props: {
        id: 'jse-controlled',
        schema: { type: 'string' },
        view: 'json' as const,
        onValueChangeRequest: (event: JsonSchemaEditorChangeEvent) => {
          changes.push(event.jsonString);
        },
        onSchemaChange: (event: JsonSchemaEditorChangeEvent) =>
          observedChanges.push(event.jsonString),
      },
    });
    await flushEffects();
    const editor = within(container);

    await fireEvent.click(
      editor.getAllByRole('button', { name: 'Edit JSON' }).at(-1) as HTMLElement,
    );
    const textarea = editor.getByRole('textbox', { name: 'JSON' });
    await fireEvent.input(textarea, { target: { value: '{"type":"number"}' } });
    await flushEffects();
    await fireEvent.click(editor.getAllByRole('button', { name: 'Apply' }).at(-1) as HTMLElement);
    await flushEffects();

    expect(changes).toEqual(['{\n  "type": "number"\n}']);
    expect(observedChanges).toEqual([]);

    await rerender({
      id: 'jse-controlled',
      schema: { type: 'number' },
      view: 'json' as const,
      onValueChangeRequest: (event: JsonSchemaEditorChangeEvent) => {
        changes.push(event.jsonString);
      },
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
      onValueChangeRequest: (event: JsonSchemaEditorChangeEvent) => {
        changes.push(event.jsonString);
      },
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
    const observedChanges: JsonSchemaEditorChangeEvent[] = [];
    const { container } = render(JsonSchemaEditorImplementation, {
      props: {
        id: 'jse-controlled-rejection',
        schema: { type: 'string' },
        view: 'json' as const,
        onValueChangeRequest: (event: JsonSchemaEditorChangeEvent) => {
          changes.push(event.jsonString);
          return { type: 'string' };
        },
        onSchemaChange: (event: JsonSchemaEditorChangeEvent) => observedChanges.push(event),
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

    expect(changes).toEqual(['{\n  "type": "number"\n}']);
    expect(observedChanges).toEqual([]);
    expect(editor.getAllByRole('button', { name: 'Edit JSON' }).at(-1)).toBeDefined();
  });

  test('unlocks controlled editing after a settlement promise rejects', async () => {
    const changes: string[] = [];
    let rejectSettlement: (reason?: unknown) => void = () => {};
    const rejectedSettlement = new Promise<never>((_resolve, reject) => {
      rejectSettlement = reject;
    });
    const { container } = render(JsonSchemaEditorImplementation, {
      props: {
        id: 'jse-controlled-settlement-rejection',
        schema: { type: 'string' },
        view: 'json' as const,
        onValueChangeRequest: (event: JsonSchemaEditorChangeEvent) => {
          changes.push(event.jsonString);
          return rejectedSettlement;
        },
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

    rejectSettlement(new Error('Server rejected the schema.'));
    await flushEffects();
    await flushEffects();

    const editButton = editor.getAllByRole('button', { name: 'Edit JSON' }).at(-1);
    if (editButton === undefined) throw new Error('Expected JSON editing to be restored.');
    await fireEvent.click(editButton);
    const textareas = container.querySelectorAll<HTMLTextAreaElement>(
      '.cinder-jse-json-view__textarea',
    );
    const textarea = textareas[textareas.length - 1];
    if (textarea === undefined) throw new Error('Expected an active JSON textarea.');
    await fireEvent.input(textarea, {
      target: { value: '{"type":"boolean"}' },
    });
    await flushEffects();
    const applyButton = editor.getAllByRole('button', { name: 'Apply' }).at(-1);
    if (applyButton === undefined) throw new Error('Expected the JSON apply action.');
    await fireEvent.click(applyButton);
    await flushEffects();

    expect(changes).toEqual(['{\n  "type": "number"\n}', '{\n  "type": "boolean"\n}']);
  });

  test('uses a returned settlement as the authority after a later rejection', async () => {
    const requests: string[] = [];
    const { container } = render(JsonSchemaEditorImplementation, {
      props: {
        id: 'jse-controlled-authority',
        schema: { type: 'string' },
        view: 'json' as const,
        onValueChangeRequest: (event: JsonSchemaEditorChangeEvent) => {
          requests.push(event.jsonString);
          return requests.length === 1 ? { type: 'number' } : Promise.reject(new Error('Rejected'));
        },
      },
    });
    await flushEffects();
    const editor = within(container);

    await fireEvent.click(editor.getByRole('button', { name: 'Edit JSON' }));
    await fireEvent.input(editor.getByRole('textbox', { name: 'JSON' }), {
      target: { value: '{"type":"number"}' },
    });
    await fireEvent.click(editor.getByRole('button', { name: 'Apply' }));
    await flushEffects();

    await fireEvent.click(latestJsonButton(container, 'Edit JSON'));
    await fireEvent.input(latestJsonTextarea(container), {
      target: { value: '{"type":"boolean"}' },
    });
    await fireEvent.click(latestJsonButton(container, 'Apply'));
    await flushEffects();
    await flushEffects();

    expect(editor.getByRole('region', { name: 'JSON Schema editor' }).textContent).toContain(
      '"type": "number"',
    );
  });

  test('synchronizes a later parent restoration after a returned settlement', async () => {
    const { container, rerender } = render(JsonSchemaEditorImplementation, {
      props: {
        id: 'jse-controlled-returned-restoration',
        schema: { type: 'string' },
        view: 'json' as const,
        onValueChangeRequest: () => ({ type: 'number' }),
      },
    });
    await flushEffects();

    await fireEvent.click(latestJsonButton(container, 'Edit JSON'));
    await fireEvent.input(latestJsonTextarea(container), {
      target: { value: '{"type":"number"}' },
    });
    await fireEvent.click(latestJsonButton(container, 'Apply'));
    await flushEffects();

    await rerender({
      id: 'jse-controlled-returned-restoration',
      schema: { type: 'string' },
      view: 'json' as const,
      onValueChangeRequest: () => ({ type: 'number' }),
    });
    await flushEffects();

    expect(container.textContent).toContain('"type": "string"');
  });

  test('settles a second request when the parent rejects it with returned authority', async () => {
    const requests: string[] = [];
    const { container, rerender } = render(JsonSchemaEditorImplementation, {
      props: {
        id: 'jse-controlled-returned-second-rejection',
        schema: { type: 'string' },
        view: 'json' as const,
        onValueChangeRequest: (event: JsonSchemaEditorChangeEvent) => {
          requests.push(event.jsonString);
          return requests.length === 1 ? { type: 'number' } : undefined;
        },
      },
    });
    await flushEffects();

    await fireEvent.click(latestJsonButton(container, 'Edit JSON'));
    await fireEvent.input(latestJsonTextarea(container), {
      target: { value: '{"type":"number"}' },
    });
    await fireEvent.click(latestJsonButton(container, 'Apply'));
    await flushEffects();

    await fireEvent.click(latestJsonButton(container, 'Edit JSON'));
    await fireEvent.input(latestJsonTextarea(container), {
      target: { value: '{"type":"boolean"}' },
    });
    await fireEvent.click(latestJsonButton(container, 'Apply'));
    await rerender({
      id: 'jse-controlled-returned-second-rejection',
      schema: { type: 'number' },
      view: 'json' as const,
      onValueChangeRequest: (event: JsonSchemaEditorChangeEvent) => {
        requests.push(event.jsonString);
        return undefined;
      },
    });
    await flushEffects();

    await fireEvent.click(latestJsonButton(container, 'Edit JSON'));
    await fireEvent.input(latestJsonTextarea(container), {
      target: { value: '{"type":"string"}' },
    });
    await fireEvent.click(latestJsonButton(container, 'Apply'));

    expect(requests).toEqual([
      '{\n  "type": "number"\n}',
      '{\n  "type": "boolean"\n}',
      '{\n  "type": "string"\n}',
    ]);
  });

  test('preserves accepted history when returned authority rejects a later proposal', async () => {
    let requestCount = 0;
    const { container } = render(JsonSchemaEditorImplementation, {
      props: {
        id: 'jse-controlled-rejected-history',
        schema: { type: 'string' },
        view: 'json' as const,
        onValueChangeRequest: () => {
          requestCount += 1;
          return { type: 'number' };
        },
      },
    });
    await flushEffects();

    await fireEvent.click(latestJsonButton(container, 'Edit JSON'));
    await fireEvent.input(latestJsonTextarea(container), {
      target: { value: '{"type":"number"}' },
    });
    await fireEvent.click(latestJsonButton(container, 'Apply'));
    await flushEffects();

    await fireEvent.click(latestJsonButton(container, 'Edit JSON'));
    await fireEvent.input(latestJsonTextarea(container), {
      target: { value: '{"type":"boolean"}' },
    });
    await fireEvent.click(latestJsonButton(container, 'Apply'));
    await flushEffects();

    expect(requestCount).toBe(2);
    expect(container.textContent).toContain('"type": "number"');
    expect(within(container).getByRole('button', { name: 'Undo' }).hasAttribute('disabled')).toBe(
      false,
    );
  });

  test('preserves accepted history when a controlled undo is rejected', async () => {
    const { container } = render(JsonSchemaEditorImplementation, {
      props: {
        id: 'jse-controlled-rejected-undo',
        schema: { type: 'string' },
        view: 'json' as const,
        onValueChangeRequest: () => ({ type: 'number' }),
      },
    });
    await flushEffects();

    await fireEvent.click(latestJsonButton(container, 'Edit JSON'));
    await fireEvent.input(latestJsonTextarea(container), {
      target: { value: '{"type":"number"}' },
    });
    await fireEvent.click(latestJsonButton(container, 'Apply'));
    await flushEffects();

    await fireEvent.click(within(container).getByRole('button', { name: 'Undo' }));
    await flushEffects();
    await flushEffects();

    expect(container.textContent).toContain('"type": "number"');
    expect(within(container).getByRole('button', { name: 'Undo' }).hasAttribute('disabled')).toBe(
      false,
    );
  });

  test('preserves the pending controlled commit when a later edit is blocked', async () => {
    const requests: string[] = [];
    const pendingSettlement = new Promise<never>(() => {});
    const { container } = render(JsonSchemaEditorImplementation, {
      props: {
        id: 'jse-controlled-pending-authority',
        schema: { type: 'string' },
        view: 'json' as const,
        onValueChangeRequest: (event: JsonSchemaEditorChangeEvent) => {
          requests.push(event.jsonString);
          return requests.length === 1 ? { type: 'number' } : pendingSettlement;
        },
      },
    });
    await flushEffects();

    for (const type of ['number', 'boolean', 'string']) {
      await fireEvent.click(latestJsonButton(container, 'Edit JSON'));
      await fireEvent.input(latestJsonTextarea(container), {
        target: { value: `{"type":"${type}"}` },
      });
      await fireEvent.click(latestJsonButton(container, 'Apply'));
      await flushEffects();
    }

    expect(requests).toEqual(['{\n  "type": "number"\n}', '{\n  "type": "boolean"\n}']);
    expect(container.textContent).toContain('"type": "boolean"');
    expect(within(container).getByRole('button', { name: 'Undo' }).hasAttribute('disabled')).toBe(
      false,
    );
  });

  test('moves focus to Edit JSON when controlled sync closes a remounted dirty draft', async () => {
    const onValueChangeRequest = () => undefined;
    const { container, rerender } = render(JsonSchemaEditorImplementation, {
      props: {
        id: 'jse-controlled-sync-focus',
        schema: { type: 'string' },
        view: 'json' as const,
        onValueChangeRequest,
      },
    });
    await flushEffects();

    await fireEvent.click(latestJsonButton(container, 'Edit JSON'));
    await fireEvent.input(latestJsonTextarea(container), {
      target: { value: '{"type":"number"}' },
    });
    await fireEvent.click(within(container).getByRole('tab', { name: /Diff/ }));
    await fireEvent.click(within(container).getByRole('tab', { name: /JSON/ }));
    await flushEffects();

    const textarea = latestJsonTextarea(container);
    textarea.focus();
    await rerender({
      id: 'jse-controlled-sync-focus',
      schema: { type: 'boolean' },
      view: 'json' as const,
      onValueChangeRequest,
    });
    await flushEffects();
    await flushEffects();

    expect(document.activeElement).toBe(
      container.querySelector<HTMLButtonElement>('#jse-controlled-sync-focus-json-edit-json'),
    );
  });

  test('moves focus to Done when synchronization replaces a focused Discard action', async () => {
    const onValueChangeRequest = () => undefined;
    const { container, rerender } = render(JsonSchemaEditorImplementation, {
      props: {
        id: 'jse-controlled-discard-focus',
        schema: { type: 'string' },
        view: 'json' as const,
        onValueChangeRequest,
      },
    });
    await flushEffects();

    await fireEvent.click(latestJsonButton(container, 'Edit JSON'));
    await fireEvent.input(latestJsonTextarea(container), {
      target: { value: '{' },
    });
    const discard = within(container).getByRole('button', { name: 'Discard' });
    discard.focus();

    await rerender({
      id: 'jse-controlled-discard-focus',
      schema: { type: 'boolean' },
      view: 'json' as const,
      onValueChangeRequest,
    });
    await flushEffects();
    await flushEffects();

    expect(container.querySelector('#jse-controlled-discard-focus-json-done-json')).not.toBeNull();
    expect(document.activeElement?.id).toBe('jse-controlled-discard-focus-json-done-json');
  });

  test('notifies observers with a transformed returned settlement', async () => {
    const observedChanges: JsonSchemaEditorChangeEvent[] = [];
    render(JsonSchemaEditorImplementation, {
      props: {
        id: 'jse-controlled-replacement-observer',
        schema: { type: 'string' },
        view: 'json' as const,
        onValueChangeRequest: () => ({ type: 'number' }),
        onSchemaChange: (event: JsonSchemaEditorChangeEvent) => observedChanges.push(event),
      },
    });
    await flushEffects();

    await fireEvent.click(screen.getByRole('button', { name: 'Edit JSON' }));
    await fireEvent.input(screen.getByRole('textbox', { name: 'JSON' }), {
      target: { value: '{"type":"boolean"}' },
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    await flushEffects();

    expect(observedChanges).toEqual([
      { schema: { type: 'number' }, jsonString: '{\n  "type": "number"\n}' },
    ]);
  });

  test('notifies observers when a parent settles a request with a transformed schema', async () => {
    const observedChanges: JsonSchemaEditorChangeEvent[] = [];
    const { rerender } = render(JsonSchemaEditorImplementation, {
      props: {
        id: 'jse-controlled-parent-replacement-observer',
        schema: { type: 'string' },
        view: 'json' as const,
        onValueChangeRequest: () => undefined,
        onSchemaChange: (event: JsonSchemaEditorChangeEvent) => observedChanges.push(event),
      },
    });
    await flushEffects();

    await fireEvent.click(screen.getByRole('button', { name: 'Edit JSON' }));
    await fireEvent.input(screen.getByRole('textbox', { name: 'JSON' }), {
      target: { value: '{"type":"boolean"}' },
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    await rerender({
      id: 'jse-controlled-parent-replacement-observer',
      schema: { type: 'number' },
      view: 'json' as const,
      onValueChangeRequest: () => undefined,
      onSchemaChange: (event: JsonSchemaEditorChangeEvent) => observedChanges.push(event),
    });
    await flushEffects();

    expect(observedChanges).toEqual([
      { schema: { type: 'number' }, jsonString: '{\n  "type": "number"\n}' },
    ]);
  });

  test('notifies observers when a parent mutates its schema object into a transformed settlement', async () => {
    const schema: JsonSchemaValue = { type: 'string' };
    const observedChanges: JsonSchemaEditorChangeEvent[] = [];
    const { rerender } = render(JsonSchemaEditorImplementation, {
      props: {
        id: 'jse-controlled-in-place-replacement-observer',
        schema,
        view: 'json' as const,
        onValueChangeRequest: () => undefined,
        onSchemaChange: (event: JsonSchemaEditorChangeEvent) => observedChanges.push(event),
      },
    });
    await flushEffects();

    await fireEvent.click(screen.getByRole('button', { name: 'Edit JSON' }));
    await fireEvent.input(screen.getByRole('textbox', { name: 'JSON' }), {
      target: { value: '{"type":"boolean"}' },
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    if (typeof schema === 'object' && schema !== null) schema.type = 'number';
    await rerender({
      id: 'jse-controlled-in-place-replacement-observer',
      schema,
      view: 'json' as const,
      onValueChangeRequest: () => undefined,
      onSchemaChange: (event: JsonSchemaEditorChangeEvent) => observedChanges.push(event),
    });
    await flushEffects();

    expect(observedChanges).toEqual([
      { schema: { type: 'number' }, jsonString: '{\n  "type": "number"\n}' },
    ]);
  });

  test('disables malformed-baseline reverts in controlled mode', async () => {
    const requests: JsonSchemaEditorChangeEvent[] = [];
    const { container } = render(JsonSchemaEditorImplementation, {
      props: {
        id: 'jse-controlled-malformed-revert',
        schema: { type: 'string' },
        original: '{not-valid',
        view: 'json' as const,
        onValueChangeRequest: (event: JsonSchemaEditorChangeEvent) => {
          requests.push(event);
          return { type: 'number' };
        },
      },
    });
    await flushEffects();

    await fireEvent.click(latestJsonButton(container, 'Edit JSON'));
    await fireEvent.input(latestJsonTextarea(container), {
      target: { value: '{"type":"number"}' },
    });
    await fireEvent.click(latestJsonButton(container, 'Apply'));
    await flushEffects();

    expect(within(container).getByRole('button', { name: 'Revert' }).hasAttribute('disabled')).toBe(
      true,
    );
    expect(requests).toHaveLength(1);
  });

  test('moves focus to the JSON tab when readonly closes a clean editing session', async () => {
    const { container, rerender } = render(JsonSchemaEditorImplementation, {
      props: {
        id: 'jse-readonly-finish-focus',
        schema: { type: 'string' },
        view: 'json' as const,
      },
    });
    await flushEffects();

    await fireEvent.click(latestJsonButton(container, 'Edit JSON'));
    const textarea = latestJsonTextarea(container);
    expect(document.activeElement).toBe(textarea);

    await rerender({
      id: 'jse-readonly-finish-focus',
      schema: { type: 'string' },
      view: 'json' as const,
      readonly: true,
    });
    await flushEffects();
    expect(latestJsonTextarea(container).readOnly).toBe(true);
    await fireEvent.click(within(container).getByRole('button', { name: 'Done' }));
    await flushEffects();

    expect(document.activeElement).toBe(within(container).getByRole('tab', { name: 'JSON' }));
  });

  test('rejects an invalid fulfilled settlement so another edit can be requested', async () => {
    const requests: string[] = [];
    const { container } = render(JsonSchemaEditorImplementation, {
      props: {
        id: 'jse-controlled-invalid-settlement',
        schema: { type: 'string' },
        view: 'json' as const,
        onValueChangeRequest: (event: JsonSchemaEditorChangeEvent) => {
          requests.push(event.jsonString);
          return Promise.resolve(undefined);
        },
      },
    });
    await flushEffects();

    for (const type of ['number', 'boolean']) {
      await fireEvent.click(latestJsonButton(container, 'Edit JSON'));
      await fireEvent.input(latestJsonTextarea(container), {
        target: { value: `{"type":"${type}"}` },
      });
      await fireEvent.click(latestJsonButton(container, 'Apply'));
      await flushEffects();
      await flushEffects();
    }

    expect(requests).toEqual(['{\n  "type": "number"\n}', '{\n  "type": "boolean"\n}']);
  });

  test('rejects a non-normalizable fulfilled settlement so another edit can be requested', async () => {
    const requests: string[] = [];
    const { container } = render(JsonSchemaEditorImplementation, {
      props: {
        id: 'jse-controlled-non-normalizable-settlement',
        schema: { type: 'string' },
        view: 'json' as const,
        onValueChangeRequest: (event: JsonSchemaEditorChangeEvent) => {
          requests.push(event.jsonString);
          return { default: undefined };
        },
      },
    });
    await flushEffects();

    for (const type of ['number', 'boolean']) {
      await fireEvent.click(latestJsonButton(container, 'Edit JSON'));
      await fireEvent.input(latestJsonTextarea(container), {
        target: { value: `{"type":"${type}"}` },
      });
      await fireEvent.click(latestJsonButton(container, 'Apply'));
      await flushEffects();
      await flushEffects();
    }

    expect(requests).toEqual(['{\n  "type": "number"\n}', '{\n  "type": "boolean"\n}']);
    expect(container.textContent).toContain('"type": "string"');
  });

  test('does not settle a pending request after unmount', async () => {
    let resolveSettlement: (value: JsonSchemaValue) => void = () => {};
    const settlement = new Promise<JsonSchemaValue>((resolve) => {
      resolveSettlement = resolve;
    });
    const observedChanges: JsonSchemaEditorChangeEvent[] = [];
    const { unmount } = render(JsonSchemaEditorImplementation, {
      props: {
        id: 'jse-controlled-unmount',
        schema: { type: 'string' },
        view: 'json' as const,
        onValueChangeRequest: () => settlement,
        onSchemaChange: (event: JsonSchemaEditorChangeEvent) => observedChanges.push(event),
      },
    });
    await flushEffects();

    await fireEvent.click(screen.getByRole('button', { name: 'Edit JSON' }));
    await fireEvent.input(screen.getByRole('textbox', { name: 'JSON' }), {
      target: { value: '{"type":"number"}' },
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    unmount();
    resolveSettlement({ type: 'number' });
    await flushEffects();
    await flushEffects();

    expect(observedChanges).toEqual([]);
  });
});
