import { describe, expect, test } from 'bun:test';

import { createEditorState } from './json-schema-editor-state.svelte.ts';

describe('createEditorState — initial load', () => {
  test('parses a string schema and seeds canonical text', () => {
    const state = createEditorState({ schema: '{"type":"string"}' });

    expect(state.committedSchema).toEqual({ type: 'string' });
    expect(state.originalRawText).toBe('{"type":"string"}');
    expect(state.committedCanonicalText).toContain('"type"');
    expect(state.jsonDraftIsDirty).toBe(false);
  });

  test('accepts an object schema directly', () => {
    const state = createEditorState({ schema: { type: 'string' } });
    expect(state.committedSchema).toEqual({ type: 'string' });
  });

  test('accepts a boolean schema', () => {
    const state = createEditorState({ schema: true });
    expect(state.committedSchema).toBe(true);
  });

  test('invalid initial input opens with no committed schema', () => {
    const state = createEditorState({ schema: '{not-valid' });
    expect(state.committedSchema).toBe(null);
    expect(state.originalSchema).toBe(null);
    expect(state.originalLoadError).not.toBe(null);
    expect(state.isFormEditable).toBe(false);
  });

  test('isFormEditable is true after a valid initial load', () => {
    const state = createEditorState({ schema: { type: 'string' } });
    expect(state.isFormEditable).toBe(true);
  });

  test('readonly disables form editing even when valid', () => {
    const state = createEditorState({ schema: { type: 'string' }, readonly: true });
    expect(state.isFormEditable).toBe(false);
  });
});

describe('createEditorState — JSON draft / Apply', () => {
  test('setJsonDraftText marks dirty without committing', () => {
    const state = createEditorState({ schema: { type: 'string' } });

    state.setJsonDraftText('{"type":"number"}');

    expect(state.jsonDraftIsDirty).toBe(true);
    expect(state.committedSchema).toEqual({ type: 'string' });
  });

  test('applyJsonDraft commits a valid draft', () => {
    const state = createEditorState({ schema: { type: 'string' } });

    state.setJsonDraftText('{"type":"number"}');
    const applied = state.applyJsonDraft();

    expect(applied).toBe(true);
    expect(state.committedSchema).toEqual({ type: 'number' });
    expect(state.jsonDraftIsDirty).toBe(false);
  });

  test('applyJsonDraft rejects invalid JSON', () => {
    const state = createEditorState({ schema: { type: 'string' } });

    state.setJsonDraftText('{not-valid');
    const applied = state.applyJsonDraft();

    expect(applied).toBe(false);
    expect(state.committedSchema).toEqual({ type: 'string' });
  });

  test('applyJsonDraft rejects meta-schema-invalid drafts', () => {
    const state = createEditorState({ schema: { type: 'string' } });

    state.setJsonDraftText('{"type":"not-a-real-type"}');
    const applied = state.applyJsonDraft();

    expect(applied).toBe(false);
    expect(state.committedSchema).toEqual({ type: 'string' });
  });

  test('discardJsonDraft restores committed canonical text', () => {
    const state = createEditorState({ schema: { type: 'string' } });

    state.setJsonDraftText('{"type":"number"}');
    expect(state.jsonDraftIsDirty).toBe(true);

    state.discardJsonDraft();
    expect(state.jsonDraftIsDirty).toBe(false);
  });
});

describe('createEditorState — form commits', () => {
  test('commitFromForm pushes a new history entry', () => {
    const state = createEditorState({ schema: { type: 'string' } });

    state.commitFromForm({ type: 'number' });

    expect(state.committedSchema).toEqual({ type: 'number' });
    expect(state.canUndo).toBe(true);
  });

  test('commitFromForm is blocked while a JSON draft is dirty', () => {
    const state = createEditorState({ schema: { type: 'string' } });

    state.setJsonDraftText('{"type":"number"}');
    state.commitFromForm({ type: 'integer' });

    expect(state.committedSchema).toEqual({ type: 'string' });
  });

  test('commitFromForm is blocked while readonly', () => {
    const state = createEditorState({ schema: { type: 'string' }, readonly: true });

    state.commitFromForm({ type: 'number' });

    expect(state.committedSchema).toEqual({ type: 'string' });
  });
});

describe('createEditorState — undo / redo / revert', () => {
  test('undo / redo move through history', () => {
    const state = createEditorState({ schema: { type: 'string' } });

    state.commitFromForm({ type: 'number' }, { label: 'change type' });

    expect(state.canUndo).toBe(true);
    state.undo();
    expect(state.committedSchema).toEqual({ type: 'string' });

    state.redo();
    expect(state.committedSchema).toEqual({ type: 'number' });
  });

  test('revert restores original schema and clears history', () => {
    const state = createEditorState({ schema: { type: 'string' } });
    state.commitFromForm({ type: 'number' });
    state.commitFromForm({ type: 'integer' });

    state.revert();

    expect(state.committedSchema).toEqual({ type: 'string' });
    expect(state.canUndo).toBe(false);
    expect(state.canRedo).toBe(false);
  });

  test('revert from invalid initial input clears the draft to original raw', () => {
    const state = createEditorState({ schema: '{not-valid' });
    state.setJsonDraftText('{"type":"string"}');
    state.applyJsonDraft();

    expect(state.committedSchema).toEqual({ type: 'string' });

    state.revert();
    expect(state.committedSchema).toBe(null);
    expect(state.jsonDraftText).toBe('{not-valid');
  });
});

describe('createEditorState — diff and copy values', () => {
  test('copyValue is the canonical committed text, never the dirty draft', () => {
    const state = createEditorState({ schema: { type: 'string' } });

    state.setJsonDraftText('{"type":"number"}');

    expect(state.copyValue).toContain('"string"');
    expect(state.copyValue).not.toContain('"number"');
  });

  test('hasChanges uses semantic equality (key order ignored)', () => {
    const state = createEditorState({
      schema: { type: 'string', title: 'A' },
    });
    expect(state.hasChanges).toBe(false);

    state.commitFromForm({ title: 'A', type: 'string' });
    // Same content, different key order — should still be equal
    expect(state.hasChanges).toBe(false);

    state.commitFromForm({ type: 'string', title: 'B' });
    expect(state.hasChanges).toBe(true);
  });

  test('separate `original` overrides the diff baseline', () => {
    const state = createEditorState({
      schema: { type: 'number' },
      original: { type: 'string' },
    });

    expect(state.originalSchema).toEqual({ type: 'string' });
    expect(state.committedSchema).toEqual({ type: 'number' });
    expect(state.hasChanges).toBe(true);
  });
});

describe('createEditorState — reload', () => {
  test('reload swaps schema and clears history', () => {
    const state = createEditorState({ schema: { type: 'string' } });
    state.commitFromForm({ type: 'number' });

    state.reload({ type: 'integer' });

    expect(state.committedSchema).toEqual({ type: 'integer' });
    expect(state.canUndo).toBe(false);
    expect(state.canRedo).toBe(false);
  });
});

describe('createEditorState — change events', () => {
  test('onchange fires on commit, apply, undo, redo, revert-to-valid', () => {
    const events: string[] = [];
    const state = createEditorState({
      schema: { type: 'string' },
      onchange: (event) => events.push(event.jsonString),
    });

    state.commitFromForm({ type: 'number' });
    state.setJsonDraftText('{"type":"integer"}');
    state.applyJsonDraft();
    state.undo();
    state.redo();
    state.revert();

    // commit, apply, undo, redo, revert-to-valid = 5
    expect(events.length).toBe(5);
  });

  test('onchange does NOT fire for transient JSON edits without Apply', () => {
    let calls = 0;
    const state = createEditorState({
      schema: { type: 'string' },
      onchange: () => (calls += 1),
    });

    state.setJsonDraftText('{"type":"number"}');

    expect(calls).toBe(0);
  });
});
