import { describe, expect, test } from 'bun:test';

import { createEditorState } from './json-schema-editor-state.svelte.ts';

function withImmediateTimers<T>(run: () => T): T {
  const originalSetTimeout = globalThis.setTimeout;
  globalThis.setTimeout = ((handler: TimerHandler, _timeout?: number, ...args: unknown[]) => {
    if (typeof handler === 'function') handler(...args);
    return 0 as unknown as ReturnType<typeof setTimeout>;
  }) as unknown as typeof setTimeout;

  try {
    return run();
  } finally {
    globalThis.setTimeout = originalSetTimeout;
  }
}

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

describe('createEditorState — onrevert callback', () => {
  test('fires with restoredFrom: original-schema when the original parsed', () => {
    const events: { restoredFrom: string }[] = [];
    const state = createEditorState({
      schema: { type: 'string' },
      onrevert: (event) => events.push(event),
    });

    state.commitFromForm({ type: 'number' });
    state.revert();

    expect(events).toHaveLength(1);
    expect(events[0]?.restoredFrom).toBe('original-schema');
  });

  test('fires with restoredFrom: original-text when the original was unparseable', () => {
    const events: { restoredFrom: string }[] = [];
    const state = createEditorState({
      schema: '{not-valid',
      onrevert: (event) => events.push(event),
    });

    state.setJsonDraftText('{"type":"string"}');
    state.applyJsonDraft();
    state.revert();

    expect(events).toHaveLength(1);
    expect(events[0]?.restoredFrom).toBe('original-text');
  });
});

describe('createEditorState — readonly guards', () => {
  test('revert is a no-op in readonly mode', () => {
    const state = createEditorState({ schema: { type: 'string' }, readonly: true });

    // commitFromForm is also blocked, so we can't build divergent state to
    // observe a "restoration" — assert revert doesn't throw and committed
    // remains the initial value.
    state.revert();
    expect(state.committedSchema).toEqual({ type: 'string' });
    expect(state.canUndo).toBe(false);
  });

  test('setReadonly toggles editability live', () => {
    const state = createEditorState({ schema: { type: 'string' }, readonly: true });
    expect(state.isFormEditable).toBe(false);

    state.setReadonly(false);
    expect(state.isFormEditable).toBe(true);

    state.setReadonly(true);
    expect(state.isFormEditable).toBe(false);
  });

  test('setReadonly blocks undo and redo live', () => {
    const state = createEditorState({ schema: { type: 'string' } });
    state.commitFromForm({ type: 'number' }, { label: 'change type' });

    expect(state.canUndo).toBe(true);
    state.setReadonly(true);

    expect(state.undo()).toBeUndefined();
    expect(state.committedSchema).toEqual({ type: 'number' });

    state.setReadonly(false);
    state.undo();
    expect(state.committedSchema).toEqual({ type: 'string' });

    state.setReadonly(true);
    expect(state.redo()).toBeUndefined();
    expect(state.committedSchema).toEqual({ type: 'string' });
  });
});

describe('createEditorState — onvalidate callback', () => {
  test('fires on initial mount with the loaded schema status', () => {
    const events: { status: string; valid: boolean }[] = [];
    createEditorState({
      schema: { type: 'string' },
      onvalidate: (result) => events.push(result),
    });

    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0]?.valid).toBe(true);
  });

  test('fires after every committed schema change', () => {
    const events: { status: string }[] = [];
    const state = createEditorState({
      schema: { type: 'string' },
      onvalidate: (result) => events.push(result),
    });
    const baseline = events.length;

    state.commitFromForm({ type: 'number' });

    expect(events.length).toBeGreaterThan(baseline);
  });

  test('fires invalid status for a dirty top-level array draft', () => {
    const events: { status: string; valid: boolean }[] = [];
    const state = createEditorState({
      schema: { type: 'string' },
      onvalidate: (result) => events.push(result),
    });

    withImmediateTimers(() => {
      state.setJsonDraftText('[1,2,3]');
    });

    expect(state.validationStatus).toBe('invalid');
    expect(state.validationResult.valid).toBe(false);
    expect(events.at(-1)).toMatchObject({ status: 'invalid', valid: false });
  });

  test('does not synchronously compile a large draft (size gate)', () => {
    const state = createEditorState({ schema: { type: 'string' } });

    // Build a draft larger than the compile-defer threshold (100KB) by
    // padding the description. This exercises the size gate in
    // scheduleValidation: the compile timer should never fire, leaving
    // status 'pending' instead of 'valid'. The test relies on the fact
    // that scheduleValidation's compile branch is skipped synchronously
    // when the draft exceeds the size threshold.
    const largeDescription = 'x'.repeat(120_000);
    state.setJsonDraftText(`{"type":"string","description":"${largeDescription}"}`);

    // After the synchronous portion of scheduleValidation, compileResult
    // is reset to null and no timer is scheduled. Status is 'pending'.
    expect(state.validationStatus).toBe('pending');
    expect(state.validationResult.compilable).toBe(null);
  });

  test('activeDraft reflects a parseable dirty JSON draft', () => {
    const state = createEditorState({
      schema: { $schema: 'https://json-schema.org/draft/2020-12/schema', type: 'string' },
    });

    expect(state.activeDraft).toBe('2020-12');

    state.setJsonDraftText('{"$schema":"http://json-schema.org/draft-07/schema#","type":"string"}');

    expect(state.activeDraft).toBe('draft-07');
  });

  test('draftOverride wins for parseable dirty JSON drafts', () => {
    const state = createEditorState({
      schema: { type: 'string' },
      draftOverride: 'draft-07',
    });

    state.setJsonDraftText(
      '{"$schema":"https://json-schema.org/draft/2020-12/schema","type":"string"}',
    );

    expect(state.activeDraft).toBe('draft-07');
  });
});
