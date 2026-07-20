/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';
import { tick } from 'svelte';

import type { EditorState } from './json-schema-editor-state.types.ts';
import type { JsonSchemaDraft, JsonSchemaValidationResult } from './json-schema-editor-types.ts';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { cleanup, render } = await import('@testing-library/svelte');
const { default: JsonSchemaToolbar } = await import('./json-schema-toolbar.svelte');

// @testing-library/svelte v5's auto-cleanup does not register under bun:test (no
// global afterEach), so unmount every rendered toolbar after each test. Without
// this the mounted toolbars leak into the shared happy-dom document.body and
// sibling files (e.g. json-schema-editor.test.ts) see duplicate elements.
afterEach(() => cleanup());

/** Minimal fake EditorState for toolbar rendering. */
function makeFakeState(
  overrides: Partial<{
    canUndo: boolean;
    canRedo: boolean;
    hasChanges: boolean;
    readonly: boolean;
    copyValue: string;
    validationStatus: 'valid' | 'invalid' | 'pending';
    activeDraft: JsonSchemaDraft;
    validationResult: JsonSchemaValidationResult;
  }> = {},
): EditorState {
  const defaults = {
    canUndo: false,
    canRedo: false,
    hasChanges: false,
    readonly: false,
    copyValue: '{}',
    validationStatus: 'valid' as const,
    activeDraft: 'draft-07' as JsonSchemaDraft,
    validationResult: {
      status: 'valid',
      valid: true,
      errors: [],
      compilable: null,
    } as JsonSchemaValidationResult,
  };
  const merged = { ...defaults, ...overrides };

  return {
    get canUndo() {
      return merged.canUndo;
    },
    get canRedo() {
      return merged.canRedo;
    },
    get hasChanges() {
      return merged.hasChanges;
    },
    get readonly() {
      return merged.readonly;
    },
    get copyValue() {
      return merged.copyValue;
    },
    get validationStatus() {
      return merged.validationStatus;
    },
    get activeDraft(): JsonSchemaDraft {
      return merged.activeDraft;
    },
    get validationResult(): JsonSchemaValidationResult {
      return merged.validationResult;
    },
    // Unused properties required by the EditorState type — stubs only
    get view() {
      return 'form' as const;
    },
    set view(_v) {},
    get originalRawText() {
      return '';
    },
    get originalCanonicalText() {
      return '';
    },
    get originalSchema() {
      return null;
    },
    get originalLoadError() {
      return null;
    },
    get committedSchema() {
      return null;
    },
    get committedCanonicalText() {
      return '';
    },
    get jsonDraftText() {
      return '';
    },
    get jsonDraftIsDirty() {
      return false;
    },
    get isFormEditable() {
      return false;
    },
    get diffOriginal() {
      return '';
    },
    get diffCurrent() {
      return '';
    },
    setView() {},
    setReadonly() {},
    setDraftOverride() {},
    async applyJsonDraft() {
      return false;
    },
    updateJsonDraftText() {},
    updateFormProperty() {},
    undo() {
      return undefined;
    },
    redo() {
      return undefined;
    },
    revert() {},
    reload() {},
    destroy() {},
  } as unknown as EditorState;
}

// ---------------------------------------------------------------------------
// Helper: collect enabled action buttons from the right toolbar slot
// ---------------------------------------------------------------------------
function getActionButtons(container: HTMLElement): HTMLButtonElement[] {
  return Array.from(
    container.querySelectorAll<HTMLButtonElement>(
      '.cinder-jse-toolbar__right button:not(:disabled)',
    ),
  );
}

function getAllRightButtons(container: HTMLElement): HTMLButtonElement[] {
  return Array.from(
    container.querySelectorAll<HTMLButtonElement>('.cinder-jse-toolbar__right button'),
  );
}

// ---------------------------------------------------------------------------
// Toolbar ARIA structure
// ---------------------------------------------------------------------------
describe('JsonSchemaToolbar — ARIA structure', () => {
  test('root element has role="toolbar"', () => {
    const { container } = render(JsonSchemaToolbar, {
      props: { state: makeFakeState() },
    });
    const toolbar = container.querySelector('.cinder-jse-toolbar');
    expect(toolbar?.getAttribute('role')).toBe('toolbar');
  });

  test('root element has an accessible label', () => {
    const { container } = render(JsonSchemaToolbar, {
      props: { state: makeFakeState() },
    });
    const toolbar = container.querySelector('.cinder-jse-toolbar');
    const label = toolbar?.getAttribute('aria-label');
    expect(typeof label).toBe('string');
    expect((label ?? '').length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// CopyButton participation in roving set
// ---------------------------------------------------------------------------
describe('JsonSchemaToolbar — roving tabindex participants', () => {
  test('the rendered .cinder-copy-button is included in the roving participant set', async () => {
    const { container } = render(JsonSchemaToolbar, {
      props: { state: makeFakeState({ canUndo: true, canRedo: true, hasChanges: true }) },
    });
    await tick();

    const copyButton = container.querySelector<HTMLButtonElement>('.cinder-copy-button');
    expect(copyButton).not.toBeNull();
    // It should be present in the action buttons query
    const actionButtons = getActionButtons(container);
    if (copyButton) {
      expect(actionButtons).toContain(copyButton);
    }
  });

  test('disabled buttons are excluded from the roving participant set', async () => {
    // canUndo=false, canRedo=false, hasChanges=false → Undo, Redo, and Revert are disabled
    const { container } = render(JsonSchemaToolbar, {
      props: { state: makeFakeState({ canUndo: false, canRedo: false, hasChanges: false }) },
    });
    await tick();

    const allButtons = getAllRightButtons(container);
    const actionButtons = getActionButtons(container);

    // CopyButton is never disabled; Undo/Redo/Revert are disabled in this state
    const disabledButtons = allButtons.filter((button) => button.disabled);
    expect(disabledButtons.length).toBeGreaterThan(0);
    for (const disabled of disabledButtons) {
      expect(actionButtons).not.toContain(disabled);
    }
  });
});

// ---------------------------------------------------------------------------
// Exactly one tabindex=0 after mount
// ---------------------------------------------------------------------------
describe('JsonSchemaToolbar — initial tabindex state', () => {
  test('exactly one enabled action has tabindex=0 after mount', async () => {
    const { container } = render(JsonSchemaToolbar, {
      props: { state: makeFakeState({ canUndo: true, canRedo: true, hasChanges: true }) },
    });
    await tick();

    const actionButtons = getActionButtons(container);
    expect(actionButtons.length).toBeGreaterThan(0);

    const zeroTabIndexButtons = actionButtons.filter((button) => button.tabIndex === 0);
    expect(zeroTabIndexButtons.length).toBe(1);
  });

  test('all other enabled actions have tabindex=-1 after mount', async () => {
    const { container } = render(JsonSchemaToolbar, {
      props: { state: makeFakeState({ canUndo: true, canRedo: true, hasChanges: true }) },
    });
    await tick();

    const actionButtons = getActionButtons(container);
    const minusOneButtons = actionButtons.filter((button) => button.tabIndex === -1);
    expect(minusOneButtons.length).toBe(actionButtons.length - 1);
  });
});

// ---------------------------------------------------------------------------
// Keyboard navigation: ArrowRight / ArrowLeft / Home / End
// ---------------------------------------------------------------------------
describe('JsonSchemaToolbar — keyboard navigation', () => {
  test('ArrowRight moves roving tabindex to the next enabled button', async () => {
    const { container } = render(JsonSchemaToolbar, {
      props: { state: makeFakeState({ canUndo: true, canRedo: true, hasChanges: true }) },
    });
    await tick();

    const actionButtons = getActionButtons(container);
    // Focus the first button and fire ArrowRight on the toolbar
    actionButtons[0]?.focus();

    const toolbar = container.querySelector<HTMLElement>('.cinder-jse-toolbar');
    toolbar?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await tick();

    const updatedButtons = getActionButtons(container);
    const zeroIndex = updatedButtons.findIndex((button) => button.tabIndex === 0);
    expect(zeroIndex).toBe(1);
  });

  test('ArrowLeft moves roving tabindex to the previous enabled button', async () => {
    const { container } = render(JsonSchemaToolbar, {
      props: { state: makeFakeState({ canUndo: true, canRedo: true, hasChanges: true }) },
    });
    await tick();

    const actionButtons = getActionButtons(container);
    // Focus the second button and fire ArrowLeft
    actionButtons[1]?.focus();
    const toolbar = container.querySelector<HTMLElement>('.cinder-jse-toolbar');
    toolbar?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    await tick();

    const updatedButtons = getActionButtons(container);
    const zeroIndex = updatedButtons.findIndex((button) => button.tabIndex === 0);
    expect(zeroIndex).toBe(0);
  });

  test('Home moves roving tabindex to the first enabled button', async () => {
    const { container } = render(JsonSchemaToolbar, {
      props: { state: makeFakeState({ canUndo: true, canRedo: true, hasChanges: true }) },
    });
    await tick();

    const actionButtons = getActionButtons(container);
    // Focus the last button
    actionButtons[actionButtons.length - 1]?.focus();
    const toolbar = container.querySelector<HTMLElement>('.cinder-jse-toolbar');
    toolbar?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    await tick();

    const updatedButtons = getActionButtons(container);
    expect(updatedButtons[0]?.tabIndex).toBe(0);
  });

  test('End moves roving tabindex to the last enabled button', async () => {
    const { container } = render(JsonSchemaToolbar, {
      props: { state: makeFakeState({ canUndo: true, canRedo: true, hasChanges: true }) },
    });
    await tick();

    const actionButtons = getActionButtons(container);
    // Focus the first button
    actionButtons[0]?.focus();
    const toolbar = container.querySelector<HTMLElement>('.cinder-jse-toolbar');
    toolbar?.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    await tick();

    const updatedButtons = getActionButtons(container);
    const lastIndex = updatedButtons.length - 1;
    expect(updatedButtons[lastIndex]?.tabIndex).toBe(0);
  });

  test('disabled Undo/Redo buttons are not reachable via ArrowRight navigation', async () => {
    // With canUndo=false, canRedo=false: Undo and Redo are disabled, not in participant set
    const { container } = render(JsonSchemaToolbar, {
      props: { state: makeFakeState({ canUndo: false, canRedo: false, hasChanges: true }) },
    });
    await tick();

    const actionButtons = getActionButtons(container);
    // Should only have CopyButton and Revert (Undo/Redo disabled)
    const undoButton = Array.from(
      container.querySelectorAll<HTMLButtonElement>('.cinder-jse-toolbar__right button'),
    ).find((button) => button.textContent?.includes('Undo'));
    const redoButton = Array.from(
      container.querySelectorAll<HTMLButtonElement>('.cinder-jse-toolbar__right button'),
    ).find((button) => button.textContent?.includes('Redo'));

    expect(undoButton?.disabled).toBe(true);
    expect(redoButton?.disabled).toBe(true);
    expect(actionButtons).not.toContain(undoButton);
    expect(actionButtons).not.toContain(redoButton);
  });
});

// ---------------------------------------------------------------------------
// Rerender: roved action becomes disabled → tabindex=0 moves to first enabled
// ---------------------------------------------------------------------------
describe('JsonSchemaToolbar — tabindex recomputation on state change', () => {
  afterEach(() => {
    // Clean up any document focus
  });

  test('when the roved action becomes disabled tabindex=0 moves to first enabled action', async () => {
    // Initial state: all actions enabled
    const { container, rerender } = render(JsonSchemaToolbar, {
      props: { state: makeFakeState({ canUndo: true, canRedo: true, hasChanges: true }) },
    });
    await tick();

    // All four enabled (Undo, Redo, Copy JSON, Revert)
    let actionButtons = getActionButtons(container);
    expect(actionButtons.length).toBe(4);
    // First button (Undo) should have tabindex=0 initially
    expect(actionButtons[0]?.tabIndex).toBe(0);

    // Rerender with canUndo=false, canRedo=false, hasChanges=false
    // → Undo, Redo, and Revert become disabled; only CopyButton remains
    await rerender({ state: makeFakeState({ canUndo: false, canRedo: false, hasChanges: false }) });
    await tick();

    actionButtons = getActionButtons(container);
    // Only CopyButton remains enabled
    expect(actionButtons.length).toBe(1);
    expect(actionButtons[0]?.tabIndex).toBe(0);
    expect(actionButtons[0]?.classList.contains('cinder-copy-button')).toBe(true);
  });
});
