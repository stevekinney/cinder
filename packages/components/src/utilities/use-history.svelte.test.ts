import { describe, expect, test } from 'bun:test';

import { useHistory } from './use-history.svelte.ts';

function withSilencedSvelteSnapshotWarning(run: () => void) {
  const originalError = console.error;
  const originalWarn = console.warn;

  console.error = () => {};
  console.warn = () => {};

  try {
    run();
  } finally {
    console.error = originalError;
    console.warn = originalWarn;
  }
}

describe('useHistory', () => {
  test('starts with the initial value as the only history entry', () => {
    const history = useHistory({ initial: { count: 0 } });

    expect(history.current).toEqual({ count: 0 });
    expect(history.committedEntry.value).toEqual({ count: 0 });
    expect(history.canUndo).toBe(false);
    expect(history.canRedo).toBe(false);
    expect(history.size).toBe(1);
    expect(history.index).toBe(0);
  });

  test('commit pushes a new entry and updates current', () => {
    const history = useHistory({ initial: { count: 0 } });

    history.commit({ count: 1 });

    expect(history.current).toEqual({ count: 1 });
    expect(history.committedEntry.value).toEqual({ count: 1 });
    expect(history.size).toBe(2);
    expect(history.index).toBe(1);
    expect(history.canUndo).toBe(true);
    expect(history.canRedo).toBe(false);
  });

  test('undo returns the entry we just left and moves current back', () => {
    const history = useHistory({ initial: { count: 0 } });

    history.commit({ count: 1 }, { label: 'first' });
    history.commit({ count: 2 }, { label: 'second' });

    const left = history.undo();

    expect(left?.value).toEqual({ count: 2 });
    expect(left?.label).toBe('second');
    expect(history.current).toEqual({ count: 1 });
    expect(history.canRedo).toBe(true);
  });

  test('redo returns the entry we moved to', () => {
    const history = useHistory({ initial: { count: 0 } });

    history.commit({ count: 1 }, { label: 'first' });
    history.commit({ count: 2 }, { label: 'second' });
    history.undo();

    const moved = history.redo();

    expect(moved?.value).toEqual({ count: 2 });
    expect(moved?.label).toBe('second');
    expect(history.current).toEqual({ count: 2 });
  });

  test('commit after undo truncates the redo tail', () => {
    const history = useHistory({ initial: { count: 0 } });

    history.commit({ count: 1 });
    history.commit({ count: 2 });
    history.undo();

    history.commit({ count: 99 });

    expect(history.current).toEqual({ count: 99 });
    expect(history.canRedo).toBe(false);
    expect(history.size).toBe(3);
  });

  test('coalesce key collapses rapid commits sharing the same key', () => {
    const history = useHistory({ initial: { text: '' }, coalesceMs: 1_000_000 });

    history.commit({ text: 'a' }, { coalesceKey: 'title' });
    history.commit({ text: 'ab' }, { coalesceKey: 'title' });
    history.commit({ text: 'abc' }, { coalesceKey: 'title' });

    expect(history.current).toEqual({ text: 'abc' });
    expect(history.size).toBe(2); // initial + one collapsed entry
  });

  test('structural commits (no coalesce key) never coalesce, even back-to-back', () => {
    const history = useHistory({ initial: { count: 0 }, coalesceMs: 1_000_000 });

    history.commit({ count: 1 });
    history.commit({ count: 2 });
    history.commit({ count: 3 });

    expect(history.size).toBe(4);
    expect(history.canUndo).toBe(true);
    history.undo();
    expect(history.current).toEqual({ count: 2 });
  });

  test('different coalesce keys do not coalesce together', () => {
    const history = useHistory({ initial: { a: '', b: '' }, coalesceMs: 1_000_000 });

    history.commit({ a: 'x', b: '' }, { coalesceKey: 'a' });
    history.commit({ a: 'x', b: 'y' }, { coalesceKey: 'b' });

    expect(history.size).toBe(3);
  });

  test('equality check is against committed stack top, not transient current', () => {
    const history = useHistory({ initial: { count: 0 } });

    history.set({ count: 5 });
    expect(history.current).toEqual({ count: 5 });
    expect(history.committedEntry.value).toEqual({ count: 0 });

    // committing the original baseline should be a no-op against the stack top
    history.commit({ count: 0 });
    expect(history.size).toBe(1);
    expect(history.current).toEqual({ count: 0 });

    // committing { count: 5 } pushes (vs stack top { count: 0 }), even though
    // current was already { count: 5 } via set()
    history.commit({ count: 5 });
    expect(history.size).toBe(2);
    expect(history.committedEntry.value).toEqual({ count: 5 });
  });

  test('mutating-then-committing the same reference is detected as a change', () => {
    const value = { items: [1, 2, 3] };
    const history = useHistory({ initial: value });

    value.items.push(4);
    history.commit(value);

    expect(history.size).toBe(2);
    expect(history.committedEntry.value).toEqual({ items: [1, 2, 3, 4] });
    // Initial entry must still be the pristine version (deep-cloned at commit)
    history.undo();
    expect(history.current).toEqual({ items: [1, 2, 3] });
  });

  test('maxDepth evicts oldest entries', () => {
    const history = useHistory({ initial: { n: 0 }, maxDepth: 3 });

    history.commit({ n: 1 });
    history.commit({ n: 2 });
    history.commit({ n: 3 });
    history.commit({ n: 4 });

    expect(history.size).toBe(3);
    // Oldest entry (initial { n: 0 }) was evicted; we can undo back to { n: 2 }
    while (history.canUndo) history.undo();
    expect(history.current).toEqual({ n: 2 });
  });

  test('reset clears history and seeds a new baseline', () => {
    const history = useHistory({ initial: { count: 0 } });
    history.commit({ count: 1 });
    history.commit({ count: 2 });

    history.reset({ count: 100 }, 'reset baseline');

    expect(history.current).toEqual({ count: 100 });
    expect(history.committedEntry.value).toEqual({ count: 100 });
    expect(history.committedEntry.label).toBe('reset baseline');
    expect(history.size).toBe(1);
    expect(history.canUndo).toBe(false);
    expect(history.canRedo).toBe(false);
  });

  test('label round-trips through undo and redo', () => {
    const history = useHistory({ initial: { v: 0 } });
    history.commit({ v: 1 }, { label: 'add' });
    history.commit({ v: 2 }, { label: 'multiply' });

    expect(history.undo()?.label).toBe('multiply');
    expect(history.undo()?.label).toBe('add');
    expect(history.redo()?.label).toBe('add');
    expect(history.redo()?.label).toBe('multiply');
  });

  test('custom equals lets callers decide equivalence', () => {
    const history = useHistory<{ id: number; data: string }>({
      initial: { id: 1, data: 'a' },
      equals: (a, b) => a.id === b.id,
    });

    // Same id => equal => no push
    history.commit({ id: 1, data: 'b' });
    expect(history.size).toBe(1);

    // Different id => push
    history.commit({ id: 2, data: 'c' });
    expect(history.size).toBe(2);
  });

  test('custom clone supports values structuredClone cannot handle', () => {
    type Stamped = { ts: Date; tag: string };
    const history = useHistory<Stamped>({
      initial: { ts: new Date('2020-01-01'), tag: 'a' },
      clone: (value) => ({ ts: new Date(value.ts.getTime()), tag: value.tag }),
      equals: (a, b) => a.ts.getTime() === b.ts.getTime() && a.tag === b.tag,
    });

    history.commit({ ts: new Date('2020-02-02'), tag: 'b' });

    expect(history.current.tag).toBe('b');
    expect(history.committedEntry.value.ts.toISOString()).toBe('2020-02-02T00:00:00.000Z');
  });

  test('throws when default clone (structuredClone) cannot copy the committed value', () => {
    const history = useHistory<{ tag: string; run?: () => void }>({
      initial: { tag: 'a' },
    });

    expect(() =>
      withSilencedSvelteSnapshotWarning(() => history.commit({ tag: 'b', run: () => 0 })),
    ).toThrow();
  });

  test('canUndo / canRedo reflect bounds', () => {
    const history = useHistory({ initial: 'a' });

    expect(history.canUndo).toBe(false);
    expect(history.canRedo).toBe(false);

    history.commit('b');
    expect(history.canUndo).toBe(true);
    expect(history.canRedo).toBe(false);

    history.undo();
    expect(history.canUndo).toBe(false);
    expect(history.canRedo).toBe(true);
  });

  test('undo / redo at boundaries returns null', () => {
    const history = useHistory({ initial: 0 });

    expect(history.undo()).toBe(null);
    expect(history.redo()).toBe(null);
  });

  test('set updates current without touching the committed stack', () => {
    const history = useHistory({ initial: 'a' });

    history.set('b');

    expect(history.current).toBe('b');
    expect(history.committedEntry.value).toBe('a');
    expect(history.size).toBe(1);
    expect(history.canUndo).toBe(false);
  });

  test('mutating current does not corrupt the committed baseline', () => {
    const history = useHistory({ initial: { count: 0 } });

    history.current.count = 99;

    expect(history.committedEntry.value).toEqual({ count: 0 });
  });

  test('mutating committedEntry.value does not corrupt the stored history', () => {
    const history = useHistory({ initial: { count: 0 } });
    history.commit({ count: 1 });

    const entry = history.committedEntry;
    entry.value.count = 999;

    expect(history.committedEntry.value).toEqual({ count: 1 });
    history.undo();
    expect(history.committedEntry.value).toEqual({ count: 0 });
  });

  test('mutating undo() return value does not corrupt history', () => {
    const history = useHistory({ initial: { count: 0 } });
    history.commit({ count: 1 });
    history.commit({ count: 2 });

    const left = history.undo();
    if (left) left.value.count = 999;

    history.redo();
    expect(history.current).toEqual({ count: 2 });
  });

  test('maxDepth less than 1 is clamped to 1', () => {
    const history = useHistory({ initial: 0, maxDepth: 0 });

    history.commit(1);
    expect(history.size).toBe(1);
    expect(history.committedEntry.value).toBe(1);

    history.commit(2);
    expect(history.size).toBe(1);
    expect(history.committedEntry.value).toBe(2);
  });

  test('cloneable check throws even when next is JSON-equal to committed top', () => {
    const history = useHistory<{ tag: string; run?: () => void }>({
      initial: { tag: 'a' },
    });

    // This value JSON-serialises to {"tag":"a"} (function dropped) but is
    // not structuredClone-able. Spec says commit must enforce cloneability
    // before any decision.
    expect(() =>
      withSilencedSvelteSnapshotWarning(() => history.commit({ tag: 'a', run: () => 0 })),
    ).toThrow();
  });
});
